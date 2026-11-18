<script setup lang="ts">
/**
 * Frame of every page: title bar, the update notice and – for pages that need the server – its start and
 * error states instead of the content.
 */
const props = withDefaults(defineProps<{ title: string, needsServer?: boolean }>(), { needsServer: true })
const { server, state, stateError } = useAssistant()
const ready = computed(() => !props.needsServer || (server.value.state === 'running' && !!state.value))
</script>

<template>
  <div>
    <header class="sticky top-0 z-10 flex h-16 items-center border-b border-default bg-default/90 px-8 backdrop-blur">
      <h1 class="text-lg font-semibold text-highlighted">{{ title }}</h1>
    </header>

    <div class="max-w-2xl space-y-6 px-8 py-7">
      <UpdateNotice />
      <template v-if="ready">
        <slot />
      </template>
      <ServerProblem v-else-if="server.state === 'error'" />
      <UAlert
        v-else-if="server.state === 'running' && stateError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Die Einstellungen konnten nicht geladen werden"
        :description="stateError"
      />
      <div v-else class="flex items-center gap-3 py-10 text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
        <span>Der Arbeitsblatt-Assistent startet …</span>
      </div>
    </div>
  </div>
</template>
