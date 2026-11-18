<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { de, en, es, fr, it, nl, pl } from '@nuxt/ui/locale'

const REPO = 'https://github.com/felixwochnick/eurooffice-music-notation-plugin'
const baseURL = useRuntimeConfig().app.baseURL
const c = useContent()
const { locale, setLocale } = useI18n()

// <html lang>, canonical and hreflang alternates for every language.
const localeHead = useLocaleHead({ seo: true })
useHead(() => ({
  htmlAttrs: { lang: localeHead.value.htmlAttrs?.lang },
  link: [{ rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` }, ...(localeHead.value.link ?? [])],
  meta: [...(localeHead.value.meta ?? [])],
  title: c.value.meta.title
}))
useSeoMeta({
  description: () => c.value.meta.description,
  ogTitle: () => c.value.meta.title,
  ogDescription: () => c.value.meta.description,
  ogImage: `https://felixwochnick.github.io${baseURL}img/og.png`,
  twitterCard: 'summary_large_image'
})

const items = computed<NavigationMenuItem[]>(() => [
  { label: c.value.nav.features, to: '#features' },
  { label: c.value.nav.ways, to: '#ways' },
  { label: c.value.nav.mcp, to: '#mcp' },
  { label: c.value.nav.demo, to: '#demo' },
  { label: c.value.nav.install, to: '#install' },
  { label: c.value.nav.faq, to: '#faq' }
])
const uiLocales = [de, en, fr, es, it, nl, pl]
</script>

<template>
  <UApp>
    <UHeader :to="$localePath('/')">
      <template #title>
        <span class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-file-pen-line" class="size-6 text-primary" />
          {{ locale === 'de' ? 'Arbeitsblatt-Assistent' : 'Worksheet Assistant' }}
        </span>
      </template>

      <UNavigationMenu :items="items" variant="link" />

      <template #right>
        <ULocaleSelect
          :model-value="locale"
          :locales="uiLocales"
          :aria-label="c.nav.language"
          size="sm"
          variant="ghost"
          class="hidden w-36 sm:flex"
          @update:model-value="setLocale($event as typeof locale)"
        />
        <UColorModeButton />
        <UButton :to="REPO" target="_blank" icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub" />
      </template>

      <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
        <ULocaleSelect
          :model-value="locale"
          :locales="uiLocales"
          :aria-label="c.nav.language"
          class="mt-4 w-full"
          @update:model-value="setLocale($event as typeof locale)"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          {{ c.footer.license }} · {{ c.footer.uses }}
        </p>
      </template>
      <template #right>
        <UButton :to="`${REPO}/releases`" target="_blank" :label="c.cta.releases" color="neutral" variant="ghost" />
        <UButton :to="`${REPO}/blob/main/CHANGELOG.md`" target="_blank" label="Changelog" color="neutral" variant="ghost" />
        <UButton :to="REPO" target="_blank" icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub" />
      </template>
    </UFooter>
  </UApp>
</template>
