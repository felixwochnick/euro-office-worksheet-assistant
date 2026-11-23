/**
 * Text content of the website, one object per language (app/content/<code>.ts).
 * Texts may contain `code` and **bold** (rendered by <RichText>), and {placeholders} where noted.
 * Commands, URLs and product names are not translated. German school terms that name a format
 * (Struktogramm, Programmablaufplan, Silbenfärbung, Lineatur …) may be kept and explained.
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

/** A section with a screenshot and a list of points beside it. */
export interface Showcase {
  headline: string
  title: string
  description: string
  imageAlt: string
  items: Item[]
}

export interface SiteContent {
  meta: { title: string, description: string }
  nav: { features: string, informatics: string, ways: string, mcp: string, install: string, faq: string, language: string }
  hero: {
    /** badge above the title, links to the newest feature (3D scenes in the graphics section); {version} = "0.9" */
    badge: string
    headline: string
    title: string
    description: string
    install: string
    more: string
    imageAlt: string
  }
  /**
   * Overview, 13 items in this order: chat, designs, tasks, graphics, 3D bodies, pictures, informatics, music, page,
   * check & solutions, editing, mcp, privacy
   */
  features: { headline: string, title: string, description: string, items: Item[], more: string }
  /** themes: 3 items in this order: classic, modern, primary; items: 3 points below the pictures */
  designs: { headline: string, title: string, description: string, themes: Item[], imageAlt: string, items: Item[] }
  /** 4 items */
  tasks: Showcase
  /** 5 items: number line & coordinate system, charts, formulas, mind maps & drawings, 3D scenes */
  graphics: Showcase
  /** 3 items: pictograms, photos, own pictures */
  pictures: Showcase
  informatics: {
    badge: string
    headline: string
    title: string
    description: string
    /** 6 pictures in this order: class (to fill in), sequence, automaton, structogram, flowchart, ER */
    diagrams: Item[]
    /** 3 points: all diagram types, to fill in, layout */
    items: Item[]
  }
  /** 3 items */
  music: Showcase
  /** 3 items */
  mcp: Showcase & { clientsTitle: string, clientsText: string }
  /** 3 items */
  companion: Showcase
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
    /** 3 groups in this order: worksheets, pictures & diagrams, music – 4–6 example requests each, in the language of the page */
    groups: Array<{ label: string, items: string[] }>
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
    desktop: Step[]
    docker: Step[]
    mcp: Step[]
    readme: string
  }
  faq: { headline: string, title: string, items: Array<{ label: string, content: string }> }
  cta: { title: string, description: string, repo: string, releases: string }
  footer: { license: string, uses: string, copy: string, copied: string, zoom: string }
}
