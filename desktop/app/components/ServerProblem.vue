<script setup lang="ts">
/** The server could not start (or stopped): what happened and what to do. */
const { server, info } = useAssistant()
const retrying = ref(false)

const hint = computed(() => {
  switch (server.value.code) {
    case 'already_running':
      return 'Eine ältere Version läuft vermutlich noch in einem Terminal-Fenster oder wurde vom Autostart gestartet. Schließe das Terminal-Fenster (oder melde dich einmal ab und wieder an) und versuche es erneut.'
    case 'port_in_use':
      return 'Ein anderes Programm benutzt den Port 8787. Beende es und versuche es erneut.'
    case 'missing':
      return 'Die Installation ist unvollständig. Installiere den Arbeitsblatt-Assistenten neu.'
    default:
      return 'Versuche es erneut. Wenn der Fehler bleibt, hilft das Protokoll bei der Suche nach der Ursache.'
  }
})

async function retry() {
  retrying.value = true
  try {
    await call('restart_server')
  } finally {
    setTimeout(() => (retrying.value = false), 1500)
  }
}

function openLog() {
  if (info.value?.log_dir) call('open_folder', { path: info.value.log_dir }).catch(() => {})
}
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    title="Der Server läuft nicht"
    :description="server.message || 'Der Server wurde beendet.'"
  />
  <p class="text-sm text-muted">{{ hint }}</p>
  <div class="flex flex-wrap gap-2">
    <UButton icon="i-lucide-rotate-cw" :loading="retrying" @click="retry">Erneut versuchen</UButton>
    <UButton v-if="info?.log_dir" color="neutral" variant="outline" icon="i-lucide-folder-open" @click="openLog">Protokoll öffnen</UButton>
  </div>
</template>
