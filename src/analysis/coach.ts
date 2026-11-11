import type { LetterDoc, Lang, Paragraph } from '../types'
import { ROLE_GUIDES } from '../templates/letterModels'
import { countWords, letterBody, norm, words } from './keywords'
import type { Level } from './ats'

export interface Advice {
  id: string
  level: Level
  title: string
  detail?: string
  paragraphId?: string
}

/* Formules usées ou qui affaiblissent le propos : [expression, conseil]. */
const WEAK: Record<Lang, [RegExp, string][]> = {
  fr: [
    [/je me permets de/, '« Je me permets de » : supprimez, allez droit au fait.'],
    [/j'ai l'honneur/, '« J’ai l’honneur » : formule datée.'],
    [/actuellement a la recherche/, '« Actuellement à la recherche » : le recruteur le sait. Commencez par ce que vous apportez.'],
    [/c'est avec (un )?(grand|vif) (interet|plaisir)/, '« C’est avec un grand intérêt » : formule vue dans toutes les lettres.'],
    [/retiendra votre attention|retenu votre attention/, '« Retiendra votre attention » : remplacez par une proposition d’entretien.'],
    [/haute bienveillance/, '« Haute bienveillance » : formule administrative datée.'],
    [/n'hesitez pas/, '« N’hésitez pas » : préférez « Je suis disponible pour… ».'],
    [/je pense (que|etre|pouvoir)|je crois (que|etre|pouvoir)/, '« Je pense », « je crois » : affirmez, puis prouvez.'],
    [/j'ai ete amenee? a/, '« J’ai été amené à » : écrivez directement « j’ai ».'],
    [/entreprise leader|societe dynamique|entreprise dynamique|renommee de votre/, 'Compliment vague : citez un projet ou un fait précis.'],
    [/dynamique|motivee?\b|polyvalente?|rigoureu(x|se)/, 'Qualité affirmée sans preuve : remplacez-la par un exemple.'],
    [/ma candidature (spontanee )?pour/, '« Ma candidature pour » en ouverture : commencez par le besoin de l’entreprise.'],
    [/fort de |forte de /, '« Fort de » : tournure usée, dites simplement ce que vous avez fait.'],
  ],
  en: [
    [/i am writing to (apply|express)/, '“I am writing to apply”: skip it and open with what you bring.'],
    [/to whom it may concern/, '“To whom it may concern”: find a name or use “Dear Hiring Manager”.'],
    [/i (think|believe|feel) (that )?i/, '“I think / I believe”: state it, then prove it.'],
    [/team player|hard[- ]working|detail[- ]oriented|results[- ]driven|passionate about/, 'Claimed quality with no proof: replace with an example.'],
    [/please do not hesitate|don't hesitate/, '“Do not hesitate”: prefer “I am available for…”.'],
    [/i would be a (great|perfect) fit/, '“A perfect fit”: show it with a result.'],
  ],
}

const sentences = (t: string): string[] => t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean)

export interface LetterReport {
  score: number
  words: number
  advices: Advice[]
  byParagraph: Record<string, Advice[]>
}

export const analyzeLetter = (l: LetterDoc, pages: number, company: string, role: string): LetterReport => {
  const out: Advice[] = []
  const add = (a: Advice) => out.push(a)
  const lang = l.lang
  const body = letterBody(l)
  const n = norm(body)
  const wc = countWords(body)

  if (pages > 1) add({ id: 'pages', level: 'error', title: 'La lettre dépasse une page', detail: 'Raccourcissez ou réduisez la taille du texte dans l’onglet Design.' })
  if (wc < 120) add({ id: 'wc', level: 'warn', title: `Lettre courte (${wc} mots)`, detail: 'Visez 200 à 350 mots, sauf pour un message d’accompagnement.' })
  else if (wc > 400) add({ id: 'wc', level: 'warn', title: `Lettre longue (${wc} mots)`, detail: 'Au-delà de 400 mots, elle n’est plus lue en entier. Visez 250 à 350.' })
  else add({ id: 'wc', level: 'ok', title: `${wc} mots : bonne longueur` })

  const holes = [...new Set([l.subject, l.greeting, body, l.closing].join('\n').match(/\[[^\]\n]{1,60}\]/g) ?? [])]
  if (holes.length) add({ id: 'holes', level: 'error', title: `${holes.length} passage(s) entre crochets à compléter`, detail: holes.slice(0, 4).join('  ') })

  if (!l.subject.trim()) add({ id: 'subject', level: 'warn', title: 'Objet manquant' })
  if (!l.recipient.company.trim()) add({ id: 'recipient', level: 'warn', title: 'Destinataire non renseigné' })
  if (company && !n.includes(norm(company))) add({ id: 'company', level: 'warn', title: `« ${company} » n’est jamais cité`, detail: 'Une lettre qui ne nomme pas l’entreprise paraît envoyée en série.' })
  if (role && !norm(`${l.subject} ${body}`).includes(norm(role))) add({ id: 'role', level: 'info', title: 'L’intitulé du poste n’apparaît pas', detail: `Reprenez « ${role} » dans l’objet ou l’accroche.` })
  if (l.paragraphs.length < 3) add({ id: 'paras', level: 'warn', title: 'Moins de trois paragraphes', detail: 'Accroche, ce que vous apportez, pourquoi cette entreprise, conclusion.' })
  if (l.paragraphs.length > 5) add({ id: 'paras', level: 'info', title: `${l.paragraphs.length} paragraphes`, detail: 'Quatre suffisent en général.' })
  if (!/\d/.test(body)) add({ id: 'numbers', level: 'warn', title: 'Aucun chiffre', detail: 'Un résultat chiffré vaut mieux que trois adjectifs.' })
  if ((body.match(/!/g) ?? []).length > 1) add({ id: 'excl', level: 'info', title: 'Plusieurs points d’exclamation', detail: 'Un seul, au maximum.' })

  const sents = sentences(body)
  const firstPerson = lang === 'fr' ? /^(je |j')/i : /^i /i
  const je = sents.filter((s) => firstPerson.test(s)).length
  if (sents.length >= 5 && je / sents.length > 0.5) add({ id: 'je', level: 'warn', title: `${je} phrases sur ${sents.length} commencent par « ${lang === 'fr' ? 'Je' : 'I'} »`, detail: 'Variez : partez de l’entreprise, d’un résultat, d’un projet.' })
  const you = lang === 'fr' ? (n.match(/\b(vous|votre|vos)\b/g) ?? []).length : (n.match(/\b(you|your)\b/g) ?? []).length
  if (wc > 120 && you < 3) add({ id: 'you', level: 'warn', title: 'La lettre parle peu de l’entreprise', detail: 'Elle doit répondre à « pourquoi nous ? » autant qu’à « pourquoi vous ? ».' })

  if (lang === 'fr') {
    const g = norm(l.greeting)
    const c = norm(l.closing)
    if (g.includes('madame, monsieur') && c.includes('agreer') && !c.includes('madame, monsieur')) add({ id: 'formula', level: 'info', title: 'Reprenez l’appel dans la formule de politesse', detail: '« Madame, Monsieur, » doit se retrouver dans « Je vous prie d’agréer, Madame, Monsieur, … ».' })
    if (/^bonjour/.test(g) && c.includes('agreer')) add({ id: 'formula', level: 'info', title: 'Ton inégal', detail: '« Bonjour » s’accorde mieux avec « Cordialement » qu’avec une formule longue.' })
  }

  // Répétitions
  const freq = new Map<string, number>()
  for (const w of words(n)) if (w.length > 6) freq.set(w, (freq.get(w) ?? 0) + 1)
  const rep = [...freq].filter(([, c]) => c >= 4).map(([w]) => w)
  if (rep.length) add({ id: 'rep', level: 'info', title: 'Mots répétés', detail: rep.slice(0, 5).join(', ') })

  // Par paragraphe
  const byParagraph: Record<string, Advice[]> = {}
  for (const p of l.paragraphs) {
    const list = paragraphAdvice(p, lang)
    byParagraph[p.id] = list
    out.push(...list.filter((a) => a.level !== 'ok'))
  }

  const errors = out.filter((a) => a.level === 'error').length
  const warns = out.filter((a) => a.level === 'warn').length
  const infos = out.filter((a) => a.level === 'info').length
  return { score: Math.max(0, 100 - errors * 18 - warns * 7 - infos * 2), words: wc, advices: out, byParagraph }
}

export const paragraphAdvice = (p: Paragraph, lang: Lang): Advice[] => {
  const list: Advice[] = []
  const guide = ROLE_GUIDES[lang][p.role]
  const wc = countWords(p.text)
  const n = norm(p.text)
  const [min, max] = guide.words
  if (!wc) return [{ id: `${p.id}-empty`, level: 'warn', title: `${guide.label} : paragraphe vide`, paragraphId: p.id }]
  if (wc > max * 1.25) list.push({ id: `${p.id}-long`, level: 'warn', title: `${guide.label} : ${wc} mots, visez ${min} à ${max}`, paragraphId: p.id })
  else if (wc < min * 0.6) list.push({ id: `${p.id}-short`, level: 'info', title: `${guide.label} : ${wc} mots, c’est court (${min} à ${max} conseillés)`, paragraphId: p.id })
  for (const [re, tip] of WEAK[lang]) if (re.test(n)) list.push({ id: `${p.id}-${re.source.slice(0, 12)}`, level: 'warn', title: tip, paragraphId: p.id })
  const long = sentences(p.text).filter((s) => countWords(s) > 34)
  if (long.length) list.push({ id: `${p.id}-sent`, level: 'info', title: `${guide.label} : phrase de plus de 34 mots`, detail: `« ${long[0].slice(0, 80)}… » Coupez-la en deux.`, paragraphId: p.id })
  if (p.role === 'me' && !/\d/.test(p.text)) list.push({ id: `${p.id}-num`, level: 'warn', title: `${guide.label} : aucun chiffre`, detail: 'Ajoutez un résultat mesurable : volume, délai, pourcentage.', paragraphId: p.id })
  if (!list.length) list.push({ id: `${p.id}-ok`, level: 'ok', title: `${guide.label} : rien à signaler`, paragraphId: p.id })
  return list
}
