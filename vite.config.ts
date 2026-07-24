import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'atlas-mark.svg'],
      manifest: {
        name: 'Atlas',
        short_name: 'Atlas',
        description: 'Plan trips day by day, then follow the route with no signal.',
        theme_color: '#070606',
        background_color: '#070606',
        display: 'standalone',
        icons: [{ src: '/atlas-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // The itinerary sheet and route line are the offline surface -- the
        // app shell is precached so a trip already open (and cached via
        // saveOfflineTrip) keeps rendering with no network at all, while
        // TomTom map tiles/style/routing get their own runtime cache below.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.tomtom\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tomtom-tiles',
              expiration: {
                maxEntries: 4000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: ['es2020', 'safari14'],
  },
})
