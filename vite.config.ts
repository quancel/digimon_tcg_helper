import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site under /<repo-name>/
const base = process.env.GITHUB_PAGES ? '/digimon_tcg_helper/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Digimon Alysion Deckbuilder',
        short_name: 'Alysion DB',
        description: 'Kartendatenbank, Deckbuilder und Analysen für Digimon Alysion',
        theme_color: '#1b1f3b',
        background_color: '#0f1226',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Card data is cached for offline use; card images are cached on first view.
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'card-images', expiration: { maxEntries: 2000 } },
          },
        ],
      },
    }),
  ],
})
