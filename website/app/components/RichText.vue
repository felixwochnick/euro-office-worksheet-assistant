<script setup lang="ts">
// Renders `code` and **bold** in translated texts – as elements, never as HTML.
const props = defineProps<{ text: string }>()

const parts = computed(() =>
  props.text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('`') && p.endsWith('`')) return { type: 'code', text: p.slice(1, -1) }
      if (p.startsWith('**') && p.endsWith('**')) return { type: 'strong', text: p.slice(2, -2) }
      return { type: 'text', text: p }
    })
)
</script>

<template>
  <span><template v-for="(p, i) in parts" :key="i"><code v-if="p.type === 'code'" class="rounded bg-elevated px-1 py-0.5 text-[0.9em]">{{ p.text }}</code><strong v-else-if="p.type === 'strong'">{{ p.text }}</strong><template v-else>{{ p.text }}</template></template></span>
</template>
