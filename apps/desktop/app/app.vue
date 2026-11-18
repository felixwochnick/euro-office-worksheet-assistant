<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { de } from '@nuxt/ui/locale'

const { server, info, start } = useAssistant()

const items: NavigationMenuItem[] = [
  { label: 'Übersicht', icon: 'i-lucide-list-checks', to: '/' },
  { label: 'Desktop-App', icon: 'i-lucide-file-text', to: '/desktop-app' },
  { label: 'KI-Chat', icon: 'i-lucide-message-square-text', to: '/ki-chat' },
  { label: 'Claude & MCP', icon: 'i-lucide-plug', to: '/claude' },
  { label: 'Einstellungen', icon: 'i-lucide-settings', to: '/einstellungen' }
]

const status = computed(() => {
  switch (server.value.state) {
    case 'running': return { text: 'Läuft', dot: 'bg-success' }
    case 'starting': return { text: 'Startet …', dot: 'bg-warning animate-pulse' }
    case 'error': return { text: 'Fehler', dot: 'bg-error' }
    default: return { text: 'Angehalten', dot: 'bg-dimmed' }
  }
})

useHead({ link: [{ rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }] })

onMounted(() => {
  start().catch(err => console.error(err))
})
</script>

<template>
  <UApp :locale="de" :toaster="{ position: 'bottom-right' }">
    <div class="flex h-screen overflow-hidden bg-default">
      <aside class="flex w-60 shrink-0 flex-col border-e border-default bg-elevated/50">
        <div class="flex h-16 items-center gap-2.5 px-4">
          <img src="/icon.svg" alt="" class="size-8 shrink-0">
          <span class="font-semibold leading-tight text-highlighted">Arbeitsblatt-Assistent</span>
        </div>

        <UNavigationMenu :items="items" orientation="vertical" class="px-2" />

        <NuxtLink
          to="/einstellungen"
          class="mt-auto flex items-center gap-2 border-t border-default px-4 py-3 text-sm text-muted hover:text-default"
        >
          <span class="size-2 shrink-0 rounded-full" :class="status.dot" />
          <span>{{ status.text }}</span>
          <span v-if="info" class="ms-auto tabular-nums text-dimmed">Version {{ info.version }}</span>
        </NuxtLink>
      </aside>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
