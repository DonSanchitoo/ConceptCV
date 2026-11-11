import type { CvDoc, Lang, LetterDoc } from '../types'
import { COMPACT_TYPES, cityLine, dateRange, fullName } from '../lib/util'
import { contactEntries } from '../render/shared'

const STOP_FR = `a afin ai ainsi alors au aucun aussi autre aux avec avoir avez avons bien bon car ce cela ces cet cette ceux chaque chez comme comment dans de des du donc dont elle elles en encore entre est et etc etre eu fait faire fois font hors ici il ils je la le les leur leurs lors lui ma mais me meme mes moi moins mon ne nos notre nous on ont ou par parce pas peu peut plus pour pourquoi qu quand que quel quelle quelles quels qui sa sans se sera ses si son sont sous sur ta tandis te tes toi ton tous tout toute toutes tres tu un une vers via vos votre vous y sein selon toujours depuis tant ainsi notamment egalement plusieurs divers differents differentes
poste profil mission missions entreprise societe groupe equipe equipes recherche recherchons rejoindre rejoignez candidat candidature offre emploi cdi cdd stage travail experience experiences annee annees ans mois niveau bac minimum souhaite souhaitee requis requise ideal idealement capable capacite sens bonne bonnes fort forte solide premiere premier nouveau nouvelle nouveaux principales principal suivantes suivants possibilite avantages salaire remuneration temps lieu date debut contrat type description competences competence connaissance connaissances maitrise maitrisez savoir etes serez aurez devrez pourrez assurer assurez participer participez contribuer realiser effectuer mettre place oeuvre cadre charge lien aupres ensemble quotidien client clients besoin besoins`
const STOP_EN = `a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who why will with would you your etc via per within across including
role position job team teams company work working experience experiences year years month months candidate applicant apply application looking join joining ideal ideally strong excellent good great ability able skills skill knowledge required requirements preferred plus must will responsibilities responsibility duties include including ensure provide support help make new opportunity benefits salary full time part contract based location description need needs day daily well using use understanding proven track record`

const STOP: Record<Lang, Set<string>> = {
  fr: new Set(STOP_FR.split(/\s+/)),
  en: new Set(STOP_EN.split(/\s+/)),
}
const ALL_STOP = new Set([...STOP.fr, ...STOP.en])

export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")

/** Racine grossière : assez pour rapprocher singulier/pluriel et féminin/masculin. */
export const stem = (w: string): string => {
  let s = norm(w)
  if (s.length > 4) s = s.replace(/(ies)$/, 'y').replace(/(es|s|x)$/, '')
  if (s.length > 5) s = s.replace(/(e)$/, '')
  return s
}

export const words = (text: string): string[] => text.match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-/]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) ?? []

export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0)

export const detectLang = (text: string): Lang => {
  const ws = words(norm(text))
  let fr = 0
  let en = 0
  for (const w of ws) {
    if (STOP.fr.has(w) && !STOP.en.has(w)) fr++
    if (STOP.en.has(w) && !STOP.fr.has(w)) en++
  }
  return en > fr ? 'en' : 'fr'
}

export interface Keyword {
  term: string
  count: number
  score: number
  stems: string[]
}

/** Extrait les termes saillants d'une offre : mots et paires de mots, pondérés par fréquence et par forme. */
export const extractKeywords = (jobText: string, max = 30): Keyword[] => {
  const map = new Map<string, Keyword & { proper: number }>()
  const add = (term: string, stems: string[], proper: boolean, bonus: number) => {
    const key = stems.join(' ')
    const k = map.get(key) ?? { term, count: 0, score: 0, stems, proper: 0 }
    k.count++
    k.score += bonus
    if (proper) k.proper++
    map.set(key, k)
  }
  for (const sentence of jobText.split(/[.\n;:!?•·•()]+/)) {
    const toks = words(sentence)
    const info = toks.map((t, i) => {
      const n = norm(t).replace(/^[ldjnscm]'/, '').replace(/^qu'/, '')
      const techy = /[A-Z]{2,}|[+#\d]|^[A-Z][a-z]+[A-Z]/.test(t)
      const proper = techy || (i > 0 && /^\p{Lu}/u.test(t))
      const ok = !ALL_STOP.has(n) && (n.length >= 3 || techy) && !/^\d+$/.test(n)
      return { t: t.replace(/^[ldjnscm]['’]/i, ''), n, ok, proper }
    })
    info.forEach((w, i) => {
      if (!w.ok) return
      add(w.t, [stem(w.n)], w.proper, w.proper ? 1.6 : 1)
      const nx = info[i + 1]
      if (nx?.ok) add(`${w.t} ${nx.t}`, [stem(w.n), stem(nx.n)], w.proper && nx.proper, 1.4)
    })
  }
  const list = [...map.values()].filter((k) => k.count >= 2 || k.proper > 0)
  // Une paire fréquente absorbe ses mots isolés.
  const pairs = list.filter((k) => k.stems.length === 2 && k.count >= 2)
  const absorbed = new Set<string>()
  for (const p of pairs) for (const s of p.stems) if ((map.get(s)?.count ?? 0) <= p.count) absorbed.add(s)
  return list
    .filter((k) => (k.stems.length === 2 ? k.count >= 2 : !absorbed.has(k.stems[0])))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, max)
    .map(({ term, count, score, stems }) => ({ term, count, score, stems }))
}

export interface Match {
  keyword: Keyword
  found: boolean
}

export const matchKeywords = (keywords: Keyword[], text: string): { matches: Match[]; coverage: number } => {
  const set = new Set(words(text).map((w) => stem(w.replace(/^[ldjnscm]['’]/i, ''))))
  const matches = keywords.map((k) => ({ keyword: k, found: k.stems.every((s) => set.has(s)) }))
  const total = matches.reduce((n, m) => n + m.keyword.score, 0)
  const got = matches.reduce((n, m) => n + (m.found ? m.keyword.score : 0), 0)
  return { matches, coverage: total ? Math.round((got / total) * 100) : 0 }
}

/** Texte brut dans l'ordre où un logiciel de tri (ATS) le lira. */
export const cvPlainText = (cv: CvDoc): string => {
  const out: string[] = [fullName(cv.basics), cv.basics.headline, contactEntries(cv.basics).map((c) => c.text).join(' | '), '']
  const order = cv.design.layout === 'sidebar-left' ? [...cv.side, ...cv.main] : [...cv.main, ...cv.side]
  for (const id of order) {
    const s = cv.sections.find((x) => x.id === id)
    if (!s || !s.visible) continue
    const items = s.items.filter((i) => i.visible)
    if (s.type === 'summary' ? !s.text : !items.length) continue
    out.push(s.title.toUpperCase())
    if (s.type === 'summary') out.push(s.text)
    else if (COMPACT_TYPES.includes(s.type))
      for (const i of items) out.push([i.title, i.tags.join(', ') || i.subtitle].filter(Boolean).join(' : '))
    else
      for (const i of items) {
        out.push([i.title, dateRange(i)].filter(Boolean).join(' — '))
        if (i.subtitle || i.location) out.push([i.subtitle, i.location].filter(Boolean).join(', '))
        if (i.description) out.push(i.description)
        for (const b of i.bullets) out.push(`- ${b}`)
        if (i.tags.length) out.push(i.tags.join(', '))
      }
    out.push('')
  }
  return out.join('\n').trim()
}

export const letterPlainText = (l: LetterDoc): string =>
  [
    fullName(l.sender),
    contactEntries(l.sender).map((c) => c.text).join(' | '),
    '',
    l.recipient.company,
    l.recipient.contact,
    l.recipient.title,
    l.recipient.address,
    cityLine(l.recipient),
    '',
    [l.place, l.date].filter(Boolean).join(l.lang === 'fr' ? ', le ' : ', '),
    '',
    l.subject && `${l.lang === 'fr' ? 'Objet' : 'Subject'} : ${l.subject}`,
    '',
    l.greeting,
    '',
    ...l.paragraphs.flatMap((p) => [p.text, '']),
    l.closing,
    '',
    l.signature,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const letterBody = (l: LetterDoc): string => l.paragraphs.map((p) => p.text).join('\n')
