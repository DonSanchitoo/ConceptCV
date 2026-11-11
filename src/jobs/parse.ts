
/** Offre brute, avant notation. */
export interface RawOffer {
  title: string
  company: string
  location: string
  date: string // ISO, ou vide si inconnue
  url: string
  text: string
  contract: string
  salary: string
  source: string
}

const clean = (s: string | null | undefined): string => (s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()

/** Texte lisible d'un fragment HTML, sans balises ni scripts. */
export const htmlToText = (html: string): string => {
  if (!/[<&]/.test(html)) return clean(html)
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove())
  doc.querySelectorAll('br,p,div,li,h1,h2,h3,h4,tr').forEach((n) => n.append('\n'))
  return clean(doc.body.textContent)
}

const toIso = (s: string): string => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

const unescape = (s: string): string => {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s)
  if (cdata) return cdata[1]
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&')
}

/** Contenu de la première balise trouvée parmi `names` (avec ou sans préfixe, ex. dc:creator). */
const tag = (block: string, names: string[]): string => {
  for (const n of names) {
    const m = new RegExp(`<(?:[\\w-]+:)?${n}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${n}>`, 'i').exec(block)
    if (m && m[1].trim()) return unescape(m[1]).trim()
  }
  return ''
}

/**
 * Lit un flux RSS 2.0 ou Atom. Lecture tolérante par motifs plutôt que par un analyseur XML strict :
 * beaucoup de flux réels sont légèrement mal formés et seraient rejetés en bloc.
 */
export const parseFeed = (xml: string, source: string): RawOffer[] => {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  return blocks
    .map((b) => {
      const href = /<link[^>]*\shref=["']([^"']+)["'][^>]*>/i.exec(b)?.[1]
      const url = unescape(href || tag(b, ['link']) || tag(b, ['guid', 'id']))
      const author = tag(b, ['author'])
      return {
        title: htmlToText(tag(b, ['title'])),
        company: clean(htmlToText(tag(b, ['creator']) || (/<name>/.test(author) ? tag(author, ['name']) : ''))),
        location: '',
        date: toIso(tag(b, ['pubDate', 'published', 'updated', 'date'])),
        url: url.trim(),
        text: htmlToText(tag(b, ['encoded', 'content', 'description', 'summary'])).slice(0, 8000),
        contract: '',
        salary: '',
        source,
      }
    })
    .filter((o) => o.title && /^https?:/.test(o.url))
}

const NAV = /^(accueil|connexion|inscription|contact|mentions|cgu|rss|suivant|precedent|précédent|page \d+|\d+|voir plus|lire la suite|en savoir plus|postuler|se connecter|rechercher|filtrer)$/i

/**
 * Page de résultats quelconque : on garde les liens qui ressemblent à un titre d'offre.
 * Rustique mais sans réglage par site. Les sites construits en JavaScript ne renvoient rien.
 */
export const parseListPage = (html: string, baseUrl: string, source: string): RawOffer[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,nav,footer,header,noscript').forEach((n) => n.remove())
  const seen = new Set<string>()
  const out: RawOffer[] = []
  for (const a of doc.querySelectorAll('a[href]')) {
    const title = clean(a.textContent).replace(/\n/g, ' ')
    if (title.length < 12 || title.length > 160 || NAV.test(title) || title.split(' ').length < 2) continue
    let url: string
    try {
      url = new URL(a.getAttribute('href')!, baseUrl).toString()
    } catch {
      continue
    }
    if (!/^https?:/.test(url) || url.split('#')[0] === baseUrl.split('#')[0] || seen.has(url)) continue
    seen.add(url)
    // Le bloc qui entoure le lien donne souvent l'employeur, le lieu et la date.
    const box = a.closest('article, li, tr, .card, .offre, .job, .result') ?? a.parentElement
    const around = clean(box?.textContent).replace(/\n/g, ' · ').slice(0, 600)
    const time = box?.querySelector('time')?.getAttribute('datetime') ?? ''
    out.push({ title, company: '', location: '', date: toIso(time), url, text: around === title ? '' : around, contract: '', salary: '', source })
  }
  return out
}

interface FtOffer {
  id: string
  intitule?: string
  description?: string
  dateCreation?: string
  lieuTravail?: { libelle?: string }
  entreprise?: { nom?: string }
  typeContratLibelle?: string
  typeContrat?: string
  salaire?: { libelle?: string }
  origineOffre?: { urlOrigine?: string }
}

export const parseFranceTravail = (resultats: unknown[], source: string): RawOffer[] =>
  (resultats as FtOffer[]).map((o) => ({
    title: clean(o.intitule),
    company: clean(o.entreprise?.nom),
    location: clean(o.lieuTravail?.libelle),
    date: toIso(o.dateCreation ?? ''),
    url: o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
    text: clean(o.description).slice(0, 8000),
    contract: clean(o.typeContratLibelle || o.typeContrat),
    salary: clean(o.salaire?.libelle),
    source,
  }))

type Json = Record<string, unknown>
const findPosting = (v: unknown): Json | null => {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findPosting(x)
      if (r) return r
    }
    return null
  }
  const o = v as Json
  const t = o['@type']
  if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return o
  return findPosting(o['@graph'])
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Lit la page d'une offre : données structurées JobPosting si le site en publie, sinon titre et texte principal. */
export const extractJob = (html: string, url: string): RawOffer => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const meta = (p: string) => doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') ?? ''
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* adresse libre */
  }
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const p = findPosting(JSON.parse(s.textContent ?? ''))
      if (!p) continue
      const org = p.hiringOrganization as Json | undefined
      const loc = (Array.isArray(p.jobLocation) ? p.jobLocation[0] : p.jobLocation) as Json | undefined
      const addr = loc?.address as Json | undefined
      const salary = p.baseSalary as Json | undefined
      const value = salary?.value as Json | undefined
      return {
        title: clean(str(p.title)),
        company: clean(str(org?.name)),
        location: clean([str(addr?.addressLocality), str(addr?.postalCode)].filter(Boolean).join(' ')),
        date: toIso(str(p.datePosted)),
        url,
        text: htmlToText(str(p.description)).slice(0, 8000),
        contract: clean(Array.isArray(p.employmentType) ? p.employmentType.join(', ') : str(p.employmentType)),
        salary: value ? clean([value.minValue, value.maxValue].filter(Boolean).join(' à ') + ' ' + str(salary?.currency)) : '',
        source: host,
      }
    } catch {
      /* JSON invalide : on essaie le bloc suivant */
    }
  }
  const rawTitle = meta('og:title') || doc.title || ''
  const parts = splitTitle(rawTitle)
  doc.querySelectorAll('script,style,nav,footer,header,noscript,aside,form').forEach((n) => n.remove())
  const main = doc.querySelector('main, article, [role="main"]') ?? doc.body
  return { title: parts.role, company: parts.company || meta('og:site_name'), location: '', date: '', url, text: htmlToText(main?.innerHTML ?? '').slice(0, 8000), contract: '', salary: '', source: host }
}

/** « Chargé de mission SIG - Département du Gard | Site » → poste et employeur probables. */
export const splitTitle = (title: string): { role: string; company: string } => {
  const parts = clean(title).split(/\s+[|·–-]\s+|\s+chez\s+|\s+at\s+/i).map((p) => p.trim()).filter(Boolean)
  return { role: parts[0] ?? '', company: parts.length > 1 ? parts[1] : '' }
}
