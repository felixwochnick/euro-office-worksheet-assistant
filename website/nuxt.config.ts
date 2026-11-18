// Project website for GitHub Pages (static, prerendered) in 7 languages.
// The base URL is set by the Pages workflow: NUXT_APP_BASE_URL=/<repository>/
const SITE = 'https://felixwochnick.github.io/euro-office-worksheet-assistant'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },

  app: {
    head: {
      meta: [{ name: 'theme-color', content: '#4f46e5' }]
    }
  },

  // German at /, the other languages under /en/, /fr/ … – all prerendered.
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'de',
    baseUrl: SITE,
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch' },
      { code: 'en', language: 'en-US', name: 'English' },
      { code: 'fr', language: 'fr-FR', name: 'Français' },
      { code: 'es', language: 'es-ES', name: 'Español' },
      { code: 'it', language: 'it-IT', name: 'Italiano' },
      { code: 'nl', language: 'nl-NL', name: 'Nederlands' },
      { code: 'pl', language: 'pl-PL', name: 'Polski' }
    ],
    // Static hosting: suggest the browser language once (client side), never force it.
    detectBrowserLanguage: { useCookie: true, cookieKey: 'i18n_lang', redirectOn: 'root', alwaysRedirect: false }
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/en', '/fr', '/es', '/it', '/nl', '/pl']
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
