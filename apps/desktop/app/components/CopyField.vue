<script setup lang="ts">
/** Text to copy (a command, an address) with a copy button. */
const props = defineProps<{ value: string, multiline?: boolean }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
  } catch {
    // Older webviews without the Clipboard API: copy through a selected text field.
    const area = document.createElement('textarea')
    area.value = props.value
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="flex items-start gap-2 rounded-md border border-default bg-elevated/50 p-2 ps-3">
    <pre
      class="selectable min-w-0 flex-1 overflow-x-auto py-1 font-mono text-xs text-default"
      :class="multiline ? 'whitespace-pre' : 'whitespace-nowrap'"
    >{{ value }}</pre>
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :aria-label="copied ? 'Kopiert' : 'Kopieren'"
      @click="copy"
    />
  </div>
</template>
