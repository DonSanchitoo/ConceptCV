import type { Basics, Item, Section, SectionType } from '../types'
import { emptyBasics, newItem, newSection } from '../lib/util'
import { norm } from '../analysis/keywords'

/** Fragment de texte positionné, tel qu'extrait d'un PDF (origine en bas à gauche). */
export interface Seg {
  text: string
  x: number
  y: number
  w: number
  size: number
  page: number
}

interface Line {
  segs: Seg[]
  text: string
  x: number
  y: number
  size: number
  page: number
  gap: number // distance verticale avec la ligne précédente
}

const HEADINGS: [SectionType, RegExp][] = [
  ['experience', /^(experiences?( professionnelles?)?|parcours( professionnel)?|work experience|professional experience|employment( history)?|experience)$/],
  ['education', /^(formations?|etudes|diplomes?|education|cursus|formation et diplomes)$/],
  ['skills', /^(competences( techniques| cles)?|skills|technical skills|savoir-faire|expertise|outils)$/],
  ['languages', /^(langues?|languages)$/],
  ['interests', /^(centres? d'interets?|loisirs|interets|hobbies|interests|passions)$/],
  ['summary', /^(profil|a propos( de moi)?|resume|objectif|profile|summary|about( me)?|presentation)$/],
  ['certifications', /^(certifications?|certificats?|certificates?)$/],
  ['projects', /^(projets?|projects|realisations)$/],
  ['strengths', /^(atouts|qualites|soft skills|savoir-etre|points forts|strengths)$/],
  ['volunteering', /^(benevolat|engagements?|volunteering|vie associative)$/],
  ['references', /^(references?)$/],
  ['awards', /^(distinctions?|prix|awards)$/],
  ['publications', /^(publications?)$/],
]
const CONTACT = /^(contact|coordonnees|informations personnelles|infos|personal details)$/

const MONTH = "(?:janv?\\.?|janvier|f[ée]vr?\\.?|f[ée]vrier|mars|avr\\.?|avril|mai|juin|juil\\.?|juillet|ao[uû]t|sept?\\.?|septembre|oct\\.?|octobre|nov\\.?|novembre|d[ée]c\\.?|d[ée]cembre|jan\\.?|january|feb\\.?|february|march|apr\\.?|april|may|june|july|aug\\.?|august|october|december)"
const DATE = `(?:${MONTH}\\s+)?(?:\\d{1,2}[/.])?(?:19|20)\\d{2}`
const END = `(?:${DATE}|${MONTH}\\s+(?:19|20)\\d{2}|aujourd['’]hui|pr[ée]sent|present|en cours|now|current|actuel)`
const RANGE = new RegExp(`(?:depuis\\s+)?(${DATE}|${MONTH})\\s*(?:[–—-]|à|au|to|\\s)\\s*(${END})\\s*$|(?:depuis\\s+|since\\s+)?(${DATE})\\s*$`, 'i')
const LEVEL = /\b(A1|A2|B1|B2|C1|C2|natif|native|bilingue|bilingual|courant|fluent|interm[ée]diaire|intermediate|d[ée]butant|beginner|notions|scolaire|professionnel|professional|langue maternelle|mother tongue|TOEIC ?\d*|TOEFL ?\d*)\b.*$/i
const BULLET = /^[•\-–—▪■●◦▸►*·]\s+/

const median = (a: number[]): number => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

/** Cherche une gouttière verticale : un x qu'aucun fragment (ou presque) ne traverse. */
const findSplit = (segs: Seg[], width: number): number | null => {
  if (segs.length < 12) return null
  let best: { x: number; run: number } | null = null
  let run = 0
  for (let x = width * 0.18; x <= width * 0.62; x += 2) {
    const crossing = segs.filter((s) => s.x < x - 1 && s.x + s.w > x + 1).length
    const left = segs.filter((s) => s.x + s.w <= x + 1).length
    const right = segs.filter((s) => s.x >= x - 1).length
    const ok = crossing <= Math.max(1, segs.length * 0.03) && left >= segs.length * 0.12 && right >= segs.length * 0.12
    run = ok ? run + 1 : 0
    if (ok && (!best || run > best.run)) best = { x: x - run + 1, run }
  }
  return best && best.run >= 3 ? best.x : null
}

/**
 * Certains PDF n'indiquent pas à quel caractère correspondent leurs tirets et parenthèses :
 * le fragment arrive vide ou en caractère privé. On le marque (U+FFFD) puis on le rétablit d'après le contexte.
 */
export const UNKNOWN = '\uFFFD'
const repair = (t: string): string =>
  t
    .replace(/^\uFFFD\s+/, '• ')
    .replace(/(\p{L})\uFFFD(\p{L})/gu, '$1-$2')
    .replace(/(^|\s)\uFFFD(?=\S)/g, '$1(')
    .replace(/(?<=\S)\uFFFD(?=$|[\s,.;:])/g, ')')
    .replace(/\s\uFFFD\s/g, ' – ')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const toLines = (segs: Seg[]): Line[] => {
  const sorted = [...segs].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  const rows: Seg[][] = []
  for (const s of sorted) {
    const row = rows[rows.length - 1]
    if (row && row[0].page === s.page && Math.abs(row[0].y - s.y) < Math.max(2, s.size * 0.45)) row.push(s)
    else rows.push([s])
  }
  const lines = rows.map((row) => {
    const segsRow = row.sort((a, b) => a.x - b.x)
    // Fusionne les fragments contigus ; un grand blanc sépare deux cellules (intitulé / dates).
    const cells: Seg[] = []
    for (const s of segsRow) {
      const last = cells[cells.length - 1]
      if (last && s.x - (last.x + last.w) < Math.max(14, s.size * 1.8)) {
        const space = s.x - (last.x + last.w) > s.size * 0.18 && !last.text.endsWith(' ') ? ' ' : ''
        last.text += space + s.text
        last.w = s.x + s.w - last.x
        last.size = Math.max(last.size, s.size)
      } else cells.push({ ...s })
    }
    const kept = cells.map((c) => ({ ...c, text: repair(c.text.replace(/\s+/g, ' ').trim()) })).filter((c) => c.text)
    return { segs: kept, text: kept.map((c) => c.text).join('  '), x: kept[0]?.x ?? 0, y: row[0].y, size: Math.max(...row.map((r) => r.size)), page: row[0].page, gap: 0 }
  })
  const out = lines.filter((l) => l.text)
  out.forEach((l, i) => {
    const p = out[i - 1]
    l.gap = p && p.page === l.page ? p.y - l.y : 0
  })
  return out
}

const headingOf = (l: Line): { type: SectionType | 'contact'; title: string } | null => {
  if (l.segs.length > 1 || l.text.split(/\s+/).length > 5 || /[@\d]/.test(l.text)) return null
  const n = norm(l.text).replace(/[:.]+$/, '').trim()
  if (CONTACT.test(n)) return { type: 'contact', title: l.text }
  for (const [type, re] of HEADINGS) if (re.test(n)) return { type, title: l.text }
  const letters = l.text.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 4 && letters === letters.toUpperCase() && !/[,;]/.test(l.text)) return { type: 'custom', title: l.text }
  return null
}

/** « EXPÉRIENCE PROFESSIONNELLE » → « Expérience professionnelle », en gardant les sigles (« IA appliquée »). */
const nice = (t: string): string => {
  if (t !== t.toUpperCase()) return t
  const [first, ...rest] = t.split(' ')
  const head = first.length <= 3 ? first : first.charAt(0) + first.slice(1).toLowerCase()
  return [head, ...rest.map((w) => w.toLowerCase())].join(' ')
}

const splitDates = (s: string): { start: string; end: string } => {
  const m = RANGE.exec(s.trim())
  if (!m) return { start: '', end: '' }
  if (m[3]) return /^(depuis|since)/i.test(s.trim()) ? { start: m[3], end: "aujourd'hui" } : { start: '', end: m[3] }
  return { start: m[1], end: m[2] }
}

/** Regroupe des lignes en puces : marqueur explicite, ou saut de ligne plus grand que l'interligne. */
const toBullets = (lines: Line[], globalLead: number): string[] => {
  const out: string[] = []
  // L'interligne se mesure sur le bloc lui-même : c'est le plus petit écart entre deux lignes.
  const gaps = lines.slice(1).map((l) => l.gap).filter((g) => g > 0)
  const lead = gaps.length >= 2 ? Math.min(...gaps) / 1.12 : globalLead
  for (const l of lines) {
    const marked = BULLET.test(l.text)
    const text = l.text.replace(BULLET, '')
    const prev = out[out.length - 1]
    const newOne = marked || !prev || l.gap > lead * 1.28 || l.gap <= 0
    if (newOne) out.push(text)
    else out[out.length - 1] = `${prev}${prev.endsWith('-') ? '' : ' '}${text}`
  }
  return out
}

const parseEntries = (lines: Line[], lead: number): Item[] => {
  const items: { head: Line; rest: Line[] }[] = []
  let loose: Line[] = []
  for (const l of lines) {
    const last = l.segs[l.segs.length - 1]?.text ?? ''
    const dated = RANGE.test(last) && (l.segs.length > 1 || l.text.length < 70) && !BULLET.test(l.text)
    if (dated) items.push({ head: l, rest: [] })
    else if (items.length) items[items.length - 1].rest.push(l)
    else loose.push(l)
  }
  const out: Item[] = []
  if (loose.length) out.push(newItem({ bullets: toBullets(loose, lead) }))
  for (const { head, rest } of items) {
    let title = head.segs.length > 1 ? head.segs.slice(0, -1).map((s) => s.text).join(' ') : head.text.replace(RANGE, '').replace(/[\s,|–—-]+$/, '')
    const dates = splitDates(head.segs[head.segs.length - 1].text)
    let subtitle = ''
    let location = ''
    let body = rest
    // Dates seules sur leur ligne : l'intitulé est la ligne suivante.
    if (!title && body.length) {
      title = body[0].text
      body = body.slice(1)
    }
    const sub = body[0]
    if (sub && !BULLET.test(sub.text) && sub.text.length < 90 && !/[.!?]$/.test(sub.text)) {
      const parts = sub.text.split(/\s+[·•|]\s+|\s+[–—]\s+|\s{2,}/)
      subtitle = parts[0]
      location = parts.slice(1).join(', ')
      body = body.slice(1)
    }
    out.push(newItem({ title, subtitle, location, ...dates, bullets: toBullets(body, lead) }))
  }
  return out
}

const parseCompact = (lines: Line[], type: SectionType): Item[] => {
  if (type === 'languages')
    return lines.map((l) => {
      const m = LEVEL.exec(l.text)
      const title = (m ? l.text.slice(0, m.index) : l.text).replace(/[\s:–—-]+$/, '')
      return newItem({ title, subtitle: m ? m[0].trim() : '' })
    })
  const clean = lines.map((l) => l.text.replace(BULLET, ''))
  const hasLists = clean.some((t) => t.includes(','))
  if (!hasLists) {
    if (clean.length === 1 && /[·|•]/.test(clean[0])) return clean[0].split(/\s*[·|•]\s*/).filter(Boolean).map((t) => newItem({ title: t }))
    return clean.map((t) => newItem({ title: t }))
  }
  // Groupes « Titre » puis « a, b, c » (éventuellement sur plusieurs lignes), ou « Titre : a, b, c ».
  const groups: { title: string; body: string }[] = []
  clean.forEach((t, i) => {
    const colon = /^([^:,]{2,40})\s*:\s*(.+)$/.exec(t)
    const prev = clean[i - 1]
    const isTitle = !t.includes(',') && t.split(/\s+/).length <= 5 && (!prev || !prev.trim().endsWith(',')) && !!clean[i + 1]
    if (colon) groups.push({ title: colon[1], body: colon[2] })
    else if (isTitle || !groups.length) groups.push({ title: isTitle ? t : '', body: isTitle ? '' : t })
    else groups[groups.length - 1].body += ` ${t}`
  })
  return groups.map((g) => {
    const tags = g.body.split(',').map((x) => x.trim()).filter(Boolean)
    return g.title ? newItem({ title: g.title, tags }) : newItem({ title: tags.join(', ') })
  })
}

export interface ParsedCv {
  basics: Basics
  sections: Section[]
}

export const parseCv = (segs: Seg[], pageWidth: number): ParsedCv => {
  const basics = emptyBasics()
  const all = segs
    .map((s) => (s.text === '' && s.w > 0.5 ? { ...s, text: UNKNOWN } : { ...s, text: s.text.replace(/[\uE000-\uF8FF]/g, UNKNOWN) }))
    .filter((s) => s.text.trim())
  const split = findSplit(all, pageWidth)
  const cols = split === null ? [all] : [all.filter((s) => s.x + s.w / 2 < split), all.filter((s) => s.x + s.w / 2 >= split)]
  const columns = cols.map(toLines)
  const lead = median(columns.flat().map((l) => l.gap).filter((g) => g > 0)) || 12
  const fullText = columns.flat().map((l) => l.text).join('\n')

  basics.email = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(fullText)?.[0] ?? ''
  basics.phone = /(?:\+\d{1,3}[\s.]?)?(?:\(0\)\s?)?0?\d(?:[\s.-]?\d{2}){4}/.exec(fullText)?.[0].trim() ?? ''
  basics.linkedin = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-%]+\/?/i.exec(fullText)?.[0] ?? ''
  basics.github = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i.exec(fullText)?.[0] ?? ''

  const sections: Section[] = []
  const preambles: Line[][] = []
  const extra: string[] = []

  // Si la plupart des titres sont en capitales, un mot isolé en minuscules n'est pas un titre.
  const isCaps = (t: string) => t === t.toUpperCase()
  const found = columns.flat().map((l) => headingOf(l)).filter((h) => h && h.type !== 'custom')
  const capsOnly = found.length >= 2 && found.filter((h) => isCaps(h!.title)).length / found.length >= 0.6

  for (const lines of columns) {
    let cur: { type: SectionType | 'contact'; title: string; lines: Line[] } | null = null
    const pre: Line[] = []
    const groups: { type: SectionType | 'contact'; title: string; lines: Line[] }[] = []
    for (const l of lines) {
      const raw = headingOf(l)
      const h = raw && capsOnly && !isCaps(raw.title) ? null : raw
      // Une ligne en capitales avant toute rubrique est le plus souvent le nom.
      if (h && !(h.type === 'custom' && !cur && !groups.length && pre.length < 3)) {
        cur = { ...h, lines: [] }
        groups.push(cur)
      } else if (cur) cur.lines.push(l)
      else pre.push(l)
    }
    preambles.push(pre)
    for (const g of groups) {
      if (g.type === 'contact') {
        for (const l of g.lines) {
          const t = l.text
          if (basics.email && t.includes(basics.email)) continue
          if (basics.phone && t.includes(basics.phone)) continue
          if (/linkedin\.com|github\.com/i.test(t)) continue
          const cp = /^(\d{5})\s+(.+)$/.exec(t)
          if (cp) {
            basics.postalCode = cp[1]
            basics.city = cp[2]
          } else if (!basics.city && /^[\p{Lu}][\p{L}' -]+(\s*\(\d{2,3}\))?$/u.test(t) && t.length < 40) basics.city = t
          else if (/^(https?:\/\/|www\.)/i.test(t) && !basics.website) basics.website = t
          else extra.push(t)
        }
        continue
      }
      const type = g.type
      const s = newSection(type, 'fr', { title: nice(g.title) })
      if (type === 'summary') s.text = g.lines.map((l) => l.text).join(' ')
      else if (['skills', 'languages', 'interests', 'strengths'].includes(type)) s.items = parseCompact(g.lines, type)
      else s.items = parseEntries(g.lines, lead)
      if (s.text || s.items.length) sections.push(s)
    }
  }

  // Avant la première rubrique : nom, titre du CV, accroche.
  const skip = (l: Line) => (basics.email && l.text.includes(basics.email)) || (basics.phone && l.text.includes(basics.phone))
  const pres = preambles.map((p) => p.filter((l) => !skip(l)))
  const pre = pres.flat()
  if (pre.length) {
    const looksLikeName = (l: Line) => {
      const ws = l.text.split(/\s+/)
      return ws.length >= 2 && ws.length <= 4 && !/\d/.test(l.text) && ws.every((w) => /^\p{Lu}/u.test(w))
    }
    const bySize = [...pre].sort((a, b) => b.size - a.size)
    const names = bySize.filter(looksLikeName)
    const nameLine = names.find((l) => l.text.split(/\s+/).some((w) => w.length > 1 && w === w.toUpperCase())) ?? names[0] ?? bySize[0]
    const parts = nameLine.text.split(/\s+/)
    const upper = parts.filter((p) => p.length > 1 && p === p.toUpperCase())
    if (upper.length && upper.length < parts.length) {
      basics.lastName = upper.join(' ')
      basics.firstName = parts.filter((p) => !upper.includes(p)).join(' ')
    } else {
      basics.firstName = parts[0] ?? ''
      basics.lastName = parts.slice(1).join(' ')
    }
    const cap = (w: string) => w.charAt(0) + w.slice(1).toLowerCase()
    basics.lastName = basics.lastName.split(' ').map(cap).join(' ')
    const col = pres.find((p) => p.includes(nameLine)) ?? pre
    const others = col.filter((l) => l !== nameLine)
    const head = [...others].sort((a, b) => b.size - a.size).find((l) => l.text.length < 60 && !/[.!?,]$/.test(l.text))
    if (head) basics.headline = head.text
    const para = others.filter((l) => l !== head)
    const text = para.map((l) => l.text).join(' ')
    if (text.length > 40 && !sections.some((s) => s.type === 'summary')) sections.unshift(newSection('summary', 'fr', { text }))
    else for (const l of para) extra.push(l.text)
    for (const l of pre.filter((x) => !col.includes(x))) extra.push(l.text)
  }
  basics.extra = extra.filter((t) => t.length < 60).slice(0, 2).join(' · ')

  const order: SectionType[] = ['summary', 'experience', 'projects', 'custom', 'education', 'certifications', 'volunteering', 'awards', 'publications', 'skills', 'strengths', 'languages', 'interests', 'references']
  sections.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
  return { basics, sections }
}
