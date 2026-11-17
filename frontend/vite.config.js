import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // En Windows el plugin compara la ruta de public/ con la unidad en otra
      // mayúscula ("c:" contra "C:"), no la encuentra y sobrescribe las fotos
      // originales de public/ en vez de las copias de dist/. Cada build les
      // quitaba calidad. Vercel compila en Linux, así que allá sí se optimizan.
      includePublic: process.platform !== 'win32',
      jpg:  { quality: 70 },
      jpeg: { quality: 70 },
      png:  { quality: 70 },
      webp: { quality: 70 },
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
