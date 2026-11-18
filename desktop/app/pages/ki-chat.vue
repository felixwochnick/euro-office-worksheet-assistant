<script setup lang="ts">
/** Which language model the chat in the plugin uses; the API key stays on this computer. */
const { state, refresh } = useAssistant()
const toast = useToast()

const KEY_PAGES: Record<string, string> = {
  mistral: 'https://console.mistral.ai/api-keys',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys'
}

const form = reactive({ provider: 'none', apiKey: '', model: '', baseUrl: '' })
const saving = ref(false)
const showKey = ref(false)

function load() {
  if (!state.value) return
  form.provider = state.value.settings.provider
  form.model = state.value.settings.model
  form.baseUrl = state.value.settings.base_url
  form.apiKey = ''
}
watch(() => state.value?.settings, (now, before) => {
  if (!before || JSON.stringify(now) !== JSON.stringify(before)) load()
}, { immediate: true })

const provider = computed(() => state.value?.providers.find(p => p.id === form.provider))
const items = computed(() => state.value?.providers.map(p => ({ label: p.label, value: p.id })) ?? [])
const needsUrl = computed(() => form.provider === 'ollama' || form.provider === 'openai-compatible')
const keyStored = computed(() => !!state.value?.settings.has_key && state.value.settings.provider === form.provider)
const hasKey = computed(() => !!state.value?.settings.has_key)

async function save(clearKey = false) {
  saving.value = true
  try {
    // Deleting the key switches the chat off (the providers with keys cannot run without one).
    await companion('settings', clearKey
      ? { provider: 'none', model: '', base_url: '', api_key: '', clear_key: true }
      : { provider: form.provider, model: form.model, base_url: form.baseUrl, api_key: form.apiKey })
    toast.add({
      title: clearKey ? 'Schlüssel gelöscht' : 'Gespeichert',
      description: clearKey ? 'Der KI-Chat ist aus.' : 'Der KI-Chat nutzt die neuen Einstellungen ab der nächsten Nachricht.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    form.apiKey = ''
    // The server restarts with the new settings.
    setTimeout(refresh, 1500)
  } catch (err) {
    toast.add({ title: 'Nicht gespeichert', description: errorText(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

function openKeyPage() {
  const url = KEY_PAGES[form.provider]
  if (url) call('open_external', { url }).catch(() => {})
}
</script>

<template>
  <AppPage title="KI-Chat">
    <p class="text-muted">
      Welches Sprachmodell der Chat im Plugin nutzt. Der API-Schlüssel bleibt auf diesem Computer. Ohne KI-Chat
      funktionieren der Noten-Tab und Claude (über MCP) trotzdem.
    </p>

    <UAlert
      v-if="state?.chat_error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Der KI-Chat ist aus"
      :description="state.chat_error"
    />

    <form class="space-y-5" @submit.prevent="save()">
      <UFormField label="Anbieter">
        <USelect v-model="form.provider" :items="items" class="w-full" />
      </UFormField>

      <UFormField v-if="provider?.needs_key" label="API-Schlüssel">
        <template v-if="KEY_PAGES[form.provider]" #hint>
          <ULink as="button" type="button" class="text-xs" @click="openKeyPage">Schlüssel bekommen</ULink>
        </template>
        <UInput
          v-model="form.apiKey"
          :type="showKey ? 'text' : 'password'"
          autocomplete="off"
          :placeholder="keyStored ? 'Gespeichert – leer lassen, um ihn zu behalten' : 'Schlüssel einfügen'"
          class="w-full"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="showKey ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showKey ? 'Schlüssel verbergen' : 'Schlüssel zeigen'"
              @click="showKey = !showKey"
            />
          </template>
        </UInput>
      </UFormField>

      <UFormField v-if="needsUrl" label="API-Adresse" :description="form.provider === 'ollama' ? 'Ollama läuft normalerweise auf diesem Computer.' : 'Adresse eines OpenAI-kompatiblen Dienstes.'">
        <UInput v-model="form.baseUrl" :placeholder="provider?.base_url || 'https://…/v1'" class="w-full" />
      </UFormField>

      <UFormField v-if="form.provider !== 'none'" label="Modell" :description="provider?.model ? `Leer lassen für ${provider.model}.` : undefined">
        <UInput v-model="form.model" :placeholder="provider?.model" class="w-full" />
      </UFormField>

      <div class="flex flex-wrap gap-2">
        <UButton type="submit" icon="i-lucide-save" :loading="saving">Speichern</UButton>
        <UButton v-if="hasKey" type="button" color="neutral" variant="ghost" :disabled="saving" @click="save(true)">KI-Chat ausschalten und Schlüssel löschen</UButton>
      </div>
    </form>
  </AppPage>
</template>
