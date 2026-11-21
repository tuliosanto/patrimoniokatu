import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

/* Só em desenvolvimento: com DEMO_HISTORICO=/caminho/historico-consolidado.json, serve o arquivo em /__demo.json
   para o modo de demonstração (?demo). O caminho fica no ambiente, nunca no repositório. */
const demo = {
  name: 'demo-historico',
  apply: 'serve' as const,
  configureServer(server: { middlewares: { use: (p: string, f: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void; statusCode: number }) => void) => void } }) {
    server.middlewares.use('/__demo.json', (_req, res) => {
      const arq = process.env.DEMO_HISTORICO;
      if (!arq) { res.statusCode = 404; res.end('defina DEMO_HISTORICO'); return; }
      res.setHeader('Content-Type', 'application/json');
      res.end(readFileSync(arq, 'utf8'));
    });
  },
};

// Servido em https://tuliosanto.github.io/patrimoniokatu/
export default defineConfig({
  base: '/patrimoniokatu/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    demo,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icones/*.png'],
      manifest: {
        name: 'Nosso Patrimônio',
        short_name: 'Patrimônio',
        description: 'Os investimentos da família, mês a mês.',
        lang: 'pt-BR',
        start_url: '/patrimoniokatu/',
        scope: '/patrimoniokatu/',
        display: 'standalone',
        background_color: '#F4F1FA',
        theme_color: '#F4F1FA',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icones/icone-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /^https:\/\/(api|cdn)\.fontshare\.com\//, handler: 'CacheFirst',
            options: { cacheName: 'fontes', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'firebase', test: /node_modules[\\/]@?firebase/ }] } } },
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  test: { environment: 'node' },
});
