import type { Lang } from '../types'

export interface SpellIssue {
  offset: number
  length: number
  message: string
  bad: string
  replacements: string[]
  kind: 'spelling' | 'grammar' | 'style'
}

interface LtMatch {
  offset: number
  length: number
  message: string
  replacements: { value: string }[]
  rule: { issueType?: string; category?: { id?: string } }
}

/**
 * Correcteur LanguageTool (service public gratuit). Le texte vérifié est envoyé à api.languagetool.org :
 * l'appel n'a lieu qu'à la demande et après accord explicite.
 */
export const checkSpelling = async (text: string, lang: Lang): Promise<SpellIssue[]> => {
  const body = new URLSearchParams({ text, language: lang === 'fr' ? 'fr' : 'en-GB', enabledOnly: 'false' })
  const res = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status === 429) throw new Error('Trop de vérifications à la suite. Réessayez dans une minute.')
  if (!res.ok) throw new Error(`Le correcteur ne répond pas (${res.status}).`)
  const data = (await res.json()) as { matches: LtMatch[] }
  return data.matches
    // Les passages [à compléter] ne sont pas des fautes.
    .filter((m) => text.lastIndexOf('[', m.offset) <= text.lastIndexOf(']', m.offset - 1) || !text.slice(m.offset).includes(']'))
    .map((m) => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      bad: text.slice(m.offset, m.offset + m.length),
      replacements: m.replacements.slice(0, 4).map((r) => r.value),
      kind: m.rule.issueType === 'misspelling' ? 'spelling' : m.rule.category?.id === 'STYLE' || m.rule.issueType === 'style' ? 'style' : 'grammar',
    }))
}
