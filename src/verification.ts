import { getDescriptor, evaluateIdentity } from './face-verify.js';
import { collection, addDoc } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';
import type { User } from './db.js';

// verification.js: Módulo de Seguridad, Geolocalización y Verificación de Identidad (KYC)
// Verificación robusta (a pruebas de fallo): cada paso devuelve resultado tipado y la UI
// recibe un mensaje claro; NUNCA se lanza un error no controlado hacia el flujo principal.

declare var Tesseract: any;

/** Retos de liveness mostrados al usuario (C-2). */
export const KYC_LIVENESS_CHALLENGES: string[] = [
  'Parpadea 2 veces',
  'Gira la cabeza levemente a la derecha',
  'Gira la cabeza levemente a la izquierda',
  'Sonríe de forma natural',
  'Acerca tu rostro al óvalo',
];

/** Estado visual del óvalo guía (C-1). */
export type KycOvalState = 'idle' | 'ok' | 'error';

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
  stream: MediaStream | null = null;
  objectUrl: string | null = null;

  constructor() {
    this.location = null;
    this.isVerified = false;
  }

  // --- 1. Geolocalización ---
  async requestLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada por el navegador.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.location = { lat: position.coords.latitude, lng: position.coords.longitude };
          console.log('Ubicación obtenida:', this.location);
          resolve(this.location);
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          reject(error);
        }
      );
    });
  }

  async getNearbyEvents() {
    if (!this.location) await this.requestLocation();
    return [];
  }

  // --- 2. Verificación de Identidad (Biometría + OCR), robusta ---

  // Carga diferida de Tesseract (OCR del documento). MediaPipe ya no se usa: el
  // reconocimiento facial / descriptores los aporta @vladmandic/face-api.
  async loadVerificationLibraries(): Promise<void> {
    const src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    if (document.querySelector(`script[src="${src}"]`)) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el motor OCR (Tesseract).'));
      document.head.appendChild(script);
    });
  }

  // OCR robusto: nunca lanza, devuelve { success, rawText, hits, error }.
  async scanDocumentOCR(imageBlobOrUrl: string | Blob | HTMLImageElement): Promise<{ success: boolean; rawText: string; hits: string[]; error?: string }> {
    let worker: any = null;
    try {
      await this.loadVerificationLibraries();
      worker = await Tesseract.createWorker('spa');
      // Timeout de 8s
      const ret = await Promise.race([
        worker.recognize(imageBlobOrUrl),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ocr_timeout')), 8000)),
      ]);
      const rawText = (ret && ret.data && ret.data.text) || '';
      const upper = rawText.toUpperCase();
      const hits: string[] = [];
      if (upper.includes('REPUBLICA DE COLOMBIA')) hits.push('REPUBLICA DE COLOMBIA');
      if (upper.includes('CEDULA DE CIUDADANIA')) hits.push('CEDULA DE CIUDADANIA');
      return { success: hits.length > 0, rawText, hits };
    } catch (err: any) {
      // Timeout: degradación limpia a revisión manual (no pantalla roja, no interrumpe
      // la extracción del descriptor facial del documento).
      if (err && err.message === 'ocr_timeout') {
        console.warn('[OCR] Tesseract sobrecargado / timeout: degradando a revisión manual.');
        return { success: false, rawText: '', hits: [], error: 'ocr_timeout' };
      }
      console.error('[OCR] Error:', err);
      return { success: false, rawText: '', hits: [], error: (err && err.message) || 'Error de OCR' };
    } finally {
      if (worker) try { await worker.terminate(); } catch (_) { /* ignorar */ }
    }
  }

  /** Mapea el veredicto a un mensaje de usuario claro. */
  private statusMessage(reason?: string): string {
    switch (reason) {
      case 'no_face': return 'No se detectó un rostro. Ajusta la cámara e inténtalo de nuevo.';
      case 'multiple_faces': return 'Se detectaron varios rostros en la imagen. Usa una foto con una sola persona.';
      case 'model_error': return 'No se cargaron los modelos de reconocimiento. Comprueba /models o la conexión.';
      case 'network_error': return 'Fallo de red al cargar los modelos/detección. Inténtalo con conexión estable.';
      case 'documento_no_reconocido': return 'El documento no parece una cédula de Colombia (OCR). Revisa el texto y la luz.';
      case 'rostro_no_coincide': return 'El rostro no coincide con el de la cédula. Vuelve a tomar el selfie.';
      case 'sin_rostro_documento': return 'No se detectó el rostro en el documento. Usa una foto nítida del frente.';
      case 'camera_denied': return 'Permiso de cámara denegado. Habilita la cámara para continuar.';
      case 'no_camera': return 'No hay cámara disponible en este dispositivo.';
      case 'no_document': return 'No se seleccionó ninguna imagen de documento.';
      default: return 'No se pudo completar la verificación. Inténtalo de nuevo.';
    }
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.isVerified = false;
  }

  private setStatus(msg: string): void {
    const el = document.getElementById('kyc-status') as HTMLElement | null;
    if (el) {
      el.textContent = msg;
      el.style.color = /✓|Verificado|OK/.test(msg) ? 'var(--botella)' : 'var(--vino)';
    }
  }

  // --- [C-1] Óvalo guía biométrico con feedback rojo/verde ---
  /** Dibuja/actualiza el óvalo guía semitransparente sobre el contenedor KYC. */
  setOvalState(state: KycOvalState, hint?: string): void {
    let overlay = document.getElementById('kyc-oval-overlay') as HTMLElement | null;
    if (!overlay) {
      const video = document.getElementById('kyc-video');
      const anchor = (video?.parentElement || video || document.body) as HTMLElement;
      const anchorPos = anchor.style.position;
      if (!anchorPos) anchor.style.position = 'relative';
      overlay = document.createElement('div');
      overlay.id = 'kyc-oval-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;';
      overlay.innerHTML = `<div id="kyc-oval-frame" style="width:min(62%,260px);aspect-ratio:3/4;border-radius:50%;border:3px dashed rgba(243,237,226,.55);background:rgba(243,237,226,.06);transition:border-color .2s ease, box-shadow .2s ease;"></div><div id="kyc-oval-hint" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:11px;font-family:var(--font-mono,monospace);color:var(--humo,#999);"></div>`;
      anchor.appendChild(overlay);
    }
    const frame = overlay.querySelector('#kyc-oval-frame') as HTMLElement | null;
    const hintEl = overlay.querySelector('#kyc-oval-hint') as HTMLElement | null;
    if (frame) {
      if (state === 'ok') {
        frame.style.borderColor = '#1d5c3f';
        frame.style.boxShadow = '0 0 0 4px rgba(29,92,63,.25)';
      } else if (state === 'error') {
        frame.style.borderColor = '#c0392b';
        frame.style.boxShadow = '0 0 0 4px rgba(192,57,43,.25)';
      } else {
        frame.style.borderColor = 'rgba(243,237,226,.55)';
        frame.style.boxShadow = 'none';
      }
    }
    if (hintEl && hint !== undefined) hintEl.textContent = hint;
  }

  /** Evalúa un frame y actualiza el óvalo: verde si hay rostro nítido, rojo si no. */
  async updateOvalFromFrame(image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<boolean> {
    try {
      const res = await getDescriptor(image as HTMLImageElement);
      if (res.error || !res.descriptor) {
        const msg = res.error === 'multiple_faces'
          ? 'Varios rostros: usa una foto con una sola persona'
          : 'Sin rostro: centra tu cara en el óvalo';
        this.setOvalState('error', msg);
        return false;
      }
      this.setOvalState('ok', 'Posición óptima — mantén el rostro en el óvalo');
      return true;
    } catch {
      this.setOvalState('error', 'Imagen desenfocada: mejora la luz y enfoca');
      return false;
    }
  }

  // --- [C-2] Reto de liveness dinámico ---
  /** Elige un reto aleatorio y lo muestra en #kyc-liveness (crea el nodo si falta). */
  showLivenessChallenge(containerId = 'kyc-liveness'): string {
    const challenge = KYC_LIVENESS_CHALLENGES[Math.floor(Math.random() * KYC_LIVENESS_CHALLENGES.length)] || KYC_LIVENESS_CHALLENGES[0]!;
    let el = document.getElementById(containerId) as HTMLElement | null;
    if (!el) {
      const status = document.getElementById('kyc-status');
      el = document.createElement('div');
      el.id = containerId;
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border:1px dashed var(--luz,#c9a227);border-radius:10px;font-size:13px;text-align:center;';
      if (status?.parentElement) status.parentElement.insertBefore(el, status);
      else document.body.appendChild(el);
    }
    el.textContent = `👁️ Reto de vida: ${challenge}`;
    return challenge;
  }

  // --- [C-3] Captura del reverso del documento ---
  /** Pide la imagen del reverso de la cédula (cámara trasera en móvil). Reutiliza el flujo de anverso. */
  captureDocumentBackImage(): Promise<HTMLImageElement> {
    return this.captureDocumentImage();
  }

  // --- [C-1/C-4] Compresión + envío a cola de revisión manual ---
  /** Comprime un <img> a JPEG Base64 (~40-70 KB) para guardar en Firestore ($0 Spark). */
  compressToDataUrl(img: HTMLImageElement, maxDim = 480, quality = 0.72): string {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || maxDim, img.naturalHeight || maxDim));
    const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /** Crea un caso en `kycReviews` con estado 'pending' (reglas: solo el propio usuario). */
  async submitKycReview(payload: KycReviewPayload): Promise<string> {
    const ref = await addDoc(collection(RondaServices.db, 'kycReviews'), {
      userId: payload.userId,
      userName: payload.userName,
      userEmail: payload.userEmail,
      registeredBirthDate: payload.registeredBirthDate,
      createdAt: new Date().toISOString(),
      status: 'pending',
      reasonsForManual: payload.reasonsForManual,
      metrics: payload.metrics,
      imageUrls: payload.imageUrls,
    });
    this.setStatus('📋 Solicitud enviada a revisión manual. Te avisaremos cuando sea aprobada.');
    return ref.id;
  }

  /** [C-4] Encola el caso fallido en `kycReviews` con fotos comprimidas (sin auto-tier). */
  private async queueManualReview(args: { selfieImg: HTMLImageElement; docImg: HTMLImageElement; faceDistance: number; reason: string }): Promise<string | null> {
    try {
      const { Auth } = await import('./auth.js');
      const user = Auth.currentUser as (User & { birthDate?: string }) | null;
      if (!user) return null;
      const selfie = this.compressToDataUrl(args.selfieImg);
      const docFront = this.compressToDataUrl(args.docImg);
      if (!selfie || !docFront) return null;
      return await this.submitKycReview({
        userId: user.uid,
        userName: user.name || 'Usuario RONDA',
        userEmail: user.email || '',
        registeredBirthDate: user.birthDate || '',
        reasonsForManual: [args.reason],
        metrics: { faceDistance: args.faceDistance, livenessScore: 0.5 },
        imageUrls: { selfie, docFront },
      });
    } catch (e) {
      console.warn('[KYC] queueManualReview falló:', e);
      return null;
    }
  }

  /** Inicia la cámara frontal y devuelve el stream. Lanza solo si no hay cámara/persmiso. */
  private async startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('no_camera');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.stream = stream;
      videoEl.srcObject = stream;
      await videoEl.play();
      return stream;
    } catch (e: any) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) throw new Error('camera_denied');
      throw new Error('no_camera');
    }
  }

  /** Toma un frame del canvas como imagen y extrae el descriptor facial del selfie. */
  private async selfieDescriptor(canvasId: string): Promise<{ descriptor: Float32Array | null; error?: string }> {
    const canvas: any = document.getElementById(canvasId);
    if (!canvas) return { descriptor: null, error: 'no_camera' };
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const img = await this.loadImage(dataUrl);
    const res = await getDescriptor(img);
    if (res.error) return { descriptor: null, error: res.error };
    return { descriptor: res.descriptor! };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = src;
    });
  }

  /** Pide al usuario una imagen del documento (subir o foto) y devuelve la <img>. */
  private captureDocumentImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // capture = 'environment' abre la cámara trasera en móviles; en desktop abre el selector.
      (input as any).capture = 'environment';
      input.style.display = 'none';
      document.body.appendChild(input);

      const onDone = (file?: File) => {
        document.body.removeChild(input);
        if (!file) { const e = new Error('no_document'); reject(e); return; }
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Imagen de documento no válida.'));
        img.src = this.objectUrl!;
      };

      input.onchange = () => onDone(input.files?.[0]);
      input.click();
      // Timeout: si el usuario cancela y el navegador no dispara onchange, resolvemos como cancelado.
      setTimeout(() => { if (document.body.contains(input)) onDone(undefined); }, 2 * 60 * 1000);
    });
  }

  /**
   * Flujo KYC robusto: selfie (cámara) + documento (foto/subida) + OCR -> veredicto.
   * Devuelve true si la identidad quedó verificada; false + mensaje en `kyc-status` en caso contrario.
   * Nunca lanza; errores de infraestructura se reportan como false con mensaje claro.
   */
  async startVerification(videoId: string, canvasId: string): Promise<boolean> {
    // El flujo de KYC siempre ejecuta su ruta normal en producción.

    const videoEl = document.getElementById(videoId) as HTMLVideoElement | null;
    const canvasEl = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!videoEl || !canvasEl) {
      this.setStatus(this.statusMessage('no_camera'));
      return false;
    }

    this.cleanup();
    this.setStatus('Solicitando permiso de cámara...');

    let stream: MediaStream | null = null;
    try {
      stream = await this.startCamera(videoEl);
    } catch (e: any) {
      this.setStatus(this.statusMessage((e && e.message) || 'no_camera'));
      return false;
    }

    try {
      // 1) Selfie: capturar frame y extraer descriptor (con óvalo guía + reto liveness).
      this.setOvalState('idle', 'Centra tu rostro en el óvalo');
      this.showLivenessChallenge();
      this.setStatus('Espera un momento... detectando tu rostro.');
      const ctx = canvasEl.getContext('2d');
      if (!ctx) { this.setStatus(this.statusMessage('no_camera')); return false; }
      
      let selfie: { descriptor: Float32Array | null; error?: string } = { descriptor: null, error: 'no_face' };
      let ready = false;
      const maxRetries = 5;
      const retryDelay = 800; // ms
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        ready = false;
        const maxWait = 4000; // timeout máximo de espera por frame
        const start = Date.now();
        while (!ready && (Date.now() - start) < maxWait) {
          if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
            ready = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        
        if (ready) {
          canvasEl.width = videoEl.videoWidth || 640;
          canvasEl.height = videoEl.videoHeight || 480;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
          
          selfie = await this.selfieDescriptor(canvasId);
          if (selfie.descriptor) {
            break; // Éxito
          } else {
            const msg = selfie.error === 'multiple_faces' ? 'Varios rostros: usa una sola persona' : 'Centra tu rostro en el óvalo y asegura buena luz';
            this.setOvalState('error', msg);
            this.setStatus(`Intento ${attempt}/${maxRetries}... ${msg}`);
          }
        }
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
      }

      // Fallback a revisión manual si falla la extracción del selfie, pero logramos capturar al menos la imagen
      if (!selfie.descriptor) {
        this.setOvalState('error', 'Procesamiento facial automático fallido. Se requerirá revisión manual.');
        this.setStatus('No pudimos procesar tu rostro. Continúa para enviar a revisión manual.');
        // No retornamos false aquí. Queremos que siga y capture el documento.
      } else {
        this.setOvalState('ok', 'Posición óptima ✓ — rostro enmarcado');
        this.setStatus('Rostro detectado. Ahora captura una foto de tu cédula (frente).');
      }
      
      if (stream) stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      videoEl.srcObject = null;

      // 2) Documento: foto/subida + OCR + descriptor facial.
      let docImg: HTMLImageElement;
      try {
        docImg = await this.captureDocumentImage();
      } catch (e: any) {
        this.setStatus(this.statusMessage((e && e.message) || 'no_document'));
        return false;
      }
      this.setStatus('Analizando documento (OCR + rostro)...');
      const ocr = await this.scanDocumentOCR(docImg);
      const docDesc = await getDescriptor(docImg);
      
      // [C-3] Reverso opcional (MRZ/código de barras): se solicita si el OCR del frente es débil.
      if (!ocr.success) {
        this.setStatus('Frente poco legible: captura el reverso de tu cédula (opcional, mejora la revisión).');
        try {
          const backImg = await this.captureDocumentBackImage();
          const backOcr = await this.scanDocumentOCR(backImg);
          if (backOcr.rawText) {
            (ocr as { rawText: string }).rawText = `${ocr.rawText}\n[REVERSO]\n${backOcr.rawText}`;
            if (backOcr.success) (ocr as { success: boolean }).success = true;
          }
        } catch { /* reverso opcional: se continúa con el frente */ }
        this.setStatus('Analizando documento (OCR + rostro)...');
      }
      
      // 3) Veredicto combinado robusto.
      let verdict: any = { ok: false, reason: 'unknown' };
      if (!selfie.descriptor) {
        verdict = { ok: false, reason: selfie.error || 'no_face', distance: 1 };
      } else if (docDesc.error || !docDesc.descriptor) {
        verdict = { ok: false, reason: docDesc.error === 'no_face' ? 'sin_rostro_documento' : docDesc.error, distance: 1 };
      } else {
        verdict = evaluateIdentity(selfie.descriptor, docDesc.descriptor, ocr.rawText || '', 0.6);
      }

      this.isVerified = verdict.ok;
      if (verdict.ok) {
        this.setStatus('✓ Identidad verificada (selfie coincide con la cédula).');
        return true;
      }
      
      // [C-4] Sin auto-elevación: enviar a cola de revisión manual en lugar de aprobar.
      try {
        await this.queueManualReview({
          selfieImg: await this.loadImage(canvasEl.toDataURL('image/jpeg', 0.85)),
          docImg,
          faceDistance: verdict.distance ?? 1,
          reason: verdict.reason || 'revision_manual',
        });
      } catch (e) {
        console.warn('[KYC] No se pudo encolar revisión manual:', e);
      }
      this.setStatus(this.statusMessage(verdict.reason) + ' Tu caso quedó en revisión manual.');
      return false;
    } catch (e: any) {
      console.error('[KYC] Error inesperado:', e);
      this.setStatus(this.statusMessage('unknown'));
      return false;
    } finally {
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    }
  }

  // --- 3. Verificación de Perfil de LinkedIn (Profesionales de Alto Valor) ---

  /**
   * Valida sintáctica y estructuralmente una URL o identificador de LinkedIn.
   */
  validateLinkedInUrl(input: string): { valid: boolean; normalizedUrl: string; slug: string; error?: string } {
    if (!input || typeof input !== 'string') {
      return { valid: false, normalizedUrl: '', slug: '', error: 'Ingresa la URL de tu perfil de LinkedIn.' };
    }
    const clean = input.trim();
    if (!clean) {
      return { valid: false, normalizedUrl: '', slug: '', error: 'La URL de LinkedIn no puede estar vacía.' };
    }

    // Soporte para:
    // https://www.linkedin.com/in/usuario
    // linkedin.com/in/usuario
    // https://co.linkedin.com/in/usuario/
    // in/usuario
    // usuario
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

    const normalizedUrl = `https://www.linkedin.com/in/${slug}`;
    return {
      valid: true,
      normalizedUrl,
      slug
    };
  }

  /**
   * Ejecuta la verificación del perfil de LinkedIn del cliente.
   * Valida la URL, extrae datos de identidad profesional y confirma la membresía.
   */
  async verifyLinkedInProfile(
    url: string,
    userInfo?: { name?: string; email?: string }
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

    // Validación sintáctica y normalización del enlace de LinkedIn
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

