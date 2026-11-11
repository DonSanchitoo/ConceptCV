export type Lang = 'fr' | 'en'

export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'interests'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'volunteering'
  | 'publications'
  | 'references'
  | 'strengths'
  | 'custom'

export interface Basics {
  firstName: string
  lastName: string
  headline: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  country: string
  website: string
  linkedin: string
  github: string
  extra: string // ex. « Permis B, véhicule personnel »
  photo: string // data URL, vide si aucune
}

export interface Item {
  id: string
  visible: boolean
  title: string
  subtitle: string
  location: string
  start: string
  end: string
  description: string
  bullets: string[]
  tags: string[]
  level: number // 0 = non renseigné, 1 à 5
}

export interface Section {
  id: string
  type: SectionType
  title: string
  visible: boolean
  text: string // utilisé par « summary »
  items: Item[]
}

export type LayoutKind = 'single' | 'sidebar-left' | 'sidebar-right' | 'split'
export type HeaderStyle = 'left' | 'center' | 'banner' | 'split' | 'sidebar' | 'boxed'
export type HeadingStyle =
  | 'underline'
  | 'caps-line'
  | 'bar-left'
  | 'filled'
  | 'plain'
  | 'center-lines'
  | 'dot'
  | 'overline'
export type SkillDisplay = 'inline' | 'tags' | 'bars' | 'dots' | 'list'
export type DatePosition = 'right' | 'left' | 'below'

export interface Design {
  layout: LayoutKind
  header: HeaderStyle
  headingStyle: HeadingStyle
  fontHeading: string
  fontBody: string
  fontSize: number // pt
  lineHeight: number
  nameSize: number // pt
  uppercaseName: boolean
  accent: string
  text: string
  muted: string
  pageBg: string
  sidebarBg: string
  sidebarText: string
  headerBg: string
  headerText: string
  margin: number // mm
  sectionGap: number // mm
  itemGap: number // mm
  sidebarWidth: number // %
  showPhoto: boolean
  photoShape: 'circle' | 'rounded' | 'square'
  photoSize: number // mm
  showIcons: boolean
  skillDisplay: SkillDisplay
  languageDisplay: SkillDisplay
  datePosition: DatePosition
  bullet: 'disc' | 'dash' | 'square' | 'arrow' | 'none'
  contactInSidebar: boolean
  pageFormat: 'A4' | 'Letter'
}

export interface CvDoc {
  kind: 'cv'
  id: string
  name: string
  lang: Lang
  templateId: string
  design: Design
  basics: Basics
  sections: Section[]
  main: string[] // ids de sections, colonne principale
  side: string[] // ids de sections, colonne latérale
  createdAt: string
  updatedAt: string
}

export type ParagraphRole = 'hook' | 'me' | 'you' | 'us' | 'closing' | 'free'

export interface Paragraph {
  id: string
  role: ParagraphRole
  text: string
}

export interface Recipient {
  company: string
  contact: string
  title: string
  address: string
  postalCode: string
  city: string
}

export interface LetterDoc {
  kind: 'letter'
  id: string
  name: string
  lang: Lang
  templateId: string
  modelId: string
  design: Design
  sender: Basics
  recipient: Recipient
  place: string
  date: string
  subject: string
  reference: string
  greeting: string
  paragraphs: Paragraph[]
  closing: string
  signature: string
  createdAt: string
  updatedAt: string
}

export interface NoteDoc {
  kind: 'note'
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface AnalysisDoc {
  kind: 'analysis'
  id: string
  name: string
  cvId: string
  jobText: string
  createdAt: string
  updatedAt: string
}

export type Doc = CvDoc | LetterDoc | NoteDoc | AnalysisDoc

export type AppStatus = 'draft' | 'ready' | 'sent' | 'interview' | 'offer' | 'rejected' | 'archived'

export interface TimelineEvent {
  id: string
  date: string
  text: string
}

export interface Application {
  id: string
  company: string
  role: string
  location: string
  status: AppStatus
  url: string
  jobText: string
  contactName: string
  contactEmail: string
  salary: string
  appliedAt: string
  deadline: string
  followUpAt: string
  color: string
  docs: Doc[]
  timeline: TimelineEvent[]
  createdAt: string
  updatedAt: string
}

export interface Profile {
  basics: Basics
  sections: Section[]
  signature: string
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  defaultLang: Lang
  spellcheckConsent: boolean
  onboarded: boolean
}

export interface DB {
  app: 'ConceptCV'
  schema: 1
  rev: number
  updatedAt: string
  deviceId: string
  profile: Profile
  applications: Application[]
  settings: Settings
  /** Dossiers supprimés (id → date) : évite qu'un ancien fichier de projet les fasse réapparaître. */
  deleted?: Record<string, string>
}

/** Fichier d'un seul dossier de candidature, pour travailler sur un projet à la fois (téléphone). */
export interface ProjectFile {
  app: 'ConceptCV'
  type: 'project'
  schema: 1
  exportedAt: string
  application: Application
  profile: Profile
}
