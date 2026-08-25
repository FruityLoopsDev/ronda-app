import { DB } from './db.js';
import { RondaConfig } from './firebase-config.js';

// verification.js: Módulo de Seguridad y Geolocalización
// Implementa Geolocalización, OCR (Tesseract.js) y Biometría facial (MediaPipe)

declare var Camera: any;
declare var FaceDetection: any;
declare var Tesseract: any;

class VerificationService {
  location: any = null;
  isVerified: boolean = false;
  camera: any = null;
  constructor() {
    this.location = null;
    this.isVerified = false;
  }

  // --- 1. Geolocalización ---
  async requestLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada por el navegador."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log("Ubicación obtenida:", this.location);
          resolve(this.location);
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error);
          reject(error);
        }
      );
    });
  }

  // Busca eventos cercanos basados en la ubicación (Simulado para MVP)
  async getNearbyEvents() {
    if (!this.location) await this.requestLocation();
    
    // Aquí se conectaría a Firebase GeoQueries (GeoFirestore o simular distancia)
    // Para el MVP, devolvemos el evento demo 'e1' del 'v1'
    if (RondaConfig.isDemo) {
       return [DB.memoryDb.events['e1']];
    }
    return [];
  }

  // --- 2. Verificación de Identidad (Biometría + OCR) ---
  
  // Carga dinámica de Tesseract y MediaPipe desde CDN
  async loadVerificationLibraries(): Promise<void> {
    console.log("Cargando librerías de seguridad (MediaPipe + Tesseract)...");
    
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Error cargando script: ${src}`));
        document.head.appendChild(script);
      });
    };

    try {
      await Promise.all([
        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js'),
        loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')
      ]);
      console.log("✓ Librerías de verificación biométrica y OCR cargadas correctamente.");
    } catch (err) {
      console.error("Error al cargar librerías de verificación:", err);
      throw err;
    }
  }

  async startVerification(videoElementId: string, canvasElementId: string) {
    if (RondaConfig.isDemo) {
      console.log("Modo Demo activo: Saltando verificación KYC real.");
      return new Promise(resolve => setTimeout(() => resolve(true), 1500));
    }
    
    await this.loadVerificationLibraries();
    
    const videoElement: any = document.getElementById(videoElementId);
    const canvasElement: any = document.getElementById(canvasElementId);
    
    if (!videoElement || !canvasElement) throw new Error("Elementos de video/canvas no encontrados");

    // Inicializar MediaPipe Face Detection
    const faceDetection = new FaceDetection({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    }});
    
    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5
    });
    
    return new Promise((resolve, reject) => {
      let isOcrRunning = false;

      faceDetection.onResults(async (results) => {
        // Dibujar resultados en canvas
        const canvasCtx = canvasElement.getContext('2d');
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        if (results.detections.length > 0) {
          // Se detectó un rostro
          const statusEl = document.getElementById('kyc-status');
          if (statusEl && !isOcrRunning) {
            statusEl.textContent = "Rostro detectado. Escaneando ID...";
          }

          if (!isOcrRunning) {
            isOcrRunning = true;
            try {
              const imageDataUrl = canvasElement.toDataURL('image/jpeg');
              const ocrResult = await this.scanDocumentOCR(imageDataUrl);
              
              if (ocrResult.success) {
                if (this.camera) this.camera.stop();
                resolve(true);
              } else {
                isOcrRunning = false;
              }
            } catch (err) {
              console.error("OCR Falló:", err);
              isOcrRunning = false;
            }
          }
        }
      });

      // Iniciar Cámara
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          await faceDetection.send({image: videoElement});
        },
        width: 640,
        height: 480
      });
      this.camera.start();
      console.log("Cámara iniciada para verificación real.");
    });
  }

  async scanDocumentOCR(imageBlobOrUrl) {
    console.log("Iniciando escaneo OCR con Tesseract...");
    const worker = await Tesseract.createWorker('spa');
    const ret = await worker.recognize(imageBlobOrUrl);
    console.log("Texto detectado:", ret.data.text);
    await worker.terminate();
    
    // Parseo de texto para validar cédula (CC de Colombia)
    const upperText = ret.data.text.toUpperCase();
    const isValid = upperText.includes("REPUBLICA DE COLOMBIA") || upperText.includes("CEDULA DE CIUDADANIA");
    return { success: isValid, rawText: ret.data.text };
  }
}

export const Verification = new VerificationService();
