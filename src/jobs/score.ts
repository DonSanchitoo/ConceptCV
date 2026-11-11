import type { JobQuery, Profile } from '../types'
import { norm, stem, words } from '../analysis/keywords'
import type { RawOffer } from './parse'

export interface Place {
  label: string
  kind: 'commune' | 'departement' | 'region' | 'none'
  insee: string
  city: string
  deptCodes: string[]
  regionCode: string
  /** Noms à retrouver dans le texte d'une offre pour la considérer comme « dans la zone ». */
  names: string[]
}

export const NO_PLACE: Place = { label: '', kind: 'none', insee: '', city: '', deptCodes: [], regionCode: '', names: [] }

export interface ScoredOffer extends RawOffer {
  id: string
  score: number
  reasons: string[]
  inPlace: boolean | null // null : le lieu de l'offre est inconnu
}

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'un', 'une', 'au', 'aux', 'a', 'ou', 'pour', 'sur', 'the', 'of', 'and', 'in', 'h', 'f', 'hf', 'fh'])
const tokens = (s: string): string[] => [...new Set(words(norm(s)).filter((w) => !STOP.has(w) && w.length > 1).map(stem))]
const stemSet = (s: string): Set<string> => new Set(words(norm(s)).map(stem))

export const offerId = (url: string): string => {
  const u = url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
  let h = 0
  for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Termes du profil qui comptent pour reconnaître une offre proche : compétences, titre, intitulés de poste. */
export const profileTerms = (profile: Profile): string[] => {
  const out = new Set<string>()
  for (const s of profile.sections) {
    if (s.type === 'skills') for (const i of s.items) for (const t of i.tags.length ? i.tags : [i.title]) if (t.trim().length > 1) out.add(t.trim())
    if (s.type === 'experience') for (const i of s.items) if (i.title.trim()) out.add(i.title.trim())
  }
  if (profile.basics.headline.trim()) out.add(profile.basics.headline.trim())
  return [...out]
}

const placeTest = (place: Place): ((text: string) => boolean) => {
  const names = place.names.map(norm).filter((n) => n.length > 2)
  const codes = place.deptCodes.map((c) => new RegExp(`\\b${c}\\d{3}\\b|\\(${c}\\)|\\b${c}\\s?-\\s`, 'i'))
  return (text) => {
    const n = norm(text)
    return names.some((x) => n.includes(x)) || codes.some((r) => r.test(text))
  }
}

const daysOld = (iso: string): number | null => (iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000) : null)

/**
 * Note chaque offre sur 100 sans IA : mots-clés dans le titre (45) et le texte (20),
 * compétences du profil retrouvées (20), fraîcheur (10), lieu (5). Écarte ce que la recherche exclut.
 */
export const scoreOffers = (raw: RawOffer[], query: JobQuery, place: Place, profile: Profile, filterByKeyword: (o: RawOffer) => boolean): ScoredOffer[] => {
  const kw = tokens(query.keywords)
  const excluded = tokens(query.exclude)
  const terms = profileTerms(profile).map((t) => ({ label: t, stems: tokens(t) })).filter((t) => t.stems.length)
  const inZone = placeTest(place)
  const contract = norm(query.contract.trim())
  const byId = new Map<string, ScoredOffer>()

  for (const o of raw) {
    const title = stemSet(o.title)
    const all = stemSet(`${o.title} ${o.company} ${o.text}`)
    if (excluded.some((s) => all.has(s))) continue
    const age = daysOld(o.date)
    if (query.maxDays && age !== null && age > query.maxDays) continue
    if (contract && o.contract && !norm(`${o.contract} ${o.title}`).includes(contract)) continue

    const inTitle = kw.filter((s) => title.has(s)).length
    const inText = kw.filter((s) => all.has(s)).length
    if (kw.length && filterByKeyword(o) && inText === 0) continue

    const hasPlace = place.kind !== 'none'
    const where = `${o.location} ${o.title} ${o.text.slice(0, 1500)}`
    const inPlace = !hasPlace ? null : inZone(where) ? true : o.location ? false : null
    if (query.strictPlace && hasPlace && inPlace !== true) continue

    const mine = terms.filter((t) => t.stems.every((s) => all.has(s)))
    const reasons: string[] = []
    let score = 0
    if (kw.length) {
      score += (inTitle / kw.length) * 45 + (inText / kw.length) * 20
      if (inTitle === kw.length) reasons.push('Tous vos mots-clés dans le titre')
      else if (inTitle) reasons.push(`${inTitle} mot(s)-clé(s) sur ${kw.length} dans le titre`)
      else if (inText) reasons.push('Mots-clés dans le texte seulement')
    } else score += 30
    if (mine.length) {
      score += (Math.min(mine.length, 6) / 6) * 20
      reasons.push(`${mine.length} élément(s) de votre profil : ${mine.slice(0, 5).map((t) => t.label).join(', ')}`)
    }
    score += age === null ? 2 : age <= 3 ? 10 : age <= 7 ? 8 : age <= 14 ? 6 : age <= 30 ? 3 : 0
    if (age !== null && age <= 3) reasons.push('Publiée il y a moins de 3 jours')
    score += inPlace === true ? 5 : inPlace === null ? 2 : 0
    if (inPlace === false) reasons.push('Hors de la zone demandée')

    const id = offerId(o.url)
    const scored: ScoredOffer = { ...o, id, score: Math.round(Math.min(100, score)), reasons, inPlace }
    const twin = byId.get(id)
    if (!twin || twin.text.length < scored.text.length) byId.set(id, scored)
  }
  // Même annonce relayée par deux sites : on garde la plus complète.
  const byKey = new Map<string, ScoredOffer>()
  for (const o of byId.values()) {
    const key = `${norm(o.title)}|${norm(o.company)}`
    const twin = o.company ? byKey.get(key) : undefined
    if (!twin || twin.text.length < o.text.length) byKey.set(o.company ? key : o.id, o)
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''))
}
