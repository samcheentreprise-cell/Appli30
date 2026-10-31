import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString();
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Couvoir SAMCHE',
          short_name: 'SAMCHE',
          description: 'Application mobile de gestion pour le Couvoir SAMCHE',
          theme_color: '#1a5276',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      // ✅ CORRECTION v1.2.7 : désactiver EXPLICITEMENT le HMR pour Cloud Run
      //    (le WebSocket de Vite n'est pas supporté par Cloud Run).
      //    Note : `middlewareMode` est forcé à `true` côté server.ts,
      //    on ne peut donc pas le désactiver ici — l'erreur résiduelle
      //    est supprimée côté client via index.html.
      hmr: false,
      watch: null, // Toujours null — désactive le watcher de fichiers (inutile sur Cloud Run)
    },
  };
});
