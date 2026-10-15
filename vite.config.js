import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
      react(),
    tailwindcss(),
  ],
  server: {
    // Express (npm run dev:server) serves /api on :3001.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
