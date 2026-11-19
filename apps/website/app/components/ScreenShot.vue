<script setup lang="ts">
// A screenshot from public/img/ (taken by dev/eurooffice/website-screenshots.mjs) in a frame.
// Pictures of worksheets stay on white paper, also in dark mode. `zoom` links to the full-size picture.
const props = defineProps<{ name: string, alt: string, width: number, height: number, eager?: boolean, zoom?: boolean }>()
const c = useContent()
const base = useRuntimeConfig().app.baseURL
const src = computed(() => `${base}img/${props.name}`)
</script>

<template>
  <component
    :is="zoom ? 'a' : 'div'"
    :href="zoom ? src : undefined"
    :target="zoom ? '_blank' : undefined"
    :title="zoom ? c.footer.zoom : undefined"
    class="block overflow-hidden rounded-xl bg-white shadow-xl ring ring-default"
    :class="zoom && 'transition hover:ring-2 hover:ring-primary'"
  >
    <img
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      class="h-auto w-full"
    >
  </component>
</template>
