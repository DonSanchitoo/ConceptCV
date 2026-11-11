import type { Application, CvDoc, LetterDoc } from '../types'
import { formatDate, fullName, nowIso } from '../lib/util'
import { cvPlainText, letterBody, letterPlainText, norm } from './keywords'
import type { Level } from './ats'

export interface PreCheck {
  id: string
  level: Level
  title: string
  detail?: string
  fix?: { label: string; target: 'letter' | 'cv'; apply: (cv: CvDoc | undefined, letter: LetterDoc) => void }
}

const numbers = (t: string): string[] =>
  [...new Set((t.match(/\d[\d\s.,]*\d|\d/g) ?? []).map((n) => n.replace(/[\s.,]/g, '')).filter((n) => n.length >= 2 || /[3-9]/.test(n)))]

/** Vérifie, avant l'envoi, que le CV et la lettre vont ensemble et visent bien cette entreprise. */
export const preflight = (app: Application, others: Application[], cv?: CvDoc, letter?: LetterDoc): PreCheck[] => {
  const out: PreCheck[] = []
  if (!cv) out.push({ id: 'no-cv', level: 'error', title: 'Aucun CV sélectionné' })
  if (!letter) out.push({ id: 'no-letter', level: 'info', title: 'Pas de lettre jointe', detail: 'Certaines offres n’en demandent pas. Vérifiez l’annonce.' })
  const cvText = cv ? cvPlainText(cv) : ''
  const letterText = letter ? letterPlainText(letter) : ''
  const company = norm(app.company)

  // Nom d'une autre entreprise resté dans les documents
  for (const o of others) {
    const name = norm(o.company).trim()
    if (name.length < 4 || company.includes(name) || name.includes(company)) continue
    const where = [letter && norm(letterText).includes(name) ? 'la lettre' : '', cv && norm(cvText.split('\n').slice(0, 4).join(' ') + ' ' + (cv.sections.find((s) => s.type === 'summary')?.text ?? '')).includes(name) ? 'l’accroche du CV' : ''].filter(Boolean)
    if (where.length) out.push({ id: `other-${o.id}`, level: 'error', title: `« ${o.company} » apparaît dans ${where.join(' et ')}`, detail: 'C’est le nom d’un autre de vos dossiers : probablement un reste de copie.' })
  }

  for (const [label, text] of [['le CV', cvText], ['la lettre', letterText]] as const) {
    const holes = text.match(/\[[^\]\n]{1,60}\]/g)
    if (holes) out.push({ id: `holes-${label}`, level: 'error', title: `${holes.length} passage(s) entre crochets dans ${label}`, detail: [...new Set(holes)].slice(0, 4).join('  ') })
  }

  if (letter) {
    if (app.company && !norm(letterBody(letter) + ' ' + letter.subject).includes(company) )
      out.push({ id: 'company', level: 'warn', title: `La lettre ne cite pas « ${app.company} »` })
    if (app.company && norm(letter.recipient.company) !== company)
      out.push({
        id: 'recipient', level: 'warn', title: 'Le destinataire ne correspond pas au dossier',
        detail: `Destinataire : « ${letter.recipient.company || 'vide'} ».`,
        fix: { label: `Mettre « ${app.company} »`, target: 'letter', apply: (_c, l) => void (l.recipient.company = app.company) },
      })
    const today = formatDate(nowIso(), letter.lang)
    if (letter.date.trim() !== today)
      out.push({
        id: 'date', level: 'warn', title: `La lettre est datée du ${letter.date || '(vide)'}`,
        detail: 'Une lettre datée d’un autre jour paraît recyclée.',
        fix: { label: `Dater du ${today}`, target: 'letter', apply: (_c, l) => void (l.date = today) },
      })
    if (!letter.signature.trim()) out.push({ id: 'signature', level: 'warn', title: 'La lettre n’est pas signée' })
  }

  if (cv && letter) {
    const diffs: string[] = []
    if (norm(fullName(cv.basics)) !== norm(fullName(letter.sender))) diffs.push('nom')
    if (norm(cv.basics.email) !== norm(letter.sender.email)) diffs.push('e-mail')
    if (cv.basics.phone.replace(/\D/g, '') !== letter.sender.phone.replace(/\D/g, '')) diffs.push('téléphone')
    if (norm(cv.basics.headline) !== norm(letter.sender.headline)) diffs.push('titre')
    if (diffs.length)
      out.push({
        id: 'identity', level: 'warn', title: `CV et lettre diffèrent : ${diffs.join(', ')}`,
        fix: { label: 'Aligner la lettre sur le CV', target: 'letter', apply: (c, l) => void (c && (l.sender = { ...c.basics, photo: '' })) },
      })
    if (cv.lang !== letter.lang) out.push({ id: 'lang', level: 'warn', title: 'Le CV et la lettre ne sont pas dans la même langue' })
    if (cv.templateId !== letter.templateId) out.push({ id: 'design', level: 'info', title: 'Le CV et la lettre n’utilisent pas le même modèle', detail: 'Un design assorti donne un dossier plus soigné.' })
    const inCv = new Set(numbers(cvText))
    const orphan = numbers(letterBody(letter)).filter((n) => !inCv.has(n))
    if (orphan.length)
      out.push({ id: 'numbers', level: 'info', title: 'Chiffres de la lettre absents du CV', detail: `${orphan.slice(0, 6).join(', ')}. Un recruteur qui compare les deux doit retrouver les mêmes résultats.` })
  }

  if (cv && app.role && !norm(cv.basics.headline).includes(norm(app.role).split(/\s+/)[0]))
    out.push({ id: 'headline', level: 'info', title: 'Le titre du CV ne reprend pas le poste visé', detail: `Poste : « ${app.role} ». Titre : « ${cv.basics.headline || 'vide'} ».` })

  if (!out.some((c) => c.level === 'error' || c.level === 'warn')) out.unshift({ id: 'ok', level: 'ok', title: 'Rien ne bloque l’envoi' })
  return out
}
