# Update it:
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: 'all',
    hmr: {
      clientPort: 443,
      host: 'fa1efae0-4af2-447f-8e60-c99af976ee56-00-1wn0ihjy86qy7.sisko.replit.dev'
    }
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: 'all'
  }
})
EOF