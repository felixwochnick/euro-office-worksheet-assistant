<script setup lang="ts">
// Live demo: German note names (+ lyrics) -> ABC -> staff, in the browser.
// Uses the same converter as the plugin (shared/abc-tools.js) and abcjs.

interface Issue { code: string, token?: string, error: string, octave?: string, meter?: string, bars?: number }
interface Conversion {
  ok: boolean
  abc: string
  tune: string
  notes: unknown[]
  errors: Issue[]
  warnings: Issue[]
  meter: string | null
  digits: 'octave' | 'duration'
  bars: number | null
}
interface LyricsResult { ok: boolean, abc: string, syllables: number, notes: number, errors: Issue[], warnings: Issue[] }
interface AbcTools {
  germanToAbc(text: string, opts: { clef: string, digits: string }): Conversion
  addLyrics(abc: string, text: string): LyricsResult
}

const examples = [
  { label: 'c – f – g', notes: 'c – f – g', lyrics: '', clef: 'treble' },
  { label: 'Hänschen klein', notes: '4/4 g e e f d d', lyrics: 'Hän-schen klein ging al-lein', clef: 'treble' },
  { label: 'Notenwerte', notes: '4/4 bc1, f1, g2, be2, c1, c1', lyrics: '', clef: 'treble' },
  { label: 'Bassschlüssel', notes: "C D E F G A H c", lyrics: '', clef: 'bass' }
]

const notes = ref(examples[1]!.notes)
const lyrics = ref(examples[1]!.lyrics)
const clef = ref('treble')
const digits = ref('auto')
const clefItems = [{ label: 'Violinschlüssel', value: 'treble' }, { label: 'Bassschlüssel', value: 'bass' }]
const digitItems = [
  { label: 'Ziffern: automatisch', value: 'auto' },
  { label: "Ziffern = Oktave (c1 = c')", value: 'octave' },
  { label: 'Ziffern = Notenwert (c1 = Ganze)', value: 'duration' }
]

const paper = ref<HTMLElement | null>(null)
const ready = ref(false)
const abc = ref('')
const messages = ref<{ type: 'info' | 'warning' | 'error', text: string }[]>([])

let tools: AbcTools | null = null
let abcjs: { renderAbc: (el: HTMLElement, abc: string, opts: object) => unknown } | null = null

function issueText(i: Issue): string {
  switch (i.code) {
    case 'unknown_name': return `„${i.token}“ ist kein bekannter Tonname.`
    case 'double_accidental': return `„${i.token}“ hat zwei Vorzeichen-Angaben.`
    case 'far_from_staff': return `„${i.token}“ liegt in der ${i.octave} – weit außerhalb des Notensystems.`
    case 'incomplete_bar': return `Die Noten füllen keine vollen ${i.meter}-Takte (${String(i.bars).replace('.', ',')} Takte).`
    case 'too_many_syllables': return 'Der Text hat mehr Silben als die Melodie Noten.'
    case 'too_few_syllables': return 'Der Text reicht nicht für alle Noten – die übrigen bleiben ohne Text.'
    default: return i.token ? `${i.token}: ${i.error}` : i.error
  }
}

function update() {
  if (!tools || !abcjs || !paper.value) return
  const msgs: typeof messages.value = []
  const r = tools.germanToAbc(notes.value, { clef: clef.value, digits: digits.value })
  if (r.errors.length) {
    r.errors.forEach(e => msgs.push({ type: 'error', text: issueText(e) }))
  }
  let tune = r.tune
  if (r.notes.length) {
    const info = [`${r.notes.length} Töne`]
    if (/\d/.test(notes.value.replace(/\d+\/\d+/g, ''))) {
      info.push(r.digits === 'duration' ? 'Ziffern als Notenwerte gelesen' : 'Ziffern als Oktaven gelesen')
    }
    if (r.meter) info.push(`${r.meter}-Takt, ${String(r.bars).replace('.', ',')} Takte`)
    msgs.unshift({ type: 'info', text: info.join(' · ') })
  }
  r.warnings.forEach(w => msgs.push({ type: 'warning', text: issueText(w) }))
  if (tune && lyrics.value.trim()) {
    const l = tools.addLyrics(tune, lyrics.value)
    if (l.ok) tune = l.abc
    l.errors.forEach(e => msgs.push({ type: 'error', text: issueText(e) }))
    l.warnings.forEach(w => msgs.push({ type: 'warning', text: issueText(w) }))
  }
  abc.value = tune
  messages.value = msgs
  if (tune) {
    abcjs.renderAbc(paper.value, tune, { responsive: 'resize', add_classes: false, paddingtop: 8, paddingbottom: 8 })
  } else {
    paper.value.innerHTML = ''
  }
}

function useExample(e: typeof examples[number]) {
  notes.value = e.notes
  lyrics.value = e.lyrics
  clef.value = e.clef
  digits.value = 'auto'
}

watch([notes, lyrics, clef, digits], update)

onMounted(async () => {
  // The UMD module ends up as CommonJS in the production build (exports in `default`)
  // and as a plain script in dev (registers window.MusicAbc) – support both.
  const mod = await import('../../../shared/abc-tools.js') as { default?: AbcTools }
  tools = mod.default?.germanToAbc ? mod.default : (window as unknown as { MusicAbc: AbcTools }).MusicAbc
  const abcjsMod = await import('abcjs') as { default?: typeof abcjs }
  abcjs = abcjsMod.default ?? (abcjsMod as unknown as typeof abcjs)
  ready.value = true
  await nextTick()
  update()
})
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-5">
    <div class="space-y-4 lg:col-span-2">
      <UFormField label="Tonnamen (deutsch)" help="z. B. c – f – g, fis' g' a' h', bc = ces, 4/4 = Takt">
        <UInput v-model="notes" size="lg" class="w-full" placeholder="c – f – g" />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Schlüssel">
          <USelect v-model="clef" :items="clefItems" class="w-full" />
        </UFormField>
        <UFormField label="Ziffern">
          <USelect v-model="digits" :items="digitItems" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Liedtext (optional)" help="Silben mit - trennen: Al-le mei-ne Ent-chen">
        <UInput v-model="lyrics" class="w-full" placeholder="Hän-schen klein ging al-lein" />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="e in examples"
          :key="e.label"
          :label="e.label"
          size="xs"
          color="neutral"
          variant="subtle"
          @click="useExample(e)"
        />
      </div>
    </div>

    <div class="space-y-3 lg:col-span-3">
      <div class="abc-paper min-h-40 rounded-lg bg-white p-3 shadow-sm ring ring-default">
        <div ref="paper" />
        <p v-if="!ready" class="p-6 text-center text-sm text-neutral-500">
          Notenzeile wird geladen …
        </p>
      </div>
      <div class="space-y-1.5">
        <UAlert
          v-for="(m, i) in messages"
          :key="i"
          :color="m.type === 'error' ? 'error' : m.type === 'warning' ? 'warning' : 'neutral'"
          :icon="m.type === 'error' ? 'i-lucide-circle-x' : m.type === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
          variant="subtle"
          :title="m.text"
          :ui="{ title: 'text-sm font-normal' }"
        />
      </div>
      <UCollapsible v-if="abc">
        <UButton label="ABC-Notation anzeigen" color="neutral" variant="link" trailing-icon="i-lucide-chevron-down" class="px-0" />
        <template #content>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-elevated p-3 text-xs">{{ abc }}</pre>
        </template>
      </UCollapsible>
    </div>
  </div>
</template>
