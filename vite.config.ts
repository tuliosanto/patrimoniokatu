import { defineConfig } from 'vite';

// O site é servido em https://tuliosanto.github.io/patrimoniokatu/
export default defineConfig({
  base: '/patrimoniokatu/',
  build: {
    target: 'es2022',
    sourcemap: true,
    // O Firebase muda pouco: em arquivo separado, o navegador o mantém em cache entre versões do app.
    rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } } },
    chunkSizeWarningLimit: 700,
  },
});
