import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates favicon + PWA/Apple icons from public/logo.svg:
//   npm run icons
// Swap public/logo.svg for your company logo and re-run.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1d3254' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1d3254' } },
  },
  images: ['public/logo.svg'],
})
