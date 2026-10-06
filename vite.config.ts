import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
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
            { src: '/logo-samche.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
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
      // Disable HMR
      hmr: false,
      watch: (isProd || process.env.DISABLE_HMR === 'true') ? null : {},
    },
  };
});
