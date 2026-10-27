import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { defineConfig } from 'vite'

// Certs locales (gitignored): solo existen en la máquina de desarrollo.
const certKey = resolve(import.meta.dirname, 'certs/key.pem');
const certPem = resolve(import.meta.dirname, 'certs/cert.pem');
const hasCerts = existsSync(certKey) && existsSync(certPem);

export default defineConfig(({ command }) => ({
  // FASE 1: Limpieza para producción — ver `build.minify` (terser) más abajo.
  // Nota: en Vite 8 (Rolldown) `esbuild.drop` está deprecado/ignorado; la ruta
  // efectiva es terser con drop_console + drop_debugger, solo en `vite build`.
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
    // FASE 1: Limpieza para producción.
    // `command === 'build'` → aplica solo al build final (en dev se conservan logs).
    // terser elimina TODOS los console.* y debugger del bundle (equivalente al
    // `esbuild: { drop: ['console', 'debugger'] }` del brief, no soportado por Vite 8).
    ...(command === 'build' ? {
      minify: 'terser' as const,
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true },
        format: { comments: false },
      },
    } : {}),
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        superadmin: resolve(import.meta.dirname, 'superadmin.html'),
        crm: resolve(import.meta.dirname, 'crm.html'),
        network: resolve(import.meta.dirname, 'network.html'),
        landing: resolve(import.meta.dirname, 'landing.html'),
        invest: resolve(import.meta.dirname, 'invest.html'),
        partners: resolve(import.meta.dirname, 'partners.html'),
        artifact: resolve(import.meta.dirname, 'ronda-artifact.html'),
        faceVerify: resolve(import.meta.dirname, 'test/face-verify.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@vladmandic/face-api')) {
            return 'face-api';
          }
          if (id.includes('node_modules/html5-qrcode')) {
            return 'html5-qrcode';
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
        }
      }
    }
  }
}))
