// Project website for GitHub Pages (static, prerendered).
// The base URL is set by the Pages workflow: NUXT_APP_BASE_URL=/<repository>/
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Noten-Assistent für Euro-Office',
      meta: [
        { name: 'description', content: 'Notenzeilen für Arbeitsblätter in Euro-Office – per KI-Chat oder von Hand. Open-Source-Plugin für Nextcloud.' },
        { name: 'theme-color', content: '#4f46e5' }
      ]
    }
  },

  // Icons are bundled at build time (no requests to the Iconify API from the static site).
  icon: {
    serverBundle: { collections: ['lucide', 'simple-icons'] },
    clientBundle: { scan: true }
  },

  vite: {
    // The live demo imports the converter shared with the plugin (../shared/abc-tools.js).
    server: { fs: { allow: ['..'] } }
  }
})
