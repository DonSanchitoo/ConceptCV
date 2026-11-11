import type { Application, Basics, Interview, Lang } from '../types'
import { fullName, shortDate, uid } from './util'
import { extractKeywords } from '../analysis/keywords'
import type { CvDoc } from '../types'

export interface Mail {
  subject: string
  body: string
}

const hello = (app: Application, lang: Lang) =>
  lang === 'fr' ? (app.contactName ? `Bonjour ${app.contactName},` : 'Bonjour,') : app.contactName ? `Dear ${app.contactName},` : 'Hello,'

const sign = (b: Basics) => [fullName(b), b.phone, b.linkedin].filter(Boolean).join('\n')

/** Mail d'accompagnement : court, il annonce les pièces jointes et ne répète pas la lettre. */
export const applicationMail = (app: Application, b: Basics, lang: Lang, withLetter: boolean): Mail => {
  const role = app.role || (lang === 'fr' ? '[poste]' : '[role]')
  if (lang === 'en')
    return {
      subject: `Application: ${role}, ${fullName(b)}`,
      body: `${hello(app, lang)}\n\nPlease find attached my application for the ${role} position: my CV${withLetter ? ' and cover letter' : ''}.\n\nI am available for an interview at your convenience${b.phone ? `, on ${b.phone}` : ''}.\n\nKind regards,\n${sign(b)}`,
    }
  return {
    subject: `Candidature : ${role}, ${fullName(b)}`,
    body: `${hello(app, lang)}\n\nJe vous adresse ma candidature au poste de ${role}. Vous trouverez en pièces jointes mon CV${withLetter ? ' et ma lettre de motivation' : ''}.\n\nJe suis disponible pour un entretien quand vous le souhaitez${b.phone ? `, au ${b.phone}` : ''}.\n\nBien cordialement,\n${sign(b)}`,
  }
}

export const followUpMail = (app: Application, b: Basics, lang: Lang): Mail => {
  const role = app.role || (lang === 'fr' ? '[poste]' : '[role]')
  const date = app.appliedAt ? shortDate(app.appliedAt) : lang === 'fr' ? '[date]' : '[date]'
  if (lang === 'en')
    return {
      subject: `Following up: ${role}, ${fullName(b)}`,
      body: `${hello(app, lang)}\n\nI applied for the ${role} position on ${date} and I am still very interested.\n\nCould you tell me where the process stands? I am available for a call whenever suits you.\n\nKind regards,\n${sign(b)}`,
    }
  return {
    subject: `Suite à ma candidature : ${role}, ${fullName(b)}`,
    body: `${hello(app, lang)}\n\nJe vous ai adressé ma candidature au poste de ${role} le ${date}. Ce poste m’intéresse toujours.\n\nPourriez-vous m’indiquer où en est le recrutement ? Je reste disponible pour un échange quand cela vous convient.\n\nBien cordialement,\n${sign(b)}`,
  }
}

export const mailto = (to: string, m: Mail): string => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`

/** Rappel de relance au format iCalendar : s'ouvre dans Calendrier sur Mac et iPhone. */
export const followUpIcs = (app: Application): string => {
  const day = app.followUpAt.replace(/-/g, '')
  const next = new Date(new Date(app.followUpAt).getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ConceptCV//FR', 'BEGIN:VEVENT',
    `UID:${app.id}-${day}@conceptcv`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(`Relancer ${app.company}${app.role ? ` (${app.role})` : ''}`)}`,
    `DESCRIPTION:${esc(`Candidature envoyée le ${app.appliedAt ? shortDate(app.appliedAt) : '?'}.${app.contactName ? ` Contact : ${app.contactName}` : ''}${app.contactEmail ? ` ${app.contactEmail}` : ''}`)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Relance', 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export const addDays = (iso: string, n: number): string => new Date(new Date(iso).getTime() + n * 86400000).toISOString().slice(0, 10)

/** Canevas de préparation : questions probables tirées de l'offre, exemples tirés du CV. Tout reste modifiable. */
export const interviewDraft = (app: Application, cv?: CvDoc): Interview => {
  const q = (text: string) => ({ id: uid(), q: text, a: '' })
  const kws = app.jobText.length > 80 ? extractKeywords(app.jobText, 10).slice(0, 6) : []
  const exp = cv?.sections.filter((s) => s.visible && s.type === 'experience').flatMap((s) => s.items.filter((i) => i.visible)) ?? []
  return {
    date: '',
    place: '',
    people: app.contactName,
    questions: [
      q('Présentez-vous en deux minutes.'),
      q(`Pourquoi ${app.company || 'cette entreprise'} ?`),
      q(`Pourquoi le poste de ${app.role || '[poste]'} ?`),
      ...kws.map((k) => q(`Parlez-moi de votre expérience en ${k.term}.`)),
      q('Quelle a été votre plus grande difficulté, et comment l’avez-vous gérée ?'),
      q('Quel est votre point faible ?'),
      q('Quelles sont vos prétentions salariales ?'),
      q('Quand êtes-vous disponible ?'),
    ],
    stories: exp.slice(0, 3).flatMap((i) => i.bullets.slice(0, 1).map((b) => ({ id: uid(), title: `${i.subtitle || i.title} : ${b.length > 70 ? b.slice(0, 69) + '…' : b}`, situation: '', action: '', result: b }))),
    ask: 'À quoi ressemble une semaine type sur ce poste ?\nQuels sont les objectifs des six premiers mois ?\nComment l’équipe est-elle organisée ?\nQuelle est la suite du processus de recrutement ?',
    notes: '',
  }
}
