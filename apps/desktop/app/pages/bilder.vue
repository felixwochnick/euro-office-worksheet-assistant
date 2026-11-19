<script setup lang="ts">
/**
 * Pictures on worksheets: free pictures from the internet (ARASAAC pictograms, Wikimedia Commons) and the
 * teacher's own picture folder on this computer. Changes restart the server (like the AI settings).
 */
import type { PicturesStatus } from '~/utils/types'

const { state, refresh } = useAssistant()
const toast = useToast()

const pictures = ref<PicturesStatus | null>(null)
const busy = ref(false)

async function load() {
  try {
    pictures.value = await companion<PicturesStatus>('pictures')
  } catch (err) {
    toast.add({ title: 'Bilder-Einstellungen nicht geladen', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
// Only when the picture settings change (the state is refreshed every few seconds).
watch(() => state.value ? `${state.value.settings.online_pictures}|${state.value.settings.image_folder}` : '', (now, before) => {
  if (now && now !== before) load()
}, { immediate: true })

async function save(body: { online?: boolean, folder?: string }, done: string) {
  busy.value = true
  try {
    const r = await companion<{ ok: boolean, pictures: PicturesStatus }>('pictures', body)
    pictures.value = r.pictures
    toast.add({ title: done, description: 'Gilt ab der nächsten Nachricht im KI-Chat (und für Claude).', color: 'success', icon: 'i-lucide-circle-check' })
    // The server restarts with the new settings.
    setTimeout(refresh, 1500)
  } catch (err) {
    toast.add({ title: 'Nicht gespeichert', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}

async function chooseFolder() {
  const folder = await call<string | null>('pick_folder', { title: 'Bilderordner wählen', start: pictures.value?.folder || null }).catch((err) => {
    toast.add({ title: 'Ordner nicht gewählt', description: errorText(err), color: 'error' })
    return null
  })
  if (folder) await save({ folder }, 'Bilderordner eingerichtet')
}

function openFolder() {
  const path = pictures.value?.folder
  if (path) call('open_folder', { path }).catch(err => toast.add({ title: errorText(err), color: 'error' }))
}

const countText = computed(() => {
  const p = pictures.value
  if (!p?.folder_ok) return ''
  if (!p.count) return 'Noch keine Bilder darin – lege Bilder (PNG, JPEG, GIF, WebP, SVG) hinein.'
  return p.count >= 3000 ? 'Über 3000 Bilder gefunden (die ersten 3000 werden durchsucht).' : `${p.count} ${p.count === 1 ? 'Bild' : 'Bilder'} gefunden.`
})
</script>

<template>
  <AppPage title="Bilder">
    <p class="text-muted">
      Arbeitsblätter – gerade für Grundschule und Förderschule – müssen nicht nur aus Text bestehen: Die KI setzt
      passende Bilder auf das Blatt, z. B. ein Piktogramm neben jedes Wort oder ein Bild zum Einstieg.
    </p>

    <template v-if="pictures">
      <section class="space-y-3">
        <h2 class="font-semibold text-highlighted">Bilder aus dem Internet</h2>
        <USwitch
          :model-value="pictures.online"
          :disabled="busy"
          label="Freie Bilder suchen"
          description="ARASAAC-Piktogramme (einfache Zeichnungen, gemacht für die Förderschule) und Fotos, Zeichnungen und historische Bilder von Wikimedia Commons. Die Lizenzangabe steht automatisch klein unter dem Bild."
          @update:model-value="(v: boolean) => save({ online: v }, v ? 'Bilder aus dem Internet an' : 'Bilder aus dem Internet aus')"
        />
      </section>

      <USeparator />

      <section class="space-y-3">
        <h2 class="font-semibold text-highlighted">Eigene Bilder</h2>
        <p class="text-sm text-muted">
          Ein Ordner auf diesem Computer mit deinen Bildern – eigene Fotos, Scans oder z. B. Comic-Bilder für den
          Lateinunterricht. Die KI findet sie über Datei- und Ordnernamen, also am besten sprechend benennen:
          <span class="font-mono text-xs">Asterix/obelix-hinkelstein.png</span>. Unterordner sind erlaubt.
        </p>

        <div v-if="pictures.folder" class="flex min-w-0 items-center gap-2 rounded-md border border-default px-3 py-2">
          <UIcon :name="pictures.folder_ok ? 'i-lucide-folder' : 'i-lucide-folder-x'" class="size-5 shrink-0" :class="pictures.folder_ok ? 'text-primary' : 'text-error'" />
          <span class="selectable min-w-0 flex-1 truncate font-mono text-xs" :title="pictures.folder">{{ pictures.folder }}</span>
          <UButton v-if="pictures.folder_ok" size="xs" color="neutral" variant="ghost" icon="i-lucide-folder-open" aria-label="Ordner öffnen" @click="openFolder" />
        </div>
        <p v-if="pictures.error" class="text-sm text-error">{{ pictures.error }}</p>
        <p v-else-if="countText" class="text-sm text-muted">{{ countText }}</p>

        <div class="flex flex-wrap gap-2">
          <UButton icon="i-lucide-folder-search" :loading="busy" @click="chooseFolder">
            {{ pictures.folder ? 'Anderen Ordner wählen' : 'Ordner wählen' }}
          </UButton>
          <UButton v-if="pictures.folder" color="neutral" variant="ghost" :disabled="busy" @click="save({ folder: '' }, 'Bilderordner entfernt')">
            Keinen eigenen Ordner verwenden
          </UButton>
        </div>
        <p class="text-xs text-dimmed">
          Die Bilder bleiben auf diesem Computer. Für Bilder, die nicht frei sind, gilt wie immer: nur im eigenen Unterricht verwenden.
        </p>
      </section>
    </template>
    <div v-else class="flex items-center gap-3 py-6 text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      <span>Lädt …</span>
    </div>
  </AppPage>
</template>
