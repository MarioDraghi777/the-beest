import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Con HTTPS_DEV=1 il server di sviluppo parla https con un certificato
 * autofirmato. Serve per provare dal telefono: Web Share, appunti, Wake Lock
 * e installazione PWA esistono solo in contesto sicuro, e "sicuro" significa
 * https oppure localhost — un indirizzo di rete locale in http non basta.
 * Safari mostrerà un avviso sul certificato: si procede e basta.
 */
const httpsDev = process.env.HTTPS_DEV === '1';

/**
 * In sviluppo serve la cartella media-build/ su /media-local, così si lavora
 * con le animazioni vere senza doverle pubblicare e senza infilare 43 MB
 * dentro dist/. In produzione i media arrivano da VITE_MEDIA_BASE.
 */
function localMedia(): Plugin {
  const dir = path.resolve('media-build');
  return {
    name: 'the-beest-local-media',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/media-local', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const file = path.join(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// App statica pura: nessun target server-side, nessun database remoto.
// Tutto vive nel browser di chi la usa.
export default defineConfig({
  plugins: [
    ...(httpsDev ? [basicSsl()] : []),
    localMedia(),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'The Beest',
        short_name: 'The Beest',
        description: 'Schede, piano annuale e allenamenti, con 1.324 esercizi. Funziona offline.',
        lang: 'it',
        theme_color: '#0B0A07',
        background_color: '#0B0A07',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Il catalogo (circa 980 KB, 120 in gzip) entra nel precache: deve
        // essere disponibile offline al primo avvio, è il cuore dell'app.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // I media stanno su un dominio separato e NON vanno in precache:
            // 43 MB non si scaricano all'installazione. Si accumulano man mano
            // che guardi gli esercizi, e restano disponibili offline dopo.
            urlPattern: /the-beest-media.*\.(webp|gif|jpg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Necessario per GitHub Pages: il sito è servito da un sottopercorso.
  base: './',
});
