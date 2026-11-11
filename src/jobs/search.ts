import type { JobLink, JobQuery, JobSource, JobsConfig, Profile } from '../types'
import { uid } from '../lib/util'
import { extractJob, parseFeed, parseFranceTravail, parseListPage, type RawOffer } from './parse'
import { scoreOffers, type Place, type ScoredOffer } from './score'

/** Relais déployé pour ce dépôt. Modifiable dans la page Offres. */
export const DEFAULT_RELAY = ''

export const DEFAULT_SOURCES: JobSource[] = [
  { id: 'francetravail', name: 'France Travail', kind: 'francetravail', url: '', enabled: true },
  { id: 'service-public', name: 'Choisir le service public', kind: 'page', url: 'https://choisirleservicepublic.gouv.fr/nos-offres/filtres/mot-cles/{q}/', enabled: true },
]

export const DEFAULT_LINKS: JobLink[] = [
  { id: 'indeed', name: 'Indeed', url: 'https://fr.indeed.com/jobs?q={q}&l={lieu}&sort=date' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords={q}&location={lieu}&sortBy=DD' },
  { id: 'wttj', name: 'Welcome to the Jungle', url: 'https://www.welcometothejungle.com/fr/jobs?query={q}&aroundQuery={lieu}&sortBy=mostRecent' },
  { id: 'apec', name: 'APEC', url: 'https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles={q}&sortsType=DATE' },
  { id: 'ft', name: 'France Travail (site)', url: 'https://candidat.francetravail.fr/offres/recherche?motsCles={q}&tri=1' },
  { id: 'territorial', name: 'Emploi territorial', url: 'https://www.emploi-territorial.fr/emploi-mobilite/?search-fam-metier=&adv-search={q}' },
  { id: 'google', name: 'Google Emploi', url: 'https://www.google.com/search?q={q}+{lieu}+emploi&ibp=htl;jobs' },
]

export const defaultJobs = (): JobsConfig => ({ relayUrl: DEFAULT_RELAY, sources: DEFAULT_SOURCES.map((s) => ({ ...s })), links: DEFAULT_LINKS.map((l) => ({ ...l })), searches: [], hidden: [] })

export const emptyQuery = (): JobQuery => ({ keywords: '', place: '', radius: 30, exclude: '', maxDays: 30, contract: '', strictPlace: false })

export const fillUrl = (tpl: string, q: JobQuery, place: Place): string =>
  tpl
    .replaceAll('{q}', encodeURIComponent(q.keywords.trim()))
    .replaceAll('{lieu}', encodeURIComponent(place.city || place.label.replace(/\s*\(.*\)$/, '') || q.place.trim()))
    .replaceAll('{dept}', encodeURIComponent(place.deptCodes[0] ?? ''))

const relayCall = async <T>(relay: string, params: Record<string, string>): Promise<T> => {
  const base = relay.trim().replace(/\/+$/, '').replace(/\/api\/relay$/, '')
  const res = await fetch(`${base}/api/relay?${new URLSearchParams(params)}`)
  if (res.status === 403) throw new Error('Le relais refuse cette origine')
  if (!res.ok) throw new Error(`Relais injoignable (${res.status})`)
  return (await res.json()) as T
}

interface Page { ok: boolean; status: number; url: string; contentType: string; text: string; error?: string }

export const pingRelay = (relay: string) => relayCall<{ ok: boolean; franceTravail: boolean }>(relay, { op: 'ping' })

export const readPage = async (relay: string, url: string): Promise<Page> => {
  const p = await relayCall<Page>(relay, { op: 'fetch', url })
  if (!p.ok) throw new Error(p.error || (p.status === 403 || p.status === 401 ? 'Le site refuse les lectures automatiques' : `Le site a répondu ${p.status}`))
  return p
}

/** Ajout d'une offre par son adresse : le relais lit la page, l'application en tire poste, employeur et texte. */
export const fetchOffer = async (relay: string, url: string): Promise<RawOffer> => {
  const p = await readPage(relay, url)
  return extractJob(p.text, p.url || url)
}

const FT_DAYS = [1, 3, 7, 14, 31]

const querySource = async (relay: string, s: JobSource, q: JobQuery, place: Place): Promise<RawOffer[]> => {
  if (s.kind === 'francetravail') {
    const params: Record<string, string> = { op: 'francetravail', range: '0-99', sort: '1' }
    if (q.keywords.trim()) params.motsCles = q.keywords.trim()
    if (place.kind === 'commune' && place.insee) Object.assign(params, { commune: place.insee, distance: String(q.radius) })
    else if (place.kind === 'departement' && place.deptCodes[0]) params.departement = place.deptCodes[0]
    else if (place.kind === 'region' && place.regionCode) params.region = place.regionCode
    else if (place.deptCodes[0]) params.departement = place.deptCodes[0]
    if (q.maxDays) params.publieeDepuis = String(FT_DAYS.find((d) => d >= q.maxDays) ?? 31)
    const r = await relayCall<{ ok: boolean; resultats: unknown[]; error?: string }>(relay, params)
    if (!r.ok) throw new Error(r.error || 'France Travail ne répond pas')
    return parseFranceTravail(r.resultats, s.name)
  }
  const url = fillUrl(s.url, q, place)
  const p = await readPage(relay, url)
  const looksLikeFeed = s.kind === 'rss' || /xml|rss|atom/i.test(p.contentType) || /^\s*<\?xml|<rss|<feed/i.test(p.text.slice(0, 300))
  const offers = looksLikeFeed ? parseFeed(p.text, s.name) : parseListPage(p.text, p.url || url, s.name)
  if (!offers.length) throw new Error(looksLikeFeed ? 'Flux vide ou illisible' : 'Aucun lien d’offre trouvé (page construite en JavaScript ?)')
  return offers
}

export interface SourceStatus {
  id: string
  name: string
  count: number
  error?: string
}

export interface SearchResult {
  offers: ScoredOffer[]
  status: SourceStatus[]
  at: string
}

/** Interroge toutes les sources actives en parallèle. Une source en panne n'empêche pas les autres de répondre. */
export const runSearch = async (config: JobsConfig, q: JobQuery, place: Place, profile: Profile): Promise<SearchResult> => {
  const active = config.sources.filter((s) => s.enabled)
  const settled = await Promise.allSettled(active.map((s) => querySource(config.relayUrl, s, q, place)))
  const status: SourceStatus[] = []
  const raw: RawOffer[] = []
  const unfiltered = new Set<string>() // sources qui ne filtrent pas elles-mêmes par mots-clés
  settled.forEach((r, i) => {
    const s = active[i]
    if (r.status === 'fulfilled') {
      raw.push(...r.value)
      status.push({ id: s.id, name: s.name, count: r.value.length })
      if (s.kind !== 'francetravail') unfiltered.add(s.name)
    } else status.push({ id: s.id, name: s.name, count: 0, error: (r.reason as Error)?.message || 'Erreur' })
  })
  const hidden = new Set(config.hidden)
  const offers = scoreOffers(raw, q, place, profile, (o) => unfiltered.has(o.source)).filter((o) => !hidden.has(o.id))
  return { offers, status, at: new Date().toISOString() }
}

export const newSource = (name: string, url: string, kind: 'rss' | 'page'): JobSource => ({ id: uid(), name, kind, url, enabled: true })

/** Signet de capture : exécuté sur la page d'une offre, il ouvre ConceptCV avec l'adresse, le titre et le texte. Rien ne passe par un serveur. */
export const bookmarklet = (appUrl: string): string =>
  `javascript:(()=>{const s=String(getSelection()||'');const x=(s||document.body.innerText).slice(0,6000);open(${JSON.stringify(appUrl)}+'#/capture?u='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title)+'&x='+encodeURIComponent(x))})()`
