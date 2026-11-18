import de from '~/content/de'
import en from '~/content/en'
import es from '~/content/es'
import fr from '~/content/fr'
import it from '~/content/it'
import nl from '~/content/nl'
import pl from '~/content/pl'
import type { SiteContent } from '~/content/types'

const ALL: Record<string, SiteContent> = { de, en, fr, es, it, nl, pl }

/** The page texts in the current language. */
export function useContent() {
  const { locale } = useI18n()
  return computed<SiteContent>(() => ALL[locale.value] ?? de)
}

/** Replace {name} placeholders. */
export function fmt(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}
