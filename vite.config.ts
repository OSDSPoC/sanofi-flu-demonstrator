import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any GitHub Pages project sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { watch: { usePolling: true, interval: 250 } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
