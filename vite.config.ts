import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Each game folder becomes its own lazily loaded chunk named game-<id>-<hash>.js,
// which lets scripts/size-budget.mjs check every game against its own budget.
const gameChunk = /[\\/]games[\\/]([^\\/]+)[\\/]index\.ts$/;

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        chunkFileNames: (c) => {
          const m = c.facadeModuleId?.match(gameChunk);
          return m ? `assets/game-${m[1]}-[hash].js` : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Bored Game',
        short_name: 'Bored',
        description: 'A pocket arcade of fidget toys and brain-rot mini games for the minutes you need to kill.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1d1238',
        theme_color: '#1d1238',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
});
