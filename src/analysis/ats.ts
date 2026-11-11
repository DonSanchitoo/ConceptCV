import type { CvDoc, Lang, SectionType } from '../types'
import { FONTS } from '../templates/cvTemplates'
import { countWords, cvPlainText, extractKeywords, matchKeywords, norm, type Match } from './keywords'

export type Level = 'error' | 'warn' | 'info' | 'ok'

export interface Check {
  id: string
  level: Level
  group: 'Lecture par les ATS' | 'Coordonnées' | 'Contenu' | 'Rédaction' | "Adéquation à l'offre"
  title: string
  detail?: string
  sectionId?: string
}

export interface AtsReport {
  score: number
  base: number
  coverage: number | null
  checks: Check[]
  matches: Match[]
  words: number
}

/* Intitulés que les ATS savent rattacher à une rubrique. */
const KNOWN: Partial<Record<SectionType, string[]>> = {
  summary: ['profil', 'a propos', 'resume', 'objectif', 'profile', 'summary', 'about', 'objective', 'presentation'],
  experience: ['experience', 'experiences', 'parcours professionnel', 'work experience', 'employment', 'professional experience'],
  education: ['formation', 'formations', 'etudes', 'diplomes', 'education', 'cursus'],
  skills: ['competences', 'skills', 'savoir-faire', 'technical skills', 'competences techniques', 'expertise'],
  languages: ['langues', 'languages'],
  interests: ["centres d'interet", 'loisirs', 'interests', 'hobbies', 'passions'],
  certifications: ['certifications', 'certificats', 'certificates'],
  projects: ['projets', 'projects', 'realisations'],
}

const WEAK_STARTS: Record<Lang, RegExp> = {
  fr: /^(responsable de|en charge de|charge de|chargee? de|participation a|participe a|j'ai participe|aide a|missions? ?:|taches? ?:|divers|differentes?)/,
  en: /^(responsible for|in charge of|helped|worked on|duties included|tasks included|various|participated in)/,
}

const CLICHES: Record<Lang, string[]> = {
  fr: ['dynamique', 'motive', 'motivee', 'polyvalent', 'polyvalente', 'passionne', 'passionnee', 'perfectionniste', 'proactif', 'proactive', 'esprit d\'equipe', 'force de proposition', 'autonome', 'rigoureux', 'rigoureuse'],
  en: ['hard-working', 'team player', 'results-driven', 'detail-oriented', 'passionate', 'dynamic', 'motivated', 'go-getter', 'self-starter', 'think outside the box', 'synergy'],
}

const DATE_SHAPES: [string, RegExp][] = [
  ['année seule', /^\d{4}$/],
  ['mois en lettres + année', /^[\p{L}.]+ \d{4}$/u],
  ['mois/année en chiffres', /^\d{1,2}[/.-]\d{4}$/],
  ['mois en lettres', /^[\p{L}.]+$/u],
]
const dateShape = (s: string): string | null => {
  const v = s.trim()
  if (!v) return null
  if (/^(aujourd'hui|present|présent|en cours|now|current|actuel)/i.test(v)) return null
  return DATE_SHAPES.find(([, r]) => r.test(v))?.[0] ?? 'autre'
}

export const analyzeCv = (cv: CvDoc, jobText: string, pages: number): AtsReport => {
  const checks: Check[] = []
  const add = (c: Check) => checks.push(c)
  const d = cv.design
  const lang = cv.lang
  const text = cvPlainText(cv)
  const nText = norm(text)
  const vis = cv.sections.filter((s) => s.visible)
  const of = (t: SectionType) => vis.filter((s) => s.type === t)

  // ── Lecture par les ATS
  if (d.layout === 'single')
    add({ id: 'layout', level: 'ok', group: 'Lecture par les ATS', title: 'Mise en page sur une colonne', detail: 'C’est le format que les logiciels de tri lisent le plus fidèlement.' })
  else
    add({ id: 'layout', level: 'warn', group: 'Lecture par les ATS', title: 'Mise en page en colonnes', detail: 'Certains ATS lisent les colonnes ligne à ligne et mélangent les rubriques. Pour un dépôt sur un site carrière, envoyez l’export Word (toujours sur une colonne) ou passez ce CV en une colonne dans l’onglet Design.' })
  if (d.skillDisplay === 'bars' || d.skillDisplay === 'dots' || d.languageDisplay === 'bars' || d.languageDisplay === 'dots')
    add({ id: 'levels', level: 'warn', group: 'Lecture par les ATS', title: 'Niveaux affichés en jauges ou pastilles', detail: 'Un ATS ne lit pas un graphique. Indiquez aussi le niveau en toutes lettres (B2, courant, avancé).' })
  const fonts = [d.fontBody, d.fontHeading].map((f) => FONTS.find((x) => x.id === f))
  if (fonts.every((f) => f?.ats))
    add({ id: 'font', level: 'ok', group: 'Lecture par les ATS', title: 'Polices standard' })
  else
    add({ id: 'font', level: 'info', group: 'Lecture par les ATS', title: 'Police non standard, intégrée au PDF', detail: 'Le PDF embarque la police : le texte reste lisible par les ATS. L’export Word bascule sur une police standard équivalente.' })
  if (d.showPhoto && cv.basics.photo)
    add({ id: 'photo', level: lang === 'en' ? 'warn' : 'info', group: 'Lecture par les ATS', title: 'Photo présente', detail: lang === 'en' ? 'Au Royaume-Uni, aux États-Unis et au Canada, la photo est déconseillée.' : 'Courante en France, jamais obligatoire. Elle est ignorée par les ATS et retirée de l’export Word.' })
  for (const s of vis) {
    const known = KNOWN[s.type]
    if (!known || s.type === 'custom') continue
    const t = norm(s.title)
    if (!known.some((k) => t.includes(k)))
      add({ id: `title-${s.id}`, level: 'warn', group: 'Lecture par les ATS', title: `Intitulé « ${s.title} » peu reconnu`, detail: `Un ATS classe les rubriques d’après leur titre. Préférez un intitulé courant, par exemple « ${known[0][0].toUpperCase() + known[0].slice(1)} ».`, sectionId: s.id })
  }
  if (pages > 2) add({ id: 'pages', level: 'error', group: 'Lecture par les ATS', title: `${pages} pages`, detail: 'Deux pages est le maximum admis, une seule en dessous de dix ans d’expérience.' })
  else add({ id: 'pages', level: 'ok', group: 'Lecture par les ATS', title: pages === 1 ? 'Tient sur une page' : 'Tient sur deux pages' })

  // ── Coordonnées
  const b = cv.basics
  if (!b.firstName || !b.lastName) add({ id: 'name', level: 'error', group: 'Coordonnées', title: 'Nom ou prénom manquant' })
  if (!b.email) add({ id: 'email', level: 'error', group: 'Coordonnées', title: 'Adresse e-mail manquante' })
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(b.email)) add({ id: 'email', level: 'error', group: 'Coordonnées', title: 'Adresse e-mail invalide' })
  else if (/(hotmail|wanadoo|aol|yahoo|live)\./i.test(b.email) || /\d{4,}|bg|kiss|love|sexy/i.test(b.email.split('@')[0]))
    add({ id: 'email', level: 'info', group: 'Coordonnées', title: 'Adresse e-mail à vérifier', detail: 'Une adresse du type prenom.nom@… fait plus professionnel.' })
  if (!b.phone) add({ id: 'phone', level: 'warn', group: 'Coordonnées', title: 'Téléphone manquant' })
  if (!b.city) add({ id: 'city', level: 'warn', group: 'Coordonnées', title: 'Ville manquante', detail: 'Beaucoup de recruteurs filtrent par localisation.' })
  if (!b.headline) add({ id: 'headline', level: 'warn', group: 'Coordonnées', title: 'Pas de titre de CV', detail: 'Reprenez l’intitulé exact du poste visé : c’est le premier mot-clé recherché.' })
  if (b.firstName && b.lastName && b.email && b.phone && b.city && b.headline)
    add({ id: 'contact-ok', level: 'ok', group: 'Coordonnées', title: 'Coordonnées complètes' })

  // ── Contenu
  const summary = of('summary')[0]
  const sw = countWords(summary?.text ?? '')
  if (!summary || !sw) add({ id: 'summary', level: 'warn', group: 'Contenu', title: 'Pas d’accroche', detail: 'Deux ou trois phrases en tête de CV orientent la lecture.', sectionId: summary?.id })
  else if (sw > 80) add({ id: 'summary', level: 'warn', group: 'Contenu', title: `Accroche trop longue (${sw} mots)`, detail: 'Visez 30 à 60 mots.', sectionId: summary.id })
  else if (sw < 15) add({ id: 'summary', level: 'info', group: 'Contenu', title: `Accroche très courte (${sw} mots)`, sectionId: summary.id })
  else add({ id: 'summary', level: 'ok', group: 'Contenu', title: 'Accroche de bonne longueur' })

  const exps = of('experience')
  const expItems = exps.flatMap((s) => s.items.filter((i) => i.visible).map((i) => ({ s, i })))
  if (!expItems.length) add({ id: 'exp', level: 'error', group: 'Contenu', title: 'Aucune expérience', sectionId: exps[0]?.id })
  if (!of('education').some((s) => s.items.some((i) => i.visible && i.title)))
    add({ id: 'edu', level: 'error', group: 'Contenu', title: 'Aucune formation' })
  const skillCount = of('skills').flatMap((s) => s.items.filter((i) => i.visible)).reduce((n, i) => n + Math.max(1, i.tags.length), 0)
  if (skillCount < 5) add({ id: 'skills', level: 'warn', group: 'Contenu', title: skillCount ? `Seulement ${skillCount} compétence(s)` : 'Aucune compétence', detail: 'Les ATS comparent cette rubrique aux mots de l’offre : listez 8 à 15 compétences précises.' })
  else add({ id: 'skills', level: 'ok', group: 'Contenu', title: `${skillCount} compétences listées` })
  const langs = of('languages').flatMap((s) => s.items.filter((i) => i.visible))
  if (langs.some((i) => !i.subtitle && !i.level)) add({ id: 'langs', level: 'warn', group: 'Contenu', title: 'Langue sans niveau', detail: 'Précisez un niveau (A2 à C2, ou « courant », « natif »).' })

  const dated = cv.sections.filter((s) => s.visible && ['experience', 'education', 'projects', 'volunteering'].includes(s.type)).flatMap((s) => s.items.filter((i) => i.visible).map((i) => ({ s, i })))
  const missingDates = dated.filter(({ i }) => !i.start && !i.end)
  if (missingDates.length) add({ id: 'dates-missing', level: 'warn', group: 'Contenu', title: `${missingDates.length} élément(s) sans date`, detail: missingDates.slice(0, 3).map(({ i }) => i.title || 'Sans titre').join(', '), sectionId: missingDates[0].s.id })
  const shapes = new Set(dated.flatMap(({ i }) => [dateShape(i.start), dateShape(i.end)]).filter((x): x is string => !!x && x !== 'mois en lettres'))
  if (shapes.has('autre')) add({ id: 'dates-shape', level: 'warn', group: 'Lecture par les ATS', title: 'Format de date inhabituel', detail: 'Utilisez « sept. 2025 », « 09/2025 » ou « 2025 ».' })
  else if (shapes.has('mois/année en chiffres') && shapes.has('mois en lettres + année')) add({ id: 'dates-shape', level: 'warn', group: 'Lecture par les ATS', title: 'Formats de date mélangés', detail: 'Gardez la même écriture partout.' })
  const noOrg = expItems.filter(({ i }) => !i.subtitle || !i.title)
  if (noOrg.length) add({ id: 'exp-fields', level: 'warn', group: 'Contenu', title: 'Expérience incomplète', detail: 'Chaque expérience doit avoir un intitulé de poste et un employeur.', sectionId: noOrg[0].s.id })

  // ── Rédaction
  const bullets = expItems.flatMap(({ s, i }) => i.bullets.map((t) => ({ s, t })))
  const descOnly = expItems.filter(({ i }) => !i.bullets.length && !i.description)
  if (descOnly.length) add({ id: 'exp-empty', level: 'warn', group: 'Rédaction', title: `${descOnly.length} expérience(s) sans description`, sectionId: descOnly[0].s.id })
  if (bullets.length) {
    const weak = bullets.filter(({ t }) => WEAK_STARTS[lang].test(norm(t)))
    if (weak.length) add({ id: 'weak', level: 'warn', group: 'Rédaction', title: `${weak.length} puce(s) qui décrivent une tâche, pas un résultat`, detail: `« ${weak[0].t.slice(0, 70)}… » Commencez par ce que vous avez fait ou obtenu.`, sectionId: weak[0].s.id })
    const withNum = bullets.filter(({ t }) => /\d/.test(t)).length
    const ratio = Math.round((withNum / bullets.length) * 100)
    if (ratio < 30) add({ id: 'numbers', level: 'warn', group: 'Rédaction', title: `Peu de résultats chiffrés (${ratio} % des puces)`, detail: 'Volume, délai, pourcentage, budget, taille d’équipe : un chiffre rend une réalisation crédible.' })
    else add({ id: 'numbers', level: 'ok', group: 'Rédaction', title: `${ratio} % des puces contiennent un chiffre` })
    const long = bullets.filter(({ t }) => countWords(t) > 32)
    if (long.length) add({ id: 'long', level: 'info', group: 'Rédaction', title: `${long.length} puce(s) de plus de 32 mots`, detail: 'Une puce se lit d’un coup d’œil : coupez en deux.', sectionId: long[0].s.id })
    const first = lang === 'fr' ? /^(je |j')/i : /^i /i
    const je = bullets.filter(({ t }) => first.test(t.trim()))
    if (je.length) add({ id: 'je', level: 'info', group: 'Rédaction', title: 'Puces à la première personne', detail: 'L’usage est de démarrer directement par le fait ou le verbe.', sectionId: je[0].s.id })
  }
  const cl = CLICHES[lang].filter((c) => nText.includes(norm(c)))
  if (cl.length >= 3) add({ id: 'cliches', level: 'info', group: 'Rédaction', title: 'Qualités sans preuve', detail: `${cl.slice(0, 5).join(', ')} : ces mots sont sur tous les CV. Gardez ceux qu’une réalisation illustre.` })
  if (/\[[^\]]{2,40}\]/.test(text)) add({ id: 'placeholders', level: 'error', group: 'Rédaction', title: 'Texte à compléter entre crochets [ ]' })
  const wc = countWords(text)
  if (wc < 150) add({ id: 'wc', level: 'warn', group: 'Contenu', title: `CV très court (${wc} mots)` })
  else if (wc > 900) add({ id: 'wc', level: 'warn', group: 'Contenu', title: `CV très dense (${wc} mots)`, detail: 'Au-delà de 800 mots, la lecture rapide devient difficile.' })

  // ── Adéquation à l'offre
  let coverage: number | null = null
  let matches: Match[] = []
  if (jobText.trim().length > 80) {
    const kws = extractKeywords(jobText, 28)
    const m = matchKeywords(kws, text)
    matches = m.matches
    coverage = m.coverage
    const missing = matches.filter((x) => !x.found).slice(0, 6).map((x) => x.keyword.term)
    add({
      id: 'kw',
      level: coverage >= 70 ? 'ok' : coverage >= 45 ? 'warn' : 'error',
      group: "Adéquation à l'offre",
      title: `${coverage} % des termes clés de l’offre sont dans le CV`,
      detail: missing.length ? `Absents : ${missing.join(', ')}. Ajoutez ceux qui sont vrais pour vous, avec les mots de l’annonce.` : undefined,
    })
    if (b.headline && kws.length) {
      const title = norm(b.headline)
      const jobHead = norm(jobText.slice(0, 200))
      const shared = title.split(/\s+/).filter((w) => w.length > 3 && jobHead.includes(w))
      if (!shared.length) add({ id: 'kw-title', level: 'info', group: "Adéquation à l'offre", title: 'Le titre du CV ne reprend pas l’intitulé de l’offre' })
    }
  } else {
    add({ id: 'kw', level: 'info', group: "Adéquation à l'offre", title: 'Collez le texte de l’offre pour mesurer l’adéquation', detail: 'Dans la fiche de la candidature ou ci-dessus.' })
  }

  const errors = checks.filter((c) => c.level === 'error' && c.id !== 'kw').length
  const warns = checks.filter((c) => c.level === 'warn' && c.id !== 'kw').length
  const base = Math.max(0, Math.min(100, 100 - errors * 14 - warns * 5))
  const score = coverage === null ? base : Math.round(base * 0.6 + coverage * 0.4)
  return { score, base, coverage, checks, matches, words: wc }
}
