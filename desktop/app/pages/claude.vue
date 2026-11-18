<script setup lang="ts">
/** Connect Claude (and other assistants) through MCP: they edit the document open in the desktop app. */
import type { ClaudeStatus } from '~/utils/types'

const { claude, claudeLoading, refreshClaude, info } = useAssistant()
const toast = useToast()
const busy = ref<'' | 'desktop' | 'code'>('')
const restartHint = ref(false)

onMounted(() => {
  refreshClaude()
})

async function change(client: 'desktop' | 'code', action: 'add' | 'remove') {
  busy.value = client
  try {
    const res = await companion<{ status: ClaudeStatus }>('claude', { client, action })
    claude.value = res.status
    if (client === 'desktop') restartHint.value = true
    toast.add({
      title: action === 'add' ? 'Eingetragen' : 'Entfernt',
      description: client === 'desktop' ? 'Starte Claude Desktop neu, damit die Änderung wirkt.' : 'Gilt für neue Sitzungen von Claude Code.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (err) {
    toast.add({ title: 'Das hat nicht geklappt', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = ''
  }
}

const desktopState = computed(() => {
  const d = claude.value?.desktop
  if (!d) return null
  if (!d.installed) return { label: 'Nicht gefunden', color: 'neutral' as const }
  if (d.registered && d.current) return { label: 'Verbunden', color: 'success' as const }
  if (d.registered) return { label: 'Eintrag veraltet', color: 'warning' as const }
  return { label: 'Nicht verbunden', color: 'neutral' as const }
})

const codeState = computed(() => {
  const c = claude.value?.code
  if (!c) return null
  if (!c.installed) return { label: 'Nicht gefunden', color: 'neutral' as const }
  if (c.registered) return { label: 'Verbunden', color: 'success' as const }
  return { label: 'Nicht verbunden', color: 'neutral' as const }
})

const claudeCodeCommand = computed(() => claude.value ? `claude mcp add --scope user --transport http worksheet-assistant ${claude.value.mcp_url}` : '')
const desktopJson = computed(() => claude.value
  ? JSON.stringify({ mcpServers: { 'worksheet-assistant': { command: claude.value.stdio_command[0], args: claude.value.stdio_command.slice(1) } } }, null, 2)
  : '')
const claudeApp = computed(() => info.value?.platform === 'windows' ? 'Claude für Windows' : info.value?.platform === 'macos' ? 'Claude für Mac' : 'Claude Desktop')
</script>

<template>
  <AppPage title="Claude & MCP">
    <p class="text-muted">
      Claude und andere KI-Assistenten können das in der Desktop-App geöffnete Dokument bearbeiten: Arbeitsblätter
      erstellen, Aufgaben einfügen, Noten setzen. Im Plugin muss dafür „MCP-Zugriff erlauben“ eingeschaltet sein (ist
      voreingestellt).
    </p>

    <div v-if="claudeLoading && !claude" class="flex items-center gap-3 py-6 text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      <span>Suche nach Claude auf diesem Computer …</span>
    </div>

    <template v-if="claude">
      <section class="space-y-3 rounded-lg border border-default p-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-monitor" class="size-5 shrink-0 text-muted" />
          <h2 class="flex-1 font-semibold text-highlighted">{{ claudeApp }}</h2>
          <UBadge v-if="desktopState" :color="desktopState.color" variant="subtle" :label="desktopState.label" />
        </div>
        <p class="text-sm text-muted">
          <template v-if="!claude.desktop.installed">
            Claude Desktop wurde auf diesem Computer nicht gefunden. Installiere es von claude.ai/download und starte es einmal.
          </template>
          <template v-else-if="claude.desktop.registered">
            Claude Desktop startet den Arbeitsblatt-Assistenten selbst, sobald du ihn im Chat brauchst.
          </template>
          <template v-else>
            Trägt den Arbeitsblatt-Assistenten in die Konfiguration von Claude Desktop ein. Andere Einträge bleiben erhalten.
          </template>
        </p>
        <UAlert v-if="claude.desktop.error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="claude.desktop.error" />
        <UAlert
          v-if="restartHint"
          color="info"
          variant="subtle"
          icon="i-lucide-rotate-cw"
          description="Beende Claude Desktop ganz (nicht nur das Fenster schließen) und starte es neu, damit die Änderung wirkt."
        />
        <div v-if="claude.desktop.installed" class="flex flex-wrap gap-2">
          <UButton
            v-if="!claude.desktop.registered || !claude.desktop.current"
            icon="i-lucide-plug"
            :loading="busy === 'desktop'"
            :disabled="info?.temporary"
            @click="change('desktop', 'add')"
          >
            {{ claude.desktop.registered ? 'Eintrag aktualisieren' : 'In Claude eintragen' }}
          </UButton>
          <UButton
            v-if="claude.desktop.registered"
            color="neutral"
            variant="outline"
            icon="i-lucide-unplug"
            :loading="busy === 'desktop'"
            @click="change('desktop', 'remove')"
          >
            Aus Claude entfernen
          </UButton>
        </div>
        <p v-if="claude.desktop.installed" class="selectable truncate text-xs text-dimmed" :title="claude.desktop.config_path">
          {{ claude.desktop.config_path }}
        </p>
      </section>

      <section class="space-y-3 rounded-lg border border-default p-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-square-terminal" class="size-5 shrink-0 text-muted" />
          <h2 class="flex-1 font-semibold text-highlighted">Claude Code</h2>
          <UBadge v-if="codeState" :color="codeState.color" variant="subtle" :label="codeState.label" />
        </div>
        <UAlert v-if="claude.code.error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="claude.code.error" />
        <div v-if="claude.code.installed" class="flex flex-wrap gap-2">
          <UButton v-if="!claude.code.registered" icon="i-lucide-plug" :loading="busy === 'code'" :disabled="info?.temporary" @click="change('code', 'add')">
            In Claude Code eintragen
          </UButton>
          <UButton v-else color="neutral" variant="outline" icon="i-lucide-unplug" :loading="busy === 'code'" @click="change('code', 'remove')">
            Aus Claude Code entfernen
          </UButton>
        </div>
        <template v-else>
          <p class="text-sm text-muted">Claude Code wurde nicht gefunden. Wenn du es woanders installiert hast, trage den Assistenten mit diesem Befehl ein:</p>
          <CopyField :value="claudeCodeCommand" />
        </template>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold text-highlighted">Andere KI-Assistenten</h2>
        <p class="text-sm text-muted">MCP-Adresse (Streamable HTTP, ohne Anmeldung, nur auf diesem Computer erreichbar):</p>
        <CopyField :value="claude.mcp_url" />
        <p class="text-sm text-muted">Für Programme, die einen MCP-Server als Befehl starten (Eintrag wie bei Claude Desktop):</p>
        <CopyField :value="desktopJson" multiline />
      </section>
    </template>
  </AppPage>
</template>
