import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3003';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: TARGET.replace('http://', 'ws://'),
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          vis: ['vis-network', 'vis-data'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});