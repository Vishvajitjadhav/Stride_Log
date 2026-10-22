import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',          // show "new version available" instead of silently reloading
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'StrideLog Daily Work Tracker',
        short_name: 'StrideLog',
        description: 'Log your daily tasks and see your team’s weekly progress.',
        id: '/',
        theme_color: '#f6f7fc',
        background_color: '#f6f7fc',
        display: 'standalone',
        // Any: phones stay portrait by habit, tablets and desktops can rotate.
        orientation: 'any',
        categories: ['business', 'productivity'],
        start_url: '/today',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'My Day', url: '/today', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Team', url: '/team', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Reports', url: '/reports', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // App shell is precached; API calls always go to the network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Rarely used heavy chunks (PDF engine, Excel parser) load on demand instead.
        globIgnores: ['**/react-pdf*.js', '**/ImportData*.js', '**/ReportDocument*.js', '**/xlsx*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//, /^\/functions\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-chunks', expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/branding/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'branding' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
