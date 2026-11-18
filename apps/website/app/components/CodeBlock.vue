<script setup lang="ts">
// Shell snippet with a copy button.
const props = defineProps<{ code: string, label?: string }>()
const copied = ref(false)
const c = useContent()

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard not available (e.g. insecure context) – the text can still be selected.
  }
}
</script>

<template>
  <div class="relative rounded-lg border border-default bg-elevated/60">
    <div v-if="label" class="border-b border-default px-4 py-1.5 text-xs font-medium text-muted">
      {{ label }}
    </div>
    <!-- Long commands wrap (copying still uses the original text) -->
    <pre class="whitespace-pre-wrap p-4 pr-12 text-sm leading-relaxed [overflow-wrap:anywhere]"><code>{{ code }}</code></pre>
    <UButton
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :color="copied ? 'success' : 'neutral'"
      variant="ghost"
      size="sm"
      class="absolute right-2"
      :class="label ? 'top-9' : 'top-2'"
      :aria-label="copied ? c.footer.copied : c.footer.copy"
      @click="copy"
    />
  </div>
</template>
