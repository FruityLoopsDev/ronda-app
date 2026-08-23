// verification.js: Módulo de Seguridad y Geolocalización
// Implementa Geolocalización, OCR (Tesseract.js) y Biometría facial (MediaPipe)

class VerificationService {
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
    if (window.RondaConfig.isDemo) {
       return [window.DB.memoryDb.events['e1']];
    }
    return [];
  }

  // --- 2. Verificación de Identidad (Biometría + OCR) ---
  
  // Carga dinámica de Tesseract y MediaPipe desde CDN
  async loadVerificationLibraries() {
    console.log("Cargando librerías de seguridad...");
    await window.loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    await window.loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
    await window.loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js");
    console.log("Librerías cargadas.");
  }

  async startVerification(videoElementId, canvasElementId) {
    await this.loadVerificationLibraries();
    
    const videoElement = document.getElementById(videoElementId);
    const canvasElement = document.getElementById(canvasElementId);
    
    if (!videoElement || !canvasElement) throw new Error("Elementos de video/canvas no encontrados");

    // Inicializar MediaPipe Face Detection
    const faceDetection = new FaceDetection({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    }});
    
    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5
    });
    
    faceDetection.onResults((results) => {
      // Dibujar resultados en canvas y verificar si hay una persona viva
      const canvasCtx = canvasElement.getContext('2d');
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
      
      if (results.detections.length > 0) {
        // Se detectó un rostro
        console.log("Rostro detectado. Procediendo a validar vivo/falso...");
        // TODO: Lógica adicional anti-spoofing
      }
    });

    // Iniciar Cámara
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceDetection.send({image: videoElement});
      },
      width: 640,
      height: 480
    });
    camera.start();
    console.log("Cámara iniciada para verificación.");
  }

  async scanDocumentOCR(imageBlobOrUrl) {
    console.log("Iniciando escaneo OCR con Tesseract...");
    const worker = await Tesseract.createWorker('spa');
    const ret = await worker.recognize(imageBlobOrUrl);
    console.log("Texto detectado:", ret.data.text);
    await worker.terminate();
    
    // Parseo de texto para validar cédula (CC de Colombia)
    const isValid = ret.data.text.includes("REPUBLICA DE COLOMBIA") || ret.data.text.includes("CEDULA DE CIUDADANIA");
    return { success: isValid, rawText: ret.data.text };
  }
}

window.Verification = new VerificationService();
