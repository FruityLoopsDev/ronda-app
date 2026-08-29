import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'

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
    https: {
      key: readFileSync(resolve(__dirname, 'certs/key.pem')),
      cert: readFileSync(resolve(__dirname, 'certs/cert.pem')),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
        invest: resolve(__dirname, 'invest.html'),
        artifact: resolve(__dirname, 'ronda-artifact.html'),
        faceVerify: resolve(__dirname, 'test/face-verify.html')
      }
    }
  }
})
