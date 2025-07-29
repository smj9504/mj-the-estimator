import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    open: true, // Auto-open browser
    hmr: {
      overlay: true // Show error overlay
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8001',  // Backend URL
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),  // Keep /api prefix
      },
    },
  },
  build: {
    sourcemap: true // Enable source maps for debugging
  }
})
