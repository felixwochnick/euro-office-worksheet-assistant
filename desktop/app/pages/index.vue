<script setup lang="ts">
/**
 * Overview: the setup as a checklist on a ruled worksheet. Step 1 is needed, 2 and 3 are optional.
 */
const { state, claude, claudeLoading, pluginReady, appDetected, chatReady, claudeReady, info } = useAssistant()

interface Step {
  done: boolean
  optional: boolean
  title: string
  text: string
  action: string
  to: string
}

const steps = computed<Step[]>(() => [
  {
    done: pluginReady.value,
    optional: false,
    title: 'Plugin in der Desktop-App',
    text: pluginReady.value
      ? 'Im Dokument unter Plugins → Arbeitsblatt-Assistent.'
      : appDetected.value
        ? 'Das Plugin fehlt oder ist veraltet.'
        : 'Installiere Euro-Office oder Nextcloud Office (Desktop) und starte es einmal.',
    action: pluginReady.value ? 'Details' : 'Plugin installieren',
    to: '/desktop-app'
  },
  {
    done: chatReady.value,
    optional: true,
    title: 'KI-Chat im Plugin',
    text: chatReady.value
      ? `Mit ${state.value?.providers.find(p => p.id === state.value?.settings.provider)?.label ?? 'KI'}.`
      : state.value?.chat_error || 'Mit eigenem API-Schlüssel von Mistral, OpenAI oder Anthropic – oder einem lokalen Modell.',
    action: chatReady.value ? 'Ändern' : 'Einrichten',
    to: '/ki-chat'
  },
  {
    done: claudeReady.value,
    optional: true,
    title: 'Claude verbinden',
    text: claudeReady.value
      ? 'Claude kann das geöffnete Dokument bearbeiten.'
      : claudeLoading.value && !claude.value
        ? 'Wird geprüft …'
        : 'Dann bearbeitet Claude das in der Desktop-App geöffnete Dokument.',
    action: claudeReady.value ? 'Details' : 'Verbinden',
    to: '/claude'
  }
])

const open = computed(() => steps.value.filter(s => !s.done && !s.optional).length)
const background = computed(() => info.value?.platform === 'macos' ? 'in der Menüleiste oben rechts' : 'im Infobereich der Taskleiste')
</script>

<template>
  <AppPage title="Übersicht">
    <div>
      <h1 class="text-2xl font-semibold text-highlighted">
        {{ open ? 'Noch ein Schritt bis zum ersten Arbeitsblatt' : 'Alles bereit' }}
      </h1>
      <p class="mt-1 text-muted">
        {{ open ? 'Danach findest du den Assistenten in jedem Dokument der Desktop-App.' : 'Öffne ein Dokument in der Desktop-App: Plugins → Arbeitsblatt-Assistent.' }}
      </p>
    </div>

    <ol class="worksheet overflow-hidden rounded-lg border border-default">
      <li v-for="(step, i) in steps" :key="step.title" class="flex min-h-18 items-center gap-4 pe-4">
        <span class="flex w-13 shrink-0 justify-center self-stretch items-center">
          <UIcon
            :name="step.done ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            class="size-6"
            :class="step.done ? 'text-success' : 'text-dimmed'"
          />
        </span>
        <div class="min-w-0 flex-1 py-3">
          <p class="font-medium text-highlighted">
            {{ i + 1 }}. {{ step.title }}
            <span v-if="step.optional && !step.done" class="font-normal text-muted">(optional)</span>
          </p>
          <p class="text-sm text-muted">{{ step.text }}</p>
        </div>
        <UButton
          :to="step.to"
          :color="step.done || step.optional ? 'neutral' : 'primary'"
          :variant="step.done ? 'ghost' : step.optional ? 'outline' : 'solid'"
          size="sm"
        >
          {{ step.action }}
        </UButton>
      </li>
    </ol>

    <div class="flex gap-3 text-sm text-muted">
      <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
      <p>
        Das Fenster kannst du schließen: Der Arbeitsblatt-Assistent läuft {{ background }} weiter, damit KI-Chat und
        Claude funktionieren. Beenden kannst du ihn dort oder unter Einstellungen.
      </p>
    </div>
  </AppPage>
</template>
