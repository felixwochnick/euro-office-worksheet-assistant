<script setup lang="ts">
/** A newer version: install it (or open its download page when this installation cannot update itself). */
const { update } = useAssistant()
const toast = useToast()

const visible = computed(() => update.value && (update.value.state === 'available' || update.value.state === 'downloading'))
const percent = computed(() => Math.round((update.value?.progress ?? 0) * 100))

async function install() {
  try {
    await call('install_update')
  } catch (err) {
    toast.add({ title: 'Update fehlgeschlagen', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <div v-if="visible && update" class="rounded-lg border border-primary/30 bg-primary/5 p-4">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-circle-arrow-up" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1">
        <p class="font-medium text-highlighted">Version {{ update.version }} ist verfügbar</p>
        <p v-if="update.state === 'downloading'" class="text-sm text-muted">
          Wird geladen und installiert … Danach startet der Arbeitsblatt-Assistent neu.
        </p>
        <p v-else-if="update.manual" class="text-sm text-muted">
          Lade die neue Version von der Download-Seite und installiere sie wie beim ersten Mal.
        </p>
        <p v-else class="text-sm text-muted">
          Das Update dauert etwa eine Minute. Ein gerade laufender KI-Chat im Editor wird dabei kurz unterbrochen.
        </p>
        <UProgress v-if="update.state === 'downloading'" :model-value="percent" class="mt-3" size="sm" />
      </div>
      <UButton
        v-if="update.state === 'available'"
        :icon="update.manual ? 'i-lucide-external-link' : 'i-lucide-download'"
        @click="install"
      >
        {{ update.manual ? 'Zur Download-Seite' : 'Jetzt aktualisieren' }}
      </UButton>
    </div>
  </div>
</template>
