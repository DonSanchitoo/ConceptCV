import type { CvDoc, Item, Profile, Section } from '../types'
import { COMPACT_TYPES, clone, newSection, uid } from '../lib/util'
import { cvPlainText, extractKeywords, matchKeywords, norm, stem, words, type Keyword } from './keywords'

export interface Proposal {
  id: string
  kind: 'headline' | 'show' | 'add-item' | 'add-bullet' | 'add-skill' | 'reorder'
  title: string
  detail?: string
  keywords: string[]
  apply: (cv: CvDoc) => void
}

export interface TailorResult {
  proposals: Proposal[]
  missing: Keyword[] // termes de l'offre absents du CV
  unsourced: Keyword[] // absents du CV et introuvables dans le profil
  coverage: number
}

const stems = (text: string): Set<string> => new Set(words(text).map((w) => stem(w.replace(/^[ldjnscm]['’]/i, ''))))
const hits = (text: string, kws: Keyword[]): Keyword[] => {
  const set = stems(text)
  return kws.filter((k) => k.stems.every((s) => set.has(s)))
}
const itemText = (i: Item): string => [i.title, i.subtitle, i.description, ...i.bullets, ...i.tags].join(' \n ')
const same = (a: Item, b: Item): boolean => norm(a.title) === norm(b.title) && norm(a.subtitle) === norm(b.subtitle)
const hash = (s: string): string => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const short = (s: string, n = 90): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/**
 * Compare le CV, le profil et l'offre, et propose des ajustements. Rien n'est appliqué d'office :
 * chaque proposition porte sa propre fonction `apply`, déclenchée par l'utilisateur.
 */
export const tailor = (cv: CvDoc, profile: Profile, jobText: string, role: string): TailorResult => {
  const proposals: Proposal[] = []
  if (jobText.trim().length < 80) return { proposals, missing: [], unsourced: [], coverage: 0 }
  const kws = extractKeywords(jobText, 28)
  const { matches, coverage } = matchKeywords(kws, cvPlainText(cv))
  const missing = matches.filter((m) => !m.found).map((m) => m.keyword)
  const covered = new Set<string>()
  const add = (p: Proposal, found: Keyword[]) => {
    proposals.push(p)
    for (const k of found) covered.add(k.term)
  }

  // Titre du CV
  if (role.trim() && !norm(cv.basics.headline).includes(norm(role.trim())))
    add({
      id: `headline-${hash(role)}`,
      kind: 'headline',
      title: `Reprendre l’intitulé du poste en titre du CV`,
      detail: `« ${cv.basics.headline || 'aucun titre'} » deviendrait « ${role.trim()} ». C’est le premier mot-clé recherché.`,
      keywords: [],
      apply: (c) => void (c.basics.headline = role.trim()),
    }, [])

  // Contenu masqué dans ce CV
  for (const s of cv.sections) {
    if (!s.visible) {
      const text = s.type === 'summary' ? s.text : s.items.map(itemText).join(' ')
      const found = hits(text, missing)
      if (found.length)
        add({ id: `show-s-${s.id}`, kind: 'show', title: `Afficher la rubrique « ${s.title} »`, detail: 'Elle est masquée dans ce CV.', keywords: found.map((k) => k.term), apply: (c) => void (c.sections.find((x) => x.id === s.id)!.visible = true) }, found)
      continue
    }
    for (const it of s.items.filter((i) => !i.visible)) {
      const found = hits(itemText(it), missing)
      if (found.length)
        add({ id: `show-i-${it.id}`, kind: 'show', title: `Afficher « ${short(it.title || it.subtitle || it.bullets[0] || 'élément', 60)} »`, detail: `Masqué dans « ${s.title} ».`, keywords: found.map((k) => k.term), apply: (c) => void (c.sections.find((x) => x.id === s.id)!.items.find((x) => x.id === it.id)!.visible = true) }, found)
    }
  }

  // Ce que le profil contient et que ce CV n'a pas
  const sectionOf = (c: CvDoc, ps: Section): Section => {
    let s = c.sections.find((x) => x.type === ps.type && (ps.type !== 'custom' || norm(x.title) === norm(ps.title)))
    if (!s) {
      s = newSection(ps.type, c.lang, { title: ps.title })
      c.sections.push(s)
      ;(COMPACT_TYPES.includes(ps.type) ? c.side : c.main).push(s.id)
    }
    s.visible = true
    return s
  }
  for (const ps of profile.sections) {
    if (ps.type === 'summary') continue
    const cvItems = cv.sections.filter((x) => x.type === ps.type).flatMap((x) => x.items)
    if (ps.type === 'skills') {
      const have = new Set(cvItems.flatMap((i) => [i.title, ...i.tags]).map(norm))
      for (const pi of ps.items) {
        const tags = (pi.tags.length ? pi.tags : [pi.title]).filter((t) => !have.has(norm(t)))
        for (const tag of tags) {
          const found = hits(tag, missing)
          if (!found.length) continue
          add({
            id: `skill-${hash(norm(tag))}`,
            kind: 'add-skill',
            title: `Ajouter la compétence « ${tag} »`,
            detail: pi.tags.length ? `Présente dans votre profil, famille « ${pi.title} ».` : 'Présente dans votre profil.',
            keywords: found.map((k) => k.term),
            apply: (c) => {
              const s = sectionOf(c, ps)
              if (!pi.tags.length) return void s.items.push({ ...clone(pi), id: uid(), visible: true })
              const g = s.items.find((i) => norm(i.title) === norm(pi.title))
              if (g) g.tags.push(tag)
              else s.items.push({ ...clone(pi), id: uid(), visible: true, tags: [tag] })
            },
          }, found)
        }
      }
      continue
    }
    if (COMPACT_TYPES.includes(ps.type)) continue
    for (const pi of ps.items) {
      const twin = cvItems.find((i) => same(i, pi))
      if (!twin) {
        const found = hits(itemText(pi), missing)
        if (found.length)
          add({
            id: `item-${hash(norm(pi.title + pi.subtitle + pi.bullets[0]))}`,
            kind: 'add-item',
            title: `Ajouter « ${short(pi.title || pi.bullets[0] || 'élément', 60)} » depuis le profil`,
            detail: [pi.subtitle, ps.title].filter(Boolean).join(' · '),
            keywords: found.map((k) => k.term),
            apply: (c) => void sectionOf(c, ps).items.push({ ...clone(pi), id: uid(), visible: true }),
          }, found)
        continue
      }
      const have = new Set(twin.bullets.map(norm))
      for (const b of pi.bullets) {
        if (have.has(norm(b))) continue
        const found = hits(b, missing)
        if (!found.length) continue
        add({
          id: `bullet-${hash(norm(b))}`,
          kind: 'add-bullet',
          title: `Ajouter une réalisation à « ${short(twin.title || twin.subtitle, 50)} »`,
          detail: `« ${short(b, 160)} »`,
          keywords: found.map((k) => k.term),
          apply: (c) => {
            for (const s of c.sections) {
              const t = s.items.find((x) => x.id === twin.id)
              if (t) t.bullets.push(b)
            }
          },
        }, found)
      }
    }
  }

  // Ordre des puces : la plus proche de l'offre en premier
  for (const s of cv.sections.filter((x) => x.visible && x.type === 'experience'))
    for (const it of s.items.filter((i) => i.visible && i.bullets.length > 1)) {
      const scores = it.bullets.map((b) => hits(b, kws).length)
      const best = scores.indexOf(Math.max(...scores))
      if (best <= 0 || scores[best] <= scores[0]) continue
      const b = it.bullets[best]
      add({
        id: `order-${it.id}-${hash(norm(b))}`,
        kind: 'reorder',
        title: `Remonter une réalisation en tête de « ${short(it.title || it.subtitle, 50)} »`,
        detail: `« ${short(b, 160)} » C’est celle qui reprend le plus de termes de l’offre.`,
        keywords: hits(b, kws).map((k) => k.term),
        apply: (c) => {
          for (const sec of c.sections) {
            const t = sec.items.find((x) => x.id === it.id)
            const i = t?.bullets.indexOf(b) ?? -1
            if (t && i > 0) t.bullets.unshift(...t.bullets.splice(i, 1))
          }
        },
      }, [])
    }

  const ignored = new Set(cv.ignored ?? [])
  return {
    proposals: proposals.filter((p) => !ignored.has(p.id)),
    missing,
    unsourced: missing.filter((k) => !covered.has(k.term)),
    coverage,
  }
}
