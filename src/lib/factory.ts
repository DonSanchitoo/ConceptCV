import type { Application, CvDoc, DB, LetterDoc, Lang, NoteDoc, AnalysisDoc, Profile, Section } from '../types'
import { getTemplate } from '../templates/cvTemplates'
import { getLetterModel, GREETINGS, CLOSINGS } from '../templates/letterModels'
import { clone, cloneSections, emptyBasics, formatDate, fullName, newItem, newSection, nowIso, SIDE_TYPES, uid } from './util'

export const emptyProfile = (): Profile => ({ basics: emptyBasics(), sections: [], signature: '' })

export const emptyDb = (): DB => ({
  app: 'ConceptCV',
  schema: 1,
  rev: 0,
  updatedAt: nowIso(),
  deviceId: uid(),
  profile: emptyProfile(),
  applications: [],
  settings: { theme: 'auto', defaultLang: 'fr', spellcheckConsent: false, onboarded: false },
})

const APP_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

export const newApplication = (p: Partial<Application> = {}): Application => ({
  id: uid(),
  company: '',
  role: '',
  location: '',
  status: 'draft',
  url: '',
  jobText: '',
  contactName: '',
  contactEmail: '',
  salary: '',
  appliedAt: '',
  deadline: '',
  followUpAt: '',
  color: APP_COLORS[Math.floor(Math.random() * APP_COLORS.length)],
  docs: [],
  timeline: [],
  createdAt: nowIso(),
  updatedAt: nowIso(),
  ...p,
})

/** Répartit les rubriques entre colonne principale et latérale. */
export const distribute = (sections: Section[]): { main: string[]; side: string[] } => ({
  main: sections.filter((s) => !SIDE_TYPES.includes(s.type)).map((s) => s.id),
  side: sections.filter((s) => SIDE_TYPES.includes(s.type)).map((s) => s.id),
})

const starterSections = (lang: Lang): Section[] => [
  newSection('summary', lang),
  newSection('experience', lang, { items: [newItem()] }),
  newSection('education', lang, { items: [newItem()] }),
  newSection('skills', lang, { items: [newItem()] }),
  newSection('languages', lang, { items: [newItem()] }),
  newSection('interests', lang),
]

export const newCv = (profile: Profile, templateId: string, lang: Lang, name: string): CvDoc => {
  const tpl = getTemplate(templateId)
  const sections = profile.sections.length ? cloneSections(profile.sections).sections : starterSections(lang)
  return {
    kind: 'cv',
    id: uid(),
    name,
    lang,
    templateId,
    design: clone(tpl.design),
    basics: clone(profile.basics),
    sections,
    ...distribute(sections),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export const newLetter = (
  profile: Profile,
  app: Application,
  templateId: string,
  modelId: string,
  lang: Lang,
  name: string,
): LetterDoc => {
  const tpl = getTemplate(templateId)
  const model = getLetterModel(modelId)
  const fill = (s: string) =>
    s
      .replaceAll('[poste]', app.role || '[poste]')
      .replaceAll('[entreprise]', app.company || '[entreprise]')
      .replaceAll('[role]', app.role || '[role]')
      .replaceAll('[company]', app.company || '[company]')
  return {
    kind: 'letter',
    id: uid(),
    name,
    lang,
    templateId,
    modelId,
    design: { ...clone(tpl.design), showPhoto: false },
    sender: clone(profile.basics),
    recipient: { company: app.company, contact: app.contactName, title: '', address: '', postalCode: '', city: app.location },
    place: profile.basics.city,
    date: formatDate(nowIso(), lang),
    subject: fill(model.subject),
    reference: '',
    greeting: app.contactName ? GREETINGS[lang][1].replace('[nom]', app.contactName).replace('[name]', app.contactName) : GREETINGS[lang][0],
    paragraphs: model.paragraphs.map((p) => ({ id: uid(), role: p.role, text: fill(p.text) })),
    closing: CLOSINGS[lang][0],
    signature: profile.signature || fullName(profile.basics),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export const newNote = (name: string): NoteDoc => ({
  kind: 'note', id: uid(), name, content: '', createdAt: nowIso(), updatedAt: nowIso(),
})

export const newAnalysis = (name: string, app: Application): AnalysisDoc => ({
  kind: 'analysis',
  id: uid(),
  name,
  cvId: app.docs.find((d) => d.kind === 'cv')?.id ?? '',
  jobText: app.jobText,
  createdAt: nowIso(),
  updatedAt: nowIso(),
})
