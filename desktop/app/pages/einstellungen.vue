<script setup lang="ts">
/** Start with the computer, updates, where things are stored, quit. Works while the server is down, too. */
const { server, state, refresh, update, info } = useAssistant()
const toast = useToast()
const autostartBusy = ref(false)
const checking = computed(() => update.value?.state === 'checking')
const quitOpen = ref(false)

async function setAutostart(enabled: boolean) {
  autostartBusy.value = true
  try {
    await companion('autostart', { enabled })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Autostart nicht geändert', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    autostartBusy.value = false
  }
}

async function checkUpdates() {
  await call('check_updates').catch(() => {})
}

const updateText = computed(() => {
  const u = update.value
  if (!u) return ''
  const when = u.checked_at ? ` (geprüft ${new Date(u.checked_at * 1000).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })})` : ''
  switch (u.state) {
    case 'checking': return 'Suche nach Updates …'
    case 'none': return `Du hast die neueste Version${when}.`
    case 'available': return `Version ${u.version} ist verfügbar${when}.`
    case 'downloading': return 'Das Update wird installiert …'
    case 'error': return u.message || 'Die Suche nach Updates ist fehlgeschlagen.'
    default: return 'Die App sucht beim Start und danach alle sechs Stunden nach Updates.'
  }
})

function openFolder(path?: string | null) {
  if (path) call('open_folder', { path }).catch(err => toast.add({ title: errorText(err), color: 'error' }))
}
</script>

<template>
  <AppPage title="Einstellungen" :needs-server="false">
    <section class="space-y-3">
      <h2 class="font-semibold text-highlighted">Start</h2>
      <USwitch
        v-if="state && server.state === 'running'"
        :model-value="state.autostart"
        :loading="autostartBusy"
        label="Beim Anmelden am Computer automatisch starten"
        description="Empfohlen: Dann funktionieren KI-Chat und Claude, ohne dass du das Programm vorher öffnest. Es startet unsichtbar im Hintergrund."
        @update:model-value="setAutostart"
      />
      <p v-else class="text-sm text-muted">Verfügbar, sobald der Server läuft.</p>
    </section>

    <USeparator />

    <section class="space-y-3">
      <h2 class="font-semibold text-highlighted">Updates</h2>
      <p class="text-sm" :class="update?.state === 'error' ? 'text-error' : 'text-muted'">
        Installiert: Version {{ info?.version }}. {{ updateText }}
      </p>
      <p v-if="info && !info.self_update" class="text-sm text-muted">
        Neue Versionen installierst du über die Download-Seite – diese Installation kann sich nicht selbst aktualisieren.
      </p>
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="checking" @click="checkUpdates">
        Nach Updates suchen
      </UButton>
    </section>

    <USeparator />

    <section class="space-y-2 text-sm">
      <h2 class="text-base font-semibold text-highlighted">Auf diesem Computer</h2>
      <dl class="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2">
        <dt class="text-muted">Server</dt>
        <dd class="selectable font-mono text-xs">{{ server.url ?? '–' }}</dd>
        <dt class="text-muted">Einstellungen</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="selectable truncate font-mono text-xs" :title="state?.config_dir">{{ state?.config_dir ?? '–' }}</span>
          <UButton v-if="state" size="xs" color="neutral" variant="ghost" icon="i-lucide-folder-open" aria-label="Ordner öffnen" @click="openFolder(state.config_dir)" />
        </dd>
        <dt class="text-muted">Protokoll</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="selectable truncate font-mono text-xs" :title="info?.log_dir ?? ''">{{ info?.log_dir ?? '–' }}</span>
          <UButton v-if="info?.log_dir" size="xs" color="neutral" variant="ghost" icon="i-lucide-folder-open" aria-label="Ordner öffnen" @click="openFolder(info.log_dir)" />
        </dd>
      </dl>
    </section>

    <USeparator />

    <section class="space-y-3">
      <h2 class="font-semibold text-highlighted">Beenden</h2>
      <p class="text-sm text-muted">
        Das Fenster zu schließen beendet das Programm nicht. Wenn du es ganz beendest, funktionieren KI-Chat und Claude
        erst wieder, wenn du den Arbeitsblatt-Assistenten erneut startest.
      </p>
      <UModal v-model:open="quitOpen" title="Arbeitsblatt-Assistent beenden?" description="KI-Chat und Claude funktionieren dann nicht mehr, bis du das Programm wieder startest.">
        <UButton color="neutral" variant="outline" icon="i-lucide-power">Arbeitsblatt-Assistent beenden</UButton>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="quitOpen = false">Abbrechen</UButton>
            <UButton color="error" icon="i-lucide-power" @click="call('quit_app')">Beenden</UButton>
          </div>
        </template>
      </UModal>
    </section>
  </AppPage>
</template>
