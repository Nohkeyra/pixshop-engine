import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443
    }
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true
  }
})
