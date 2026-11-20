<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { Item, Step } from '~/content/types'
import { version as APP_VERSION } from '../../../desktop/package.json'

const REPO = 'https://github.com/felixwochnick/euro-office-worksheet-assistant'
const RAW = 'https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main'
// The installers carry the version in their names: link the release of the desktop app's version in this checkout
// (still valid after later releases; the app then updates itself).
const DOWNLOAD = `${REPO}/releases/download/v${APP_VERSION}`
const MINOR = APP_VERSION.split('.').slice(0, 2).join('.')
const c = useContent()
const img = (name: string) => `${useRuntimeConfig().app.baseURL}img/${name}`

// Screenshots in public/img/ with their pixel sizes (dev/eurooffice/website-screenshots.mjs).
const shot = {
  hero: { name: 'hero.webp', width: 1800, height: 1125 },
  tasks: { name: 'tasks.webp', width: 1394, height: 1820 },
  graphics: { name: 'graphics.webp', width: 1396, height: 1592 },
  pictures: { name: 'pictures.webp', width: 1396, height: 1818 },
  music: { name: 'music.webp', width: 1800, height: 1125 },
  mcp: { name: 'mcp.webp', width: 1800, height: 1125 },
  companion: { name: 'companion.webp', width: 1960, height: 1400 }
}
const themeShots = [
  { name: 'theme-classic.webp', width: 1416, height: 1348 },
  { name: 'theme-modern.webp', width: 1418, height: 1442 },
  { name: 'theme-primary.webp', width: 1416, height: 1682 }
]
const diagramShots = [
  { name: 'diagram-class.webp', width: 1004, height: 916 },
  { name: 'diagram-sequence.webp', width: 822, height: 630 },
  { name: 'diagram-automaton.webp', width: 610, height: 302 },
  { name: 'diagram-structogram.webp', width: 908, height: 586 },
  { name: 'diagram-flowchart.webp', width: 922, height: 750 },
  { name: 'diagram-er.webp', width: 964, height: 630 }
]

// The overview: icon and the section that shows more, in the order of c.features.items.
const featureLinks = [
  { icon: 'i-lucide-messages-square', to: '#prompts' },
  { icon: 'i-lucide-palette', to: '#designs' },
  { icon: 'i-lucide-puzzle', to: '#tasks' },
  { icon: 'i-lucide-chart-column', to: '#graphics' },
  { icon: 'i-lucide-image', to: '#pictures' },
  { icon: 'i-lucide-workflow', to: '#informatics' },
  { icon: 'i-lucide-music', to: '#music' },
  { icon: 'i-lucide-file-cog', to: '#designs' },
  { icon: 'i-lucide-list-checks', to: '#tasks' },
  { icon: 'i-lucide-pencil-line', to: '#prompts' },
  { icon: 'i-lucide-plug-zap', to: '#mcp' },
  { icon: 'i-lucide-shield-check', to: '#parts' }
]
// Feature lists show plain text: drop the **bold** and `code` marks of the texts.
const plain = (text: string) => text.replace(/\*\*|`/g, '')
const withIcons = <T extends Item>(items: T[], icons: string[]) => items.map((it, i) => ({ ...it, description: plain(it.description), icon: icons[i] }))
const features = computed(() => c.value.features.items.map((it, i) => ({ ...it, description: plain(it.description), ...featureLinks[i] })))

const designIcons = ['i-lucide-list-ordered', 'i-lucide-sticky-note', 'i-lucide-languages']
const taskIcons = ['i-lucide-text-cursor-input', 'i-lucide-puzzle', 'i-lucide-book-open-check', 'i-lucide-scissors']
const graphicIcons = ['i-lucide-ruler', 'i-lucide-chart-pie', 'i-lucide-sigma', 'i-lucide-network']
const pictureIcons = ['i-lucide-smile', 'i-lucide-landmark', 'i-lucide-folder-heart']
const informaticIcons = ['i-lucide-boxes', 'i-lucide-pencil-ruler', 'i-lucide-scaling']
const musicIcons = ['i-lucide-layout-template', 'i-lucide-languages', 'i-lucide-printer']
const mcpIcons = ['i-lucide-wrench', 'i-lucide-user-lock', 'i-lucide-hand']
const companionIcons = ['i-lucide-package-check', 'i-lucide-key-round', 'i-lucide-plug']
const wayIcons = ['i-lucide-cloud', 'i-lucide-laptop', 'i-lucide-plug-zap']
const wayTargets = ['nextcloud', 'desktop', 'mcp']
const promptIcons = ['i-lucide-file-text', 'i-lucide-shapes', 'i-lucide-music']
const partIcons = ['i-lucide-puzzle', 'i-lucide-server', 'i-lucide-brain']

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
curl -fsSLO ${RAW}/apps/server/compose.release.yml
curl -fsSL ${RAW}/apps/server/.env.example -o .env
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

const installer = (suffix: string) => `worksheet-assistant_${APP_VERSION}_${suffix}`
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
      :title="c.hero.title"
      :description="c.hero.description"
      :links="[
        { label: c.hero.install, to: '#install', icon: 'i-lucide-download', size: 'xl' },
        { label: c.hero.more, to: '#features', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }
      ]"
    >
      <template #headline>
        <div class="flex flex-col items-center gap-3">
          <UBadge
            as="a"
            href="#informatics"
            color="primary"
            variant="subtle"
            size="lg"
            icon="i-lucide-sparkles"
            :label="fmt(c.hero.badge, { version: MINOR })"
            class="rounded-full px-3 transition hover:bg-primary/15"
          />
          <span class="text-sm font-semibold text-primary">{{ c.hero.headline }}</span>
        </div>
      </template>
      <ScreenShot v-bind="shot.hero" :alt="c.hero.imageAlt" eager class="shadow-2xl" />
    </UPageHero>

    <UPageSection
      id="features"
      :headline="c.features.headline"
      :title="c.features.title"
      :description="c.features.description"
      :features="features"
    />

    <UPageSection id="designs" :headline="c.designs.headline" :title="c.designs.title" :description="c.designs.description">
      <div class="grid items-start gap-8 md:grid-cols-3">
        <figure v-for="(t, i) in c.designs.themes" :key="i" class="space-y-4">
          <ScreenShot v-bind="themeShots[i]!" :alt="fmt(c.designs.imageAlt, { theme: t.title })" zoom />
          <figcaption>
            <p class="font-semibold text-highlighted">
              {{ t.title }}
            </p>
            <p class="text-sm text-muted">
              {{ t.description }}
            </p>
          </figcaption>
        </figure>
      </div>
      <UPageGrid class="mt-4">
        <UPageFeature v-for="(f, i) in withIcons(c.designs.items, designIcons)" :key="i" v-bind="f" />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="tasks"
      :headline="c.tasks.headline"
      :title="c.tasks.title"
      :description="c.tasks.description"
      orientation="horizontal"
      :features="withIcons(c.tasks.items, taskIcons)"
    >
      <ScreenShot v-bind="shot.tasks" :alt="c.tasks.imageAlt" zoom class="mx-auto max-w-lg" />
    </UPageSection>

    <UPageSection
      id="graphics"
      :headline="c.graphics.headline"
      :title="c.graphics.title"
      :description="c.graphics.description"
      orientation="horizontal"
      reverse
      :features="withIcons(c.graphics.items, graphicIcons)"
    >
      <ScreenShot v-bind="shot.graphics" :alt="c.graphics.imageAlt" zoom class="mx-auto max-w-lg" />
    </UPageSection>

    <UPageSection
      id="pictures"
      :headline="c.pictures.headline"
      :title="c.pictures.title"
      :description="c.pictures.description"
      orientation="horizontal"
      :features="withIcons(c.pictures.items, pictureIcons)"
    >
      <ScreenShot v-bind="shot.pictures" :alt="c.pictures.imageAlt" zoom class="mx-auto max-w-lg" />
    </UPageSection>

    <UPageSection id="informatics" :title="c.informatics.title" :description="c.informatics.description">
      <template #headline>
        <div class="flex items-center justify-center gap-2">
          {{ c.informatics.headline }}
          <UBadge :label="c.informatics.badge" color="primary" variant="solid" size="sm" class="rounded-full" />
        </div>
      </template>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <figure v-for="(d, i) in c.informatics.diagrams" :key="i" class="overflow-hidden rounded-lg bg-default ring ring-default">
          <a
            :href="img(diagramShots[i]!.name)"
            target="_blank"
            :title="c.footer.zoom"
            class="flex h-56 items-center justify-center bg-white p-4 transition hover:opacity-90"
          >
            <img
              :src="img(diagramShots[i]!.name)"
              :alt="`${d.title}: ${d.description}`"
              :width="diagramShots[i]!.width"
              :height="diagramShots[i]!.height"
              loading="lazy"
              class="h-auto max-h-full w-auto max-w-full"
            >
          </a>
          <figcaption class="border-t border-default p-4">
            <p class="font-semibold text-highlighted">
              {{ d.title }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ d.description }}
            </p>
          </figcaption>
        </figure>
      </div>
      <UPageGrid class="mt-4">
        <UPageFeature v-for="(f, i) in withIcons(c.informatics.items, informaticIcons)" :key="i" v-bind="f" />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="music"
      :headline="c.music.headline"
      :title="c.music.title"
      :description="c.music.description"
      orientation="horizontal"
      reverse
      :features="withIcons(c.music.items, musicIcons)"
    >
      <ScreenShot v-bind="shot.music" :alt="c.music.imageAlt" zoom />
    </UPageSection>

    <UPageSection id="prompts" :headline="c.prompts.headline" :title="c.prompts.title" :description="c.prompts.description">
      <div class="grid gap-8 lg:grid-cols-3">
        <div v-for="(group, g) in c.prompts.groups" :key="g" class="space-y-3">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <UIcon :name="promptIcons[g]!" class="size-5 text-primary" />{{ group.label }}
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
        <ScreenShot v-bind="shot.mcp" :alt="c.mcp.imageAlt" zoom />
        <UAlert color="neutral" variant="subtle" icon="i-lucide-badge-check" :title="c.mcp.clientsTitle" :description="c.mcp.clientsText" />
      </div>
    </UPageSection>

    <UPageSection
      id="desktop"
      :headline="c.companion.headline"
      :title="c.companion.title"
      :description="c.companion.description"
      orientation="horizontal"
      reverse
      :features="withIcons(c.companion.items, companionIcons)"
      :links="[{ label: c.ways.items[1]!.link, icon: 'i-lucide-download', onClick: () => openInstall('desktop') }]"
    >
      <ScreenShot v-bind="shot.companion" :alt="c.companion.imageAlt" />
    </UPageSection>

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

    <UPageSection id="parts" :headline="c.parts.headline" :title="c.parts.title" :description="c.parts.description">
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
