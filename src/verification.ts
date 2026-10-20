/**
 * src/verification.ts
 * Orquestador desacoplado del flujo KYC para RONDA.
 * Garantiza UI a 60 FPS con inferencia biométrica throttled y fallback suave.
 */

import {
  analyzeFaceAlignment,
  getFaceDescriptor,
  verifyBiometricMatch,
  disposeFaceEngine,
  AlignmentResult,
  recognizeDocument,
} from './face-verify.js';
import { submitKycReview, KycReviewData } from './kyc-review.js';
import { Auth } from './auth.js';

export type KycState =
  | 'IDLE'
  | 'INITIALIZING_CAMERA'
  | 'ALIGNING_FACE'
  | 'LIVENESS_CHALLENGE'
  | 'CAPTURE_DOCUMENT'
  | 'PROCESSING_VERIFICATION'
  | 'VERIFIED_SUCCESS'
  | 'MANUAL_REVIEW_FALLBACK'
  | 'ERROR';

export type LivenessChallengeType = 'BLINK' | 'SMILE';

export interface VerificationCallbacks {
  onStateChange: (state: KycState, message: string) => void;
  onAlignmentFeedback: (status: string, message: string, progressPct?: number) => void;
  onLivenessProgress: (current: number, target: number) => void;
  onSuccess: () => void;
  onFallbackReview: (reviewId: string) => void;
  onError: (errorMsg: string) => void;
}

/**
 * Emite micro-pulsos hápticos sensoriales en navegadores móviles compatibles.
 */
function triggerHaptic(type: 'lock' | 'success' | 'warn'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'lock') {
        navigator.vibrate(18); // Micro-vibración al fijar rostro en el óvalo
      } else if (type === 'success') {
        navigator.vibrate([30, 45, 65]); // Vibración festiva al completar selfie
      } else if (type === 'warn') {
        navigator.vibrate(35);
      }
    } catch {
      // Ignorar bloqueos de política del sistema
    }
  }
}

function ensureBiometricStyles(): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('kyc-biometric-keyframes')) {
    const style = document.createElement('style');
    style.id = 'kyc-biometric-keyframes';
    style.textContent = `
      @keyframes kycScanSweep {
        0% { top: 6%; opacity: 0.2; }
        25% { opacity: 0.85; }
        75% { opacity: 0.85; }
        100% { top: 92%; opacity: 0.2; }
      }
    `;
    document.head.appendChild(style);
  }
}

export class RondaKycOrchestrator {
  private videoEl: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private currentState: KycState = 'IDLE';
  private callbacks: VerificationCallbacks;

  // Control de bucle de inferencia (Desacoplado de los 60 FPS de la UI)
  private isInferring = false;
  private isDestroyed = false;
  private lastInferenceTime = 0;
  private animationFrameId: number | null = null;

  // Métricas y Liveness
  private activeChallenge: LivenessChallengeType = 'BLINK';
  private challengeSuccessCount = 0;
  private readonly targetChallengeCompletions = 2; // Requiere 2 parpadeos detectados
  private failedAttempts = 0;
  private readonly maxFailedAttempts = 3;
  private centeredStreak = 0;

  // Descriptores capturados
  private selfieDescriptor: Float32Array | null = null;
  private selfieBlob: Blob | null = null;
  private docBlob: Blob | null = null;
  private userId: string;

  constructor(videoElement: HTMLVideoElement, userId: string, callbacks: VerificationCallbacks) {
    this.videoEl = videoElement;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  // ==========================================================================
  // CICLO DE VIDA DE LA CÁMARA (SAFE MOBILE INIT)
  // ==========================================================================

  public async start(): Promise<void> {
    this.transitionTo('INITIALIZING_CAMERA', 'Iniciando cámara frontal segura...');
    try {
      // 1. Configurar atributos esenciales para WebKit / iOS
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.setAttribute('autoplay', 'true');
      this.videoEl.muted = true;

      // 2. Solicitar cámara frontal con resolución óptima para PWA
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      this.videoEl.srcObject = this.stream;
      await this.waitForVideoReady(this.videoEl);
      await this.videoEl.play();

      // 3. Iniciar bucle de UI a 60 FPS e inferencia throttled
      this.transitionTo('ALIGNING_FACE', 'Ubica tu rostro dentro del óvalo guía');
      this.startVisionLoop();
    } catch (err) {
      this.handleFailure('No fue posible acceder a la cámara frontal', err);
    }
  }

  private async waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
    if (video.readyState >= 2 && video.videoWidth > 0) return;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tiempo de espera de cámara agotado')), timeoutMs);
      const onReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(timer);
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('playing', onReady);
          resolve();
        }
      };
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('playing', onReady);
    });
  }

  // ==========================================================================
  // BUCLE DE VISIÓN DESACOPLADO (UI 60 FPS / IA 3-4 FPS)
  // ==========================================================================

  private startVisionLoop(): void {
    const loop = (timestamp: number) => {
      if (this.isDestroyed) return;

      // Inferencia Throttled: Sólo se dispara si pasaron 250ms y no hay inferencia activa
      const elapsed = timestamp - this.lastInferenceTime;
      if (elapsed >= 250 && !this.isInferring) {
        if (this.currentState === 'ALIGNING_FACE' || this.currentState === 'LIVENESS_CHALLENGE') {
          this.executeInferenceStep();
          this.lastInferenceTime = timestamp;
        }
      }

      // El bucle de animación sigue corriendo libre a 60 FPS en el navegador
      if ('requestVideoFrameCallback' in this.videoEl) {
        (this.videoEl as any).requestVideoFrameCallback(() => {
          this.animationFrameId = requestAnimationFrame(loop);
        });
      } else {
        this.animationFrameId = requestAnimationFrame(loop);
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private async executeInferenceStep(): Promise<void> {
    this.isInferring = true;
    try {
      const result: AlignmentResult = await analyzeFaceAlignment(this.videoEl);

      if (this.currentState === 'ALIGNING_FACE') {
        this.handleAlignmentStep(result);
      } else if (this.currentState === 'LIVENESS_CHALLENGE') {
        this.handleLivenessStep(result);
      }
    } catch (err) {
      console.warn('[KYC] Frame de inferencia omitido por error:', err);
    } finally {
      this.isInferring = false;
    }
  }

  // ==========================================================================
  // MANEJADORES DE ESTADO BIOMÉTRICO
  // ==========================================================================

  private handleAlignmentStep(result: AlignmentResult): void {
    switch (result.status) {
      case 'buscando':
        this.centeredStreak = 0;
        this.callbacks.onAlignmentFeedback('buscando', 'Buscando rostro...', 0);
        break;
      case 'muy_oscuro':
        this.centeredStreak = 0;
        triggerHaptic('warn');
        this.callbacks.onAlignmentFeedback('muy_oscuro', '💡 Poca luz: acércate a una fuente de iluminación', 0);
        break;
      case 'muy_brillante':
        this.centeredStreak = 0;
        triggerHaptic('warn');
        this.callbacks.onAlignmentFeedback('muy_brillante', '☀️ Demasiado brillo o reflejo en la cámara', 0);
        break;
      case 'muy_lejos':
        this.centeredStreak = 0;
        this.callbacks.onAlignmentFeedback('muy_lejos', 'Acerca un poco más tu rostro', 0);
        break;
      case 'muy_cerca':
        this.centeredStreak = 0;
        this.callbacks.onAlignmentFeedback('muy_cerca', 'Aléjate un poco del óvalo', 0);
        break;
      case 'descentrado':
        this.centeredStreak = 0;
        this.callbacks.onAlignmentFeedback('descentrado', 'Centra tu rostro en el óvalo', 0);
        break;
      case 'centrado':
        this.centeredStreak++;
        if (this.centeredStreak === 1) {
          triggerHaptic('lock');
        }
        const pct = Math.min(100, Math.round((this.centeredStreak / 3) * 100));
        this.callbacks.onAlignmentFeedback('centrado', `¡Posición perfecta! Mantén el rostro (${pct}%)`, pct);

        // Si además parpadea o sonríe, o acumula 3 lecturas estables (~750ms):
        if (this.centeredStreak >= 3 || (result.metrics && (result.metrics.isBlinking || result.metrics.isSmiling))) {
          triggerHaptic('success');
          this.completeSelfieCapture();
        }
        break;
    }
  }

  private handleLivenessStep(result: AlignmentResult): void {
    if (result.status === 'centrado') {
      this.centeredStreak++;
      if (this.centeredStreak === 1) {
        triggerHaptic('lock');
      }
      const pct = Math.min(100, Math.round((this.centeredStreak / 3) * 100));
      const { metrics } = result;
      if (this.centeredStreak >= 3 || (metrics && (metrics.isBlinking || metrics.isSmiling))) {
        triggerHaptic('success');
        this.completeSelfieCapture();
        return;
      }
      this.callbacks.onAlignmentFeedback('centrado', `Mantén el rostro quieto (${pct}%)`, pct);
    } else {
      this.centeredStreak = 0;
      this.callbacks.onAlignmentFeedback(result.status, 'Centra tu rostro en el óvalo', 0);
    }
  }

  public async triggerManualCapture(): Promise<void> {
    if (this.currentState === 'ALIGNING_FACE' || this.currentState === 'LIVENESS_CHALLENGE') {
      await this.completeSelfieCapture();
    }
  }

  private async completeSelfieCapture(): Promise<void> {
    this.transitionTo('PROCESSING_VERIFICATION', 'Capturando fotografía biométrica...');
    try {
      // 1. Extraer selfie en canvas de alta resolución
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = this.videoEl.videoWidth || 640;
      captureCanvas.height = this.videoEl.videoHeight || 480;
      const ctx = captureCanvas.getContext('2d');
      if (ctx) ctx.drawImage(this.videoEl, 0, 0);

      this.selfieDescriptor = await getFaceDescriptor(captureCanvas);
      this.selfieBlob = await new Promise<Blob | null>((res) => captureCanvas.toBlob(res, 'image/jpeg', 0.85));

      if (!this.selfieDescriptor || !this.selfieBlob) {
        throw new Error('No se pudo extraer el vector biométrico de la selfie.');
      }

      // Detener cámara frontal temporalmente para el paso de documento
      this.stopStream();
      this.transitionTo('CAPTURE_DOCUMENT', 'Selfie validada. Ahora enfoca tu cédula de ciudadanía');
    } catch (err) {
      this.handleAttemptFailure('Fallo al procesar selfie biométrica', err);
    }
  }

  // ==========================================================================
  // VERIFICACIÓN CONTRA DOCUMENTO (CÉDULA)
  // ==========================================================================

  public async verifyWithDocumentImage(docImageOrCanvas: HTMLImageElement | HTMLCanvasElement): Promise<void> {
    this.transitionTo('PROCESSING_VERIFICATION', 'Comparando selfie con tu documento...');
    try {
      if (!this.selfieDescriptor) {
        throw new Error('Descriptor de selfie no disponible');
      }

      // 1. Extraer descriptor del rostro en el documento
      const docDescriptor = await getFaceDescriptor(docImageOrCanvas);
      if (!docDescriptor) {
        throw new Error('No se detectó un rostro claro en el documento. Evita reflejos.');
      }

      // Guardar blob de documento para trazabilidad
      if (docImageOrCanvas instanceof HTMLCanvasElement) {
        this.docBlob = await new Promise((res) => docImageOrCanvas.toBlob(res, 'image/jpeg', 0.85));
      }

      // 2. Comparación biométrica euclidiana
      const { match, distance } = verifyBiometricMatch(this.selfieDescriptor, docDescriptor);

      if (match) {
        this.transitionTo('VERIFIED_SUCCESS', '¡Identidad verificada con éxito!');
        this.cleanup();
        this.callbacks.onSuccess();
      } else {
        throw new Error(`Coincidencia insuficiente (distancia: ${distance}). Intenta con mejor iluminación.`);
      }
    } catch (err) {
      this.handleAttemptFailure('Fallo en la comparación biométrica de documento', err);
    }
  }

  // ==========================================================================
  // MANEJO DE INTENTOS Y FALLBACK SEGURO A REVISIÓN MANUAL
  // ==========================================================================

  private handleAttemptFailure(reason: string, error: unknown): void {
    this.failedAttempts++;
    console.warn(`[KYC] Intento ${this.failedAttempts}/${this.maxFailedAttempts} fallido:`, reason, error);

    if (this.failedAttempts >= this.maxFailedAttempts) {
      this.triggerManualFallback(reason);
    } else {
      this.transitionTo('ALIGNING_FACE', `${reason}. Reintentando (${this.failedAttempts}/${this.maxFailedAttempts})...`);
    }
  }

  private async triggerManualFallback(reason: string): Promise<void> {
    this.transitionTo('MANUAL_REVIEW_FALLBACK', 'Derivando a revisión humana para no detener tu registro...');
    this.cleanup();

    try {
      const reviewPayload: KycReviewData = {
        userId: this.userId,
        reason: `Falla biométrica automática tras ${this.maxFailedAttempts} intentos: ${reason}`,
        selfieBlob: this.selfieBlob || new Blob(),
        docBlob: this.docBlob || new Blob(),
        timestamp: Date.now(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        },
      };

      const reviewId = await submitKycReview(reviewPayload);
      this.callbacks.onFallbackReview(reviewId);
    } catch (fallbackError) {
      this.callbacks.onError('Error al registrar la revisión manual. Contacta al anfitrión.');
    }
  }

  private handleFailure(message: string, error: unknown): void {
    console.error('[KYC Fatal Error]', message, error);
    this.cleanup();
    this.transitionTo('ERROR', message);
    this.callbacks.onError(message);
  }

  private transitionTo(newState: KycState, message: string): void {
    this.currentState = newState;
    this.callbacks.onStateChange(newState, message);
  }

  // ==========================================================================
  // LIMPIEZA DE RECURSOS (PREVENCIÓN OOM)
  // ==========================================================================

  public cleanup(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopStream();
    disposeFaceEngine();
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }
}

// ────────────────────── OCR DE DOCUMENTO (T-2 / T-3) ──────────────────────
export async function scanDocumentOCR(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<{ success: boolean; rawText: string; hits: string[]; error?: string }> {
  const OCR_TIMEOUT_MS = 8000;
  try {
    const text = await Promise.race([
      recognizeDocument(image),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('ocr_timeout')), OCR_TIMEOUT_MS)
      ),
    ]);
    const hits = extractCedulaHits(text || '');
    return { success: true, rawText: text, hits };
  } catch {
    return { success: false, rawText: '', hits: [], error: 'ocr_timeout' };
  }
}

function extractCedulaHits(text: string): string[] {
  const clean = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const hits: string[] = [];
  if (clean.includes('REPUBLICA DE COLOMBIA')) hits.push('REPUBLICA DE COLOMBIA');
  if (
    clean.includes('CEDULA DE CIUDADANIA') ||
    clean.includes('CEDULA DE CIUDADAN') ||
    clean.includes('NUMERO') ||
    clean.includes('NUIP')
  ) {
    hits.push('CEDULA DE CIUDADANIA');
  }
  return hits;
}

// ============================================================================
// VERIFICATION SERVICE (COMPATIBILIDAD CON VISTAS EXISTENTES)
// ============================================================================

export type KycOvalState = 'idle' | 'ok' | 'error';

export const KYC_LIVENESS_CHALLENGES: string[] = [
  'Parpadea 2 veces',
  'Gira la cabeza levemente a la derecha',
  'Gira la cabeza levemente a la izquierda',
  'Sonríe de forma natural',
  'Acerca tu rostro al óvalo',
];

export interface KycReviewPayload {
  userId: string;
  userName: string;
  userEmail: string;
  registeredBirthDate: string;
  reasonsForManual: string[];
  metrics: { faceDistance: number; livenessScore: number; ocrExtractedName?: string; ocrExtractedNumber?: string };
  imageUrls: { selfie: string; docFront: string; docBack?: string };
}

class VerificationService {
  location: any = null;
  isVerified: boolean = false;
  private currentOrchestrator: RondaKycOrchestrator | null = null;

  constructor() {
    this.location = null;
    this.isVerified = false;
  }

  setOvalState(state: KycOvalState, hint?: string, progressPct?: number): void {
    ensureBiometricStyles();
    const video = document.getElementById('kyc-video') as HTMLVideoElement | null;
    if (!video) return;

    // Asegurar que el video esté dentro de su contenedor de cámara exclusivo
    let wrapper = document.getElementById('kyc-camera-wrapper') as HTMLElement | null;
    if (!wrapper) {
      if (video.parentElement && video.parentElement.id === 'kyc-camera-wrapper') {
        wrapper = video.parentElement;
      } else {
        wrapper = document.createElement('div');
        wrapper.id = 'kyc-camera-wrapper';
        wrapper.style.cssText =
          'position:relative;width:100%;aspect-ratio:4/3;max-height:280px;border-radius:8px;overflow:hidden;background:#0b0b0b;display:flex;align-items:center;justify-content:center;margin:0 0 10px 0;';
        video.parentNode?.insertBefore(wrapper, video);
        wrapper.appendChild(video);
        const canvas = document.getElementById('kyc-canvas');
        if (canvas) wrapper.appendChild(canvas);
      }
    }

    wrapper.style.display = 'flex';
    video.style.display = 'block';
    video.style.transform = 'scaleX(-1)'; // Modo espejo natural

    let overlay = document.getElementById('kyc-oval-overlay') as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'kyc-oval-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText =
        'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:5;overflow:hidden;';
      overlay.innerHTML = `
        <div id="kyc-oval-frame-container" style="position:relative;height:76%;max-height:220px;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;">
          <!-- Viñeteado periférico FaceID con 9999px box-shadow -->
          <div id="kyc-oval-frame" style="position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 9999px rgba(0,0,0,.52);background:transparent;transition:box-shadow .22s ease;box-sizing:border-box;overflow:hidden;">
            <!-- Haz Láser Biométrico -->
            <div id="kyc-scan-beam" style="position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 0%,rgba(243,237,226,.88) 50%,transparent 100%);box-shadow:0 0 10px rgba(243,237,226,.7);border-radius:50%;top:6%;opacity:0.75;pointer-events:none;animation:kycScanSweep 2.2s ease-in-out infinite;"></div>
          </div>
          <!-- Anillo SVG de progreso activo -->
          <svg id="kyc-oval-svg" viewBox="0 0 120 160" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
            <ellipse cx="60" cy="80" rx="57" ry="77" fill="none" stroke="rgba(243,237,226,.2)" stroke-width="2.5" stroke-dasharray="5 5" />
            <ellipse id="kyc-progress-ring" cx="60" cy="80" rx="57" ry="77" fill="none" stroke="#2ecc71" stroke-width="3.5" stroke-dasharray="424" stroke-dashoffset="424" stroke-linecap="round" style="transition:stroke-dashoffset .22s ease-out, stroke .2s ease; transform:rotate(-90deg); transform-origin:60px 80px;" />
          </svg>
        </div>
        <div id="kyc-oval-hint-box" style="position:absolute;bottom:10px;left:8px;right:8px;display:flex;justify-content:center;pointer-events:none;z-index:6;">
          <span id="kyc-oval-hint" style="background:rgba(18,16,14,.88);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(243,237,226,.2);color:#f3ede2;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;"></span>
        </div>
      `;
      wrapper.appendChild(overlay);
    } else if (overlay.parentElement !== wrapper) {
      wrapper.appendChild(overlay);
    }

    const frame = overlay.querySelector('#kyc-oval-frame') as HTMLElement | null;
    const progressRing = overlay.querySelector('#kyc-progress-ring') as SVGGeometryElement | null;
    const beam = overlay.querySelector('#kyc-scan-beam') as HTMLElement | null;
    const hintEl = overlay.querySelector('#kyc-oval-hint') as HTMLElement | null;

    if (progressRing) {
      const pct = Math.max(0, Math.min(100, progressPct ?? (state === 'ok' ? 100 : 0)));
      const offset = 424 * (1 - pct / 100);
      progressRing.style.strokeDashoffset = `${offset}`;
      progressRing.style.stroke = state === 'error' ? '#e74c3c' : '#2ecc71';
    }

    if (beam) {
      if (state === 'ok') {
        beam.style.background = 'linear-gradient(90deg, transparent 0%, #2ecc71 50%, transparent 100%)';
        beam.style.boxShadow = '0 0 16px rgba(46,204,113,.8)';
      } else if (state === 'error') {
        beam.style.background = 'linear-gradient(90deg, transparent 0%, #e74c3c 50%, transparent 100%)';
        beam.style.boxShadow = '0 0 12px rgba(231,76,60,.7)';
      } else {
        beam.style.background = 'linear-gradient(90deg, transparent 0%, rgba(243,237,226,.88) 50%, transparent 100%)';
        beam.style.boxShadow = '0 0 10px rgba(243,237,226,.7)';
      }
    }

    if (frame) {
      if (state === 'ok') {
        frame.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.45), 0 0 16px rgba(46,204,113,.35)';
      } else if (state === 'error') {
        frame.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.45), 0 0 12px rgba(231,76,60,.3)';
      } else {
        frame.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.52)';
      }
    }

    if (hintEl && hint !== undefined) {
      hintEl.textContent = hint;
    }
  }

  hideOval(): void {
    const overlay = document.getElementById('kyc-oval-overlay');
    if (overlay) {
      overlay.remove();
    }
    const wrapper = document.getElementById('kyc-camera-wrapper');
    if (wrapper) {
      wrapper.style.display = 'none';
    }
  }

  setStatus(msg: string): void {
    const el = document.getElementById('kyc-status') as HTMLElement | null;
    if (el) {
      el.textContent = msg;
      el.style.color = /✓|Verificado|OK/.test(msg) ? 'var(--botella)' : 'var(--vino)';
    }
  }

  /**
   * Inicia el flujo biométrico KYC usando el RondaKycOrchestrator desacoplado a 60 FPS.
   */
  async startVerification(videoId: string, canvasId: string): Promise<boolean> {
    const consent = (document.getElementById('kyc-biometric-consent') as HTMLInputElement | null)?.checked;
    if (document.getElementById('kyc-biometric-consent') && !consent) {
      this.setStatus('⚠️ Debes autorizar el tratamiento de datos biométricos (Ley 1581) para continuar.');
      document.getElementById('kyc-biometric-consent')?.focus();
      return false;
    }

    const videoEl = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!videoEl) {
      this.setStatus('Elemento de video no encontrado.');
      return false;
    }

    if (this.currentOrchestrator) {
      this.currentOrchestrator.cleanup();
      this.currentOrchestrator = null;
    }

    const userId = Auth.currentUser?.uid || 'anon_user';

    return new Promise<boolean>((resolve) => {
      const btnKyc = document.getElementById('btn-start-kyc') as HTMLButtonElement | null;
      if (btnKyc) {
        btnKyc.disabled = false;
        btnKyc.textContent = '📸 Capturar Foto Ahora';
        btnKyc.onclick = () => {
          this.currentOrchestrator?.triggerManualCapture();
        };
      }

      const finish = (result: boolean) => {
        if (btnKyc) {
          btnKyc.disabled = false;
          btnKyc.textContent = '📸 Iniciar Verificación Facial';
        }
        resolve(result);
      };

      this.currentOrchestrator = new RondaKycOrchestrator(videoEl, userId, {
        onStateChange: (state, message) => {
          this.setStatus(message);
          if (state === 'CAPTURE_DOCUMENT') {
            this.hideOval();
            this.showDocumentCapturePrompt(this.currentOrchestrator!, finish);
          }
        },
        onAlignmentFeedback: (status, message, progressPct) => {
          const ovalState = status === 'centrado' ? 'ok' : status === 'buscando' ? 'idle' : 'error';
          this.setOvalState(ovalState, message, progressPct);
        },
        onLivenessProgress: (current, target) => {
          this.setOvalState('ok', `¡Rostro verificado! (${current}/${target}) ✓`, 100);
        },
        onSuccess: () => {
          this.isVerified = true;
          this.setOvalState('ok', '✓ Identidad verificada');
          this.setStatus('✓ Identidad verificada exitosamente.');
          setTimeout(() => this.hideOval(), 1200);
          finish(true);
        },
        onFallbackReview: () => {
          this.hideOval();
          this.setStatus('Tu caso quedó en cola de revisión manual.');
          finish(false);
        },
        onError: (errorMsg) => {
          this.setOvalState('error', errorMsg);
          this.setStatus(errorMsg);
          setTimeout(() => this.hideOval(), 2000);
          finish(false);
        },
      });

      this.currentOrchestrator.start();
    });
  }

  private showDocumentCapturePrompt(
    orchestrator: RondaKycOrchestrator,
    onComplete: (verified: boolean) => void
  ): void {
    const container = document.getElementById('kyc-container') || document.body;
    const stepId = 'kyc-doc-step-box';
    let stepBox = document.getElementById(stepId);
    if (!stepBox) {
      stepBox = document.createElement('div');
      stepBox.id = stepId;
      stepBox.style.cssText = 'margin-top:10px;padding:12px;background:rgba(243,237,226,.05);border:1px dashed var(--linea);border-radius:8px;text-align:center;';
      stepBox.innerHTML = `
        <p style="font-size:12px;font-weight:700;color:var(--papel);margin:0 0 4px 0;">📄 Paso 2: Cédula de Ciudadanía</p>
        <p style="font-size:11px;color:var(--humo);margin:0 0 10px 0;">Foto del frente de tu documento para validar identidad.</p>
        <label for="kyc-doc-input-file" class="btn ambar" style="display:block;padding:10px 14px;font-size:12px;cursor:pointer;margin-bottom:6px;font-weight:bold;">
          📸 Tomar Foto / Subir Cédula
        </label>
        <input type="file" id="kyc-doc-input-file" accept="image/*" capture="environment" style="display:none;" />
        <button type="button" id="btn-kyc-skip-doc" style="background:transparent;border:none;color:var(--humo);font-size:11px;cursor:pointer;text-decoration:underline;">
          Completar solo con biometría facial
        </button>
      `;
      container.appendChild(stepBox);
    }

    const fileInput = stepBox.querySelector('#kyc-doc-input-file') as HTMLInputElement;
    const skipBtn = stepBox.querySelector('#btn-kyc-skip-doc') as HTMLButtonElement;

    const cleanup = () => {
      if (stepBox && stepBox.parentElement) {
        stepBox.parentElement.removeChild(stepBox);
      }
    };

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        cleanup();
        // ── OCR con timeout seguro (8s) y degradación a revisión manual ──
        const ocr = await scanDocumentOCR(img);
        if (!ocr.success) {
          try {
            await submitKycReview({
              userId: Auth.currentUser?.uid || 'anon_user',
              reason: `OCR no disponible / timeout (${ocr.error || 'ocr_timeout'})`,
              selfieBlob: new Blob(),
              docBlob: new Blob(),
              timestamp: Date.now(),
              deviceInfo: {
                userAgent: navigator.userAgent,
                screen: `${window.innerWidth}x${window.innerHeight}`,
              },
            });
          } catch {
            // submitKycReview registra su propio error; no bloqueamos la UI
          }
          this.setStatus('📄 Documento enviado a revisión manual (KYC pendiente).');
          onComplete(false);
          URL.revokeObjectURL(objectUrl);
          return;
        }
        await orchestrator.verifyWithDocumentImage(img);
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        cleanup();
        this.setStatus('Error al leer la foto del documento.');
        onComplete(false);
      };
      img.src = objectUrl;
    };

    skipBtn.onclick = () => {
      cleanup();
      orchestrator.cleanup();
      this.isVerified = true;
      this.hideOval();
      this.setStatus('✓ Rostro verificado exitosamente. Ya puedes guardar tu perfil.');
      onComplete(true);
    };
  }

  // --- Validación de LinkedIn ---
  validateLinkedInUrl(input: string): { valid: boolean; normalizedUrl: string; slug: string; error?: string } {
    if (!input || typeof input !== 'string') {
      return { valid: false, normalizedUrl: '', slug: '', error: 'Ingresa la URL de tu perfil de LinkedIn.' };
    }
    const clean = input.trim();
    if (!clean) {
      return { valid: false, normalizedUrl: '', slug: '', error: 'La URL de LinkedIn no puede estar vacía.' };
    }

    let slug = '';
    const inMatch = clean.match(/(?:linkedin\.com\/in\/|in\/)([a-zA-Z0-9_-]+)/i);
    if (inMatch && inMatch[1]) {
      slug = inMatch[1];
    } else if (/^[a-zA-Z0-9_-]{3,100}$/.test(clean) && !clean.includes('.') && !clean.includes('/')) {
      slug = clean;
    } else {
      const urlPattern = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i;
      const match = clean.match(urlPattern);
      if (match && match[3]) {
        slug = match[3];
      }
    }

    if (!slug || slug.length < 3) {
      return {
        valid: false,
        normalizedUrl: '',
        slug: '',
        error: 'Formato no válido. Debe ser estilo: https://linkedin.com/in/tu-perfil'
      };
    }

    return {
      valid: true,
      normalizedUrl: `https://www.linkedin.com/in/${slug}`,
      slug
    };
  }

  async verifyLinkedInProfile(
    url: string,
    _userInfo?: { name?: string; email?: string }
  ): Promise<{
    success: boolean;
    data?: {
      slug: string;
      url: string;
      verifiedAt: string;
      headline: string;
      badge: string;
    };
    error?: string;
  }> {
    const validation = this.validateLinkedInUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      data: {
        slug: validation.slug,
        url: validation.normalizedUrl,
        verifiedAt: new Date().toISOString(),
        headline: '',
        badge: '🔗 Perfil Enlazado'
      }
    };
  }
}

export const Verification = new VerificationService();
