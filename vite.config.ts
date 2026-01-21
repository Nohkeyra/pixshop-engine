import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows your phone to access the server
    port: 5173,
    allowedHosts: 'all', // Fixes the "Blocked Request" error
    hmr: {
      clientPort: 443 // Ensures live updates work over HTTPS on your phone
    }
  }
});
