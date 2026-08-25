import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5000,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html')
      }
    }
  }
})
