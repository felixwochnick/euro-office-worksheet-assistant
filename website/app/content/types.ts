/**
 * Text content of the website, one object per language (app/content/<code>.ts).
 * Texts may contain `code` and **bold** (rendered by <RichText>), and {placeholders} where noted.
 * Commands, URLs and product names are not translated.
 */
export interface Item {
  title: string
  description: string
}

export interface Step {
  title: string
  description: string
  /** label of the code block below the step (if the step has one) */
  codeLabel?: string
}

export interface SiteContent {
  meta: { title: string, description: string }
  nav: { features: string, ways: string, mcp: string, demo: string, install: string, faq: string, language: string }
  hero: {
    badge: string
    headline: string
    title: string
    description: string
    install: string
    more: string
    imageAlt: string
  }
  /** 6 items, in this order: worksheets, editing, music, mcp, privacy, everywhere */
  features: { headline: string, title: string, description: string, items: Item[] }
  /** 3 ways, in this order: nextcloud, desktop, mcp */
  ways: {
    headline: string
    title: string
    description: string
    items: Array<Item & { badge: string, bullets: string[], link: string }>
  }
  prompts: {
    headline: string
    title: string
    description: string
    worksheetLabel: string
    musicLabel: string
    /** 5 example requests a teacher types (in the language of the page) */
    worksheet: string[]
    /** 5 example requests about music; German note names (c, fis, h …) may stay */
    music: string[]
  }
  mcp: {
    headline: string
    title: string
    description: string
    imageAlt: string
    /** 3 items */
    items: Item[]
    clientsTitle: string
    clientsText: string
  }
  companion: {
    headline: string
    title: string
    description: string
    imageAlt: string
    /** 3 items */
    items: Item[]
  }
  music: {
    headline: string
    title: string
    description: string
    imageAlt: string
    /** 3 items */
    items: Item[]
  }
  demo: {
    headline: string
    title: string
    description: string
    loading: string
    notesLabel: string
    notesHelp: string
    clefLabel: string
    treble: string
    bass: string
    digitsLabel: string
    digitsAuto: string
    digitsOctave: string
    digitsDuration: string
    lyricsLabel: string
    lyricsHelp: string
    showAbc: string
    paperLoading: string
    /** labels of the 4 example buttons: c–f–g, Hänschen klein, note values, bass clef */
    examples: [string, string, string, string]
    /** "{n} notes" */
    noteCount: string
    readAsDurations: string
    readAsOctaves: string
    /** "{meter} time, {bars} bars" */
    meterInfo: string
    issues: {
      /** {token} */
      unknownName: string
      /** {token} */
      doubleAccidental: string
      /** {token}, {octave} */
      farFromStaff: string
      /** {meter}, {bars} */
      incompleteBar: string
      tooManySyllables: string
      tooFewSyllables: string
    }
  }
  parts: {
    headline: string
    title: string
    description: string
    /** 3 cards: plugin, server, language model */
    items: Array<Item & { badge: string, bullets: string[] }>
  }
  install: {
    headline: string
    title: string
    description: string
    /** tab labels: nextcloud, desktop, docker, mcp */
    tabs: { nextcloud: string, desktop: string, docker: string, mcp: string }
    /** 3 steps each */
    nextcloud: Step[]
    /** 3 steps */
    desktop: Step[]
    /** 3 steps */
    docker: Step[]
    /** 3 steps */
    mcp: Step[]
    readme: string
  }
  faq: { headline: string, title: string, items: Array<{ label: string, content: string }> }
  cta: { title: string, description: string, repo: string, releases: string }
  footer: { license: string, uses: string, copy: string, copied: string }
}
