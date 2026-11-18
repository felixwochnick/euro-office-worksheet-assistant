<script setup lang="ts">
/** The plugin in the Euro-Office / Nextcloud Office desktop apps. */
const { state, refresh, appDetected } = useAssistant()
const toast = useToast()
const busy = ref(false)

function appStatus(a: NonNullable<typeof state.value>['apps'][number]) {
  if (!a.detected) return { label: 'Nicht gefunden', color: 'neutral' as const }
  if (!a.installed) return { label: 'Plugin fehlt', color: 'warning' as const }
  if (a.version !== state.value?.plugin_version || !a.configured) return { label: `Update auf ${state.value?.plugin_version}`, color: 'warning' as const }
  return { label: `Plugin ${a.version} installiert`, color: 'success' as const }
}

async function install() {
  busy.value = true
  try {
    const result = await companion<{ installed: Array<{ app: string }> }>('install', { force: !appDetected.value })
    await refresh()
    if (result.installed.length) {
      toast.add({ title: 'Plugin installiert', description: 'Öffne ein neues Dokument in der Desktop-App (oder starte sie neu).', color: 'success', icon: 'i-lucide-circle-check' })
    } else {
      toast.add({ title: 'Keine Desktop-App gefunden', color: 'warning', icon: 'i-lucide-triangle-alert' })
    }
  } catch (err) {
    toast.add({ title: 'Installation fehlgeschlagen', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppPage title="Desktop-App">
    <p class="text-muted">
      Der Arbeitsblatt-Assistent ist ein Plugin für die Desktop-App von Euro-Office und Nextcloud Office. Es wird bei
      jedem Start dieses Programms installiert und aktuell gehalten.
    </p>

    <ul v-if="state" class="divide-y divide-default rounded-lg border border-default">
      <li v-for="a in state.apps" :key="a.id" class="flex items-center gap-4 p-4">
        <UIcon name="i-lucide-file-text" class="size-5 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-highlighted">{{ a.name }}</p>
          <p class="selectable truncate text-xs text-muted" :title="a.plugin_dir">{{ a.plugin_dir }}</p>
        </div>
        <UBadge :color="appStatus(a).color" variant="subtle" :label="appStatus(a).label" />
      </li>
    </ul>

    <UAlert
      v-if="state && !appDetected"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Keine Desktop-App gefunden"
      description="Installiere Euro-Office oder Nextcloud Office (Desktop) und starte es einmal. Du kannst das Plugin auch schon vorher installieren – die App lädt es beim ersten Start."
    />

    <div class="flex flex-wrap items-center gap-3">
      <UButton icon="i-lucide-download" :loading="busy" @click="install">Plugin installieren / aktualisieren</UButton>
    </div>

    <section class="space-y-2">
      <h2 class="font-semibold text-highlighted">So öffnest du den Assistenten</h2>
      <ol class="list-decimal space-y-1 ps-5 text-muted">
        <li>Ein Dokument in der Desktop-App öffnen (nach der ersten Installation ein neues Dokument oder die App neu starten).</li>
        <li>Oben auf <b class="text-default">Plugins</b> und dann auf <b class="text-default">Arbeitsblatt-Assistent</b> klicken.</li>
        <li>Das Plugin ist schon mit diesem Programm verbunden – dort sind keine Einstellungen nötig.</li>
      </ol>
    </section>
  </AppPage>
</template>
