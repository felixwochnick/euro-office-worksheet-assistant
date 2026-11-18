// Settings window of the desktop app: a static single-page app inside Tauri (no server, no network).
// `nuxt generate` writes it to .output/public, which Tauri embeds (src-tauri/tauri.conf.json → frontendDist).
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  ssr: false,
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  telemetry: false,

  app: {
    head: {
      title: 'Arbeitsblatt-Assistent',
      htmlAttrs: { lang: 'de' }
    }
  },

  // Tauri serves the files itself: hash routes need no server-side fallback.
  router: { options: { hashMode: true } },

  // The system font (a desktop app, offline) and icons bundled at build time (no Iconify API).
  ui: { fonts: false },
  icon: {
    provider: 'none',
    clientBundle: { scan: true, includeCustomCollections: true }
  },

  devServer: { port: 3000 },
  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    server: { strictPort: true, watch: { ignored: ['**/src-tauri/**'] } }
  },
  ignore: ['src-tauri/**']
})
