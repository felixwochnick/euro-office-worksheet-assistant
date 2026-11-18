<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const REPO = 'https://github.com/felixwochnick/eurooffice-music-notation-plugin'
const baseURL = useRuntimeConfig().app.baseURL

useHead({
  link: [{ rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` }]
})
useSeoMeta({
  ogTitle: 'Noten-Assistent für Euro-Office',
  ogDescription: 'Notenzeilen für Arbeitsblätter – per KI-Chat oder von Hand. Open-Source-Plugin für Euro-Office in Nextcloud.',
  ogImage: `https://felixwochnick.github.io${baseURL}img/og.png`,
  twitterCard: 'summary_large_image'
})

const items: NavigationMenuItem[] = [
  { label: 'Funktionen', to: '#funktionen' },
  { label: 'Live-Demo', to: '#demo' },
  { label: 'Installation', to: '#installation' },
  { label: 'FAQ', to: '#faq' }
]
</script>

<template>
  <UApp>
    <UHeader title="Noten-Assistent">
      <template #title>
        <span class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-music" class="size-6 text-primary" />
          Noten-Assistent
        </span>
      </template>

      <UNavigationMenu :items="items" variant="link" />

      <template #right>
        <UColorModeButton />
        <UButton
          :to="REPO"
          target="_blank"
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          aria-label="GitHub"
        />
      </template>

      <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Noten-Assistent · MIT-Lizenz · nutzt
          <ULink to="https://www.abcjs.net/" target="_blank" class="underline">abcjs</ULink> (MIT) und das
          ONLYOFFICE-Plugin-SDK (AGPL-3.0)
        </p>
      </template>
      <template #right>
        <UButton :to="`${REPO}/releases`" target="_blank" label="Releases" color="neutral" variant="ghost" />
        <UButton :to="`${REPO}/blob/main/CHANGELOG.md`" target="_blank" label="Changelog" color="neutral" variant="ghost" />
        <UButton :to="REPO" target="_blank" icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub" />
      </template>
    </UFooter>
  </UApp>
</template>
