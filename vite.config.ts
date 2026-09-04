import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { defineConfig } from 'vite'

// Certs locales (gitignored): solo existen en la máquina de desarrollo.
// En CI no hay certs, así que el HTTPS del preview se activa solo si existen.
const certKey = resolve(__dirname, 'certs/key.pem');
const certPem = resolve(__dirname, 'certs/cert.pem');
const hasCerts = existsSync(certKey) && existsSync(certPem);

export default defineConfig({
  server: {
    host: true,
    port: 5000,
    strictPort: true,
    watch: {
      // Modelos de face-api: no vigilar (son binarios grandes y causan EBUSY en el watcher);
      // se sirven igual desde public/.
      ignored: ['**/public/models/**']
    }
  },
  preview: {
    host: true,
    port: 5000,
    // HTTPS local con certificado autofirmado: necesario para que getUserMedia
    // (cámara) funcione en el móvil fuera de localhost.
    ...(hasCerts ? {
      https: {
        key: readFileSync(certKey),
        cert: readFileSync(certPem),
      },
    } : {}),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
        invest: resolve(__dirname, 'invest.html'),
        partners: resolve(__dirname, 'partners.html'),
        artifact: resolve(__dirname, 'ronda-artifact.html'),
        faceVerify: resolve(__dirname, 'test/face-verify.html')
      }
    }
  }
})
