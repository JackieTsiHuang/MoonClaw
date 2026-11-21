import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    // three.js is ~550 kB minified (≈140 kB gzip) and is already lazy-loaded.
    chunkSizeWarningLimit: 700,
  },
});
