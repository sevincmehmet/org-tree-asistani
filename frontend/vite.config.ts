import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // React + framer-motion + d3 tek pakette ~520 kB (gzip ~170 kB); demo için kabul edilebilir.
  build: { chunkSizeWarningLimit: 700 },
})
