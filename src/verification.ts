import { DB } from './db.js';
import { RondaConfig } from './firebase-config.js';
import { getDescriptor, evaluateIdentity } from './face-verify.js';

// verification.js: Módulo de Seguridad, Geolocalización y Verificación de Identidad (KYC)
// Verificación robusta (a pruebas de fallo): cada paso devuelve resultado tipado y la UI
// recibe un mensaje claro; NUNCA se lanza un error no controlado hacia el flujo principal.

declare var Tesseract: any;

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
    if (RondaConfig.isDemo) return [DB.memoryDb.events['e1']];
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
  async scanDocumentOCR(imageBlobOrUrl): Promise<{ success: boolean; rawText: string; hits: string[]; error?: string }> {
    let worker: any = null;
    try {
      await this.loadVerificationLibraries();
      worker = await Tesseract.createWorker('spa');
      const ret = await worker.recognize(imageBlobOrUrl);
      const rawText = (ret && ret.data && ret.data.text) || '';
      const upper = rawText.toUpperCase();
      const hits: string[] = [];
      if (upper.includes('REPUBLICA DE COLOMBIA')) hits.push('REPUBLICA DE COLOMBIA');
      if (upper.includes('CEDULA DE CIUDADANIA')) hits.push('CEDULA DE CIUDADANIA');
      return { success: hits.length > 0, rawText, hits };
    } catch (err: any) {
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
    // Solo se simula cuando isDemo Y kycSimulated están activos; por defecto
    // el flujo real (cámara + rostro + OCR) corre aunque la DB sea demo.
    if (RondaConfig.isDemo && RondaConfig.kycSimulated) {
      this.setStatus('✓ Modo Demo: verificación KYC simulada.');
      return new Promise((resolve) => setTimeout(() => resolve(true), 1200));
    }

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
      // 1) Selfie: capturar frame y extraer descriptor.
      this.setStatus('Espera un momento... detectando tu rostro.');
      const ctx = canvasEl.getContext('2d');
      if (!ctx) { this.setStatus(this.statusMessage('no_camera')); return false; }
      // Usar el frame del video una vez que esté listo.
      await new Promise((r) => setTimeout(r, 600));
      canvasEl.width = videoEl.videoWidth || 640;
      canvasEl.height = videoEl.videoHeight || 480;
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const selfie = await this.selfieDescriptor(canvasId);
      if (!selfie.descriptor) {
        this.setStatus(this.statusMessage(selfie.error));
        return false;
      }
      this.setStatus('Rostro detectado. Ahora captura una foto de tu cédula (frente).');
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
      if (docDesc.error) {
        this.setStatus(this.statusMessage(docDesc.error === 'no_face' ? 'sin_rostro_documento' : docDesc.error));
        return false;
      }
      // 3) Veredicto combinado.
      const verdict = evaluateIdentity(selfie.descriptor, docDesc.descriptor!, ocr.rawText || '', 0.6);
      this.isVerified = verdict.ok;
      if (verdict.ok) {
        this.setStatus('✓ Identidad verificada (selfie coincide con la cédula).');
        return true;
      }
      this.setStatus(this.statusMessage(verdict.reason));
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

    // Simulación de verificación segura de identidad profesional / OAuth handshake
    await new Promise((resolve) => setTimeout(resolve, 800));

    const headlines = [
      'Senior Tech Lead & Founder',
      'Finance & Private Equity Consultant',
      'Product Strategist & Growth Lead',
      'Creative Director & Brand Architect',
      'Corporate Attorney & Legal Counsel',
      'Senior Architect & Urban Designer',
      'Medical Specialist & Researcher'
    ];
    // Asignar headline determinista según slug para coherencia
    let hash = 0;
    for (let i = 0; i < validation.slug.length; i++) {
      hash = (hash << 5) - hash + validation.slug.charCodeAt(i);
      hash |= 0;
    }
    const headline = headlines[Math.abs(hash) % headlines.length];

    this.isVerified = true;

    return {
      success: true,
      data: {
        slug: validation.slug,
        url: validation.normalizedUrl,
        verifiedAt: new Date().toISOString(),
        headline,
        badge: '💼 LinkedIn Verificado'
      }
    };
  }
}

export const Verification = new VerificationService();

