<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { Step } from '~/content/types'
import { version as APP_VERSION } from '../../../desktop/package.json'

const REPO = 'https://github.com/felixwochnick/euro-office-worksheet-assistant'
const RAW = 'https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main'
// The installers carry the version in their names: link the release of the desktop app's version in this checkout
// (still valid after later releases; the app then updates itself).
const DOWNLOAD = `${REPO}/releases/download/v${APP_VERSION}`
const img = (name: string) => `${useRuntimeConfig().app.baseURL}img/${name}`
const c = useContent()

const featureIcons = ['i-lucide-file-plus-2', 'i-lucide-pencil-line', 'i-lucide-music', 'i-lucide-bot', 'i-lucide-shield-check', 'i-lucide-monitor-smartphone']
const wayIcons = ['i-lucide-cloud', 'i-lucide-laptop', 'i-lucide-plug-zap']
const wayTargets = ['nextcloud', 'desktop', 'mcp']
const mcpIcons = ['i-lucide-wrench', 'i-lucide-user-lock', 'i-lucide-hand']
const companionIcons = ['i-lucide-package-check', 'i-lucide-key-round', 'i-lucide-plug']
const musicIcons = ['i-lucide-layout-template', 'i-lucide-languages', 'i-lucide-printer']
const partIcons = ['i-lucide-puzzle', 'i-lucide-server', 'i-lucide-brain']

const withIcons = <T extends object>(items: T[], icons: string[]) => items.map((it, i) => ({ ...it, icon: icons[i] }))

const installTab = ref('nextcloud')
function openInstall(tab: string) {
  installTab.value = tab
  if (import.meta.client) document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' })
}

// Commands are the same in every language.
const code: Record<string, (string | null)[]> = {
  nextcloud: [
    `curl -fsSL ${RAW}/scripts/install-aio.sh | sudo bash -s -- --watch`,
    `mkdir worksheet-server && cd worksheet-server
curl -fsSLO ${RAW}/proxy/compose.release.yml
curl -fsSL ${RAW}/proxy/.env.example -o .env
nano .env   # AUTH_MODE=nextcloud, NEXTCLOUD_URL, PUBLIC_URL, CORS_ORIGINS, LLM_API_KEY
docker compose -f compose.release.yml up -d`,
    null
  ],
  desktop: [null, null, null],
  docker: [
    `git clone ${REPO}.git && cd euro-office-worksheet-assistant
bash scripts/build.sh            # -> dist/worksheet-assistant/`,
    `cd deploy && cp .env.example .env
nano .env   # JWT_SECRET, AUTH_MODE, PROXY_TOKEN, CORS_ORIGINS, LLM_API_KEY
docker compose up -d`,
    null
  ],
  mcp: [null, 'claude mcp add --transport http worksheet-assistant https://worksheets.example.org/mcp', null]
}

const installer = (suffix: string) => `Arbeitsblatt-Assistent_${APP_VERSION}_${suffix}`
const downloads = [
  { label: 'Windows', file: installer('windows-x64-setup.exe'), icon: 'i-simple-icons-windows' },
  { label: 'macOS (Apple silicon)', file: installer('macos-arm64.dmg'), icon: 'i-simple-icons-apple' },
  { label: 'macOS (Intel)', file: installer('macos-x64.dmg'), icon: 'i-simple-icons-apple' },
  { label: 'Linux x64 (AppImage)', file: installer('linux-x64.AppImage'), icon: 'i-simple-icons-linux' },
  { label: 'Linux arm64 (AppImage)', file: installer('linux-arm64.AppImage'), icon: 'i-simple-icons-linux' },
  { label: 'Debian/Ubuntu x64 (.deb)', file: installer('amd64.deb'), icon: 'i-simple-icons-debian' },
  { label: 'Debian/Ubuntu arm64 (.deb)', file: installer('arm64.deb'), icon: 'i-simple-icons-debian' }
]

const tabs = computed<TabsItem[]>(() => [
  { label: c.value.install.tabs.nextcloud, value: 'nextcloud', icon: 'i-lucide-cloud', slot: 'steps' as const },
  { label: c.value.install.tabs.desktop, value: 'desktop', icon: 'i-lucide-laptop', slot: 'steps' as const },
  { label: c.value.install.tabs.docker, value: 'docker', icon: 'i-simple-icons-docker', slot: 'steps' as const },
  { label: c.value.install.tabs.mcp, value: 'mcp', icon: 'i-lucide-plug-zap', slot: 'steps' as const }
])
const stepsOf = (tab: string): Step[] => (c.value.install as unknown as Record<string, Step[]>)[tab] ?? []
</script>

<template>
  <div>
    <UPageHero
      :headline="c.hero.headline"
      :title="c.hero.title"
      :description="c.hero.description"
      :links="[
        { label: c.hero.install, to: '#install', icon: 'i-lucide-download', size: 'xl' },
        { label: c.hero.more, to: '#ways', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }
      ]"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle" size="lg" icon="i-lucide-sparkles" :label="c.hero.badge" />
      </template>
      <div class="overflow-hidden rounded-xl shadow-2xl ring ring-default">
        <img :src="img('worksheet-chat.webp')" :alt="c.hero.imageAlt" width="1800" height="1125" class="w-full">
      </div>
    </UPageHero>

    <UPageSection
      id="features"
      :headline="c.features.headline"
      :title="c.features.title"
      :description="c.features.description"
      :features="withIcons(c.features.items, featureIcons)"
    />

    <UPageSection id="ways" :headline="c.ways.headline" :title="c.ways.title" :description="c.ways.description">
      <UPageGrid>
        <UPageCard
          v-for="(w, i) in c.ways.items"
          :key="i"
          :icon="wayIcons[i]"
          :title="w.title"
          :description="w.description"
          variant="outline"
        >
          <template #footer>
            <div class="space-y-3">
              <UBadge :label="w.badge" color="primary" variant="subtle" />
              <ul class="space-y-1 text-sm text-muted">
                <li v-for="b in w.bullets" :key="b" class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />{{ b }}
                </li>
              </ul>
              <UButton :label="w.link" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0" @click="openInstall(wayTargets[i]!)" />
            </div>
          </template>
        </UPageCard>
      </UPageGrid>
    </UPageSection>

    <UPageSection :headline="c.prompts.headline" :title="c.prompts.title" :description="c.prompts.description">
      <div class="grid gap-8 lg:grid-cols-2">
        <div v-for="group in [{ label: c.prompts.worksheetLabel, items: c.prompts.worksheet, icon: 'i-lucide-file-text' }, { label: c.prompts.musicLabel, items: c.prompts.music, icon: 'i-lucide-music' }]" :key="group.label" class="space-y-3">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <UIcon :name="group.icon" class="size-5 text-primary" />{{ group.label }}
          </h3>
          <UPageCard v-for="p in group.items" :key="p" :description="`„${p}“`" variant="subtle" :ui="{ container: 'p-4 sm:p-4' }" />
        </div>
      </div>
    </UPageSection>

    <UPageSection
      id="mcp"
      :headline="c.mcp.headline"
      :title="c.mcp.title"
      :description="c.mcp.description"
      orientation="horizontal"
      :features="withIcons(c.mcp.items, mcpIcons)"
    >
      <div class="space-y-4">
        <div class="overflow-hidden rounded-xl shadow-xl ring ring-default">
          <img :src="img('mcp.webp')" :alt="c.mcp.imageAlt" width="1800" height="1125" loading="lazy" class="w-full">
        </div>
        <UAlert color="neutral" variant="subtle" icon="i-lucide-badge-check" :title="c.mcp.clientsTitle" :description="c.mcp.clientsText" />
      </div>
    </UPageSection>

    <UPageSection
      :headline="c.companion.headline"
      :title="c.companion.title"
      :description="c.companion.description"
      orientation="horizontal"
      reverse
      :features="withIcons(c.companion.items, companionIcons)"
      :links="[{ label: c.ways.items[1]!.link, icon: 'i-lucide-download', onClick: () => openInstall('desktop') }]"
    >
      <div class="overflow-hidden rounded-xl shadow-xl ring ring-default">
        <img :src="img('companion.webp')" :alt="c.companion.imageAlt" width="1960" height="1400" loading="lazy" class="w-full">
      </div>
    </UPageSection>

    <UPageSection
      :headline="c.music.headline"
      :title="c.music.title"
      :description="c.music.description"
      orientation="horizontal"
      :features="withIcons(c.music.items, musicIcons)"
    >
      <div class="overflow-hidden rounded-xl shadow-xl ring ring-default">
        <img :src="img('music.webp')" :alt="c.music.imageAlt" width="1800" height="1125" loading="lazy" class="w-full">
      </div>
    </UPageSection>

    <UPageSection id="demo" :headline="c.demo.headline" :title="c.demo.title" :description="c.demo.description">
      <ClientOnly>
        <AbcDemo />
        <template #fallback>
          <p class="text-center text-muted">
            {{ c.demo.loading }}
          </p>
        </template>
      </ClientOnly>
    </UPageSection>

    <UPageSection :headline="c.parts.headline" :title="c.parts.title" :description="c.parts.description">
      <UPageGrid>
        <UPageCard v-for="(p, i) in c.parts.items" :key="i" :icon="partIcons[i]" :title="p.title" :description="p.description" variant="outline">
          <template #footer>
            <div class="space-y-3">
              <UBadge :label="p.badge" :color="i === 0 ? 'primary' : 'neutral'" variant="subtle" />
              <ul class="space-y-1 text-sm text-muted">
                <li v-for="b in p.bullets" :key="b" class="flex items-start gap-2">
                  <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />{{ b }}
                </li>
              </ul>
            </div>
          </template>
        </UPageCard>
      </UPageGrid>
    </UPageSection>

    <UPageSection id="install" :headline="c.install.headline" :title="c.install.title" :description="c.install.description">
      <div class="mx-auto w-full max-w-3xl">
        <UTabs v-model="installTab" :items="tabs" variant="link" class="w-full" :ui="{ list: 'flex-wrap' }">
          <template #steps="{ item }">
            <div class="space-y-8 pt-6">
              <div v-for="(s, i) in stepsOf(String(item.value))" :key="i" class="flex gap-4">
                <UBadge :label="String(i + 1)" size="xl" class="h-9 w-9 shrink-0 justify-center rounded-full" />
                <div class="min-w-0 flex-1 space-y-3">
                  <h3 class="text-lg font-semibold">
                    {{ s.title }}
                  </h3>
                  <p class="text-muted">
                    <RichText :text="s.description" />
                  </p>
                  <CodeBlock v-if="code[String(item.value)]?.[i]" :code="code[String(item.value)]![i]!" :label="s.codeLabel" />
                  <div v-if="item.value === 'desktop' && i === 1" class="flex flex-wrap gap-2">
                    <UButton
                      v-for="d in downloads"
                      :key="d.file"
                      :to="`${DOWNLOAD}/${d.file}`"
                      :label="d.label"
                      :icon="d.icon"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    />
                  </div>
                </div>
              </div>
              <UButton :to="`${REPO}#installation`" target="_blank" :label="c.install.readme" variant="link" trailing-icon="i-lucide-arrow-up-right" class="px-0" />
            </div>
          </template>
        </UTabs>
      </div>
    </UPageSection>

    <UPageSection id="faq" :headline="c.faq.headline" :title="c.faq.title">
      <div class="mx-auto w-full max-w-3xl">
        <UAccordion :items="c.faq.items" type="multiple">
          <template #body="{ item }">
            <RichText :text="item.content" />
          </template>
        </UAccordion>
      </div>
    </UPageSection>

    <UPageSection>
      <UPageCTA
        :title="c.cta.title"
        :description="c.cta.description"
        variant="subtle"
        :links="[
          { label: c.cta.repo, to: REPO, target: '_blank', icon: 'i-simple-icons-github' },
          { label: c.cta.releases, to: `${REPO}/releases`, target: '_blank', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }
        ]"
      />
    </UPageSection>
  </div>
</template>
