import type { Basics, Item, Lang, Section, SectionType } from '../types'

export const uid = (): string =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12)

export const nowIso = (): string => new Date().toISOString()

export const emptyBasics = (): Basics => ({
  firstName: '',
  lastName: '',
  headline: '',
  email: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  website: '',
  linkedin: '',
  github: '',
  extra: '',
  photo: '',
})

export const newItem = (p: Partial<Item> = {}): Item => ({
  id: uid(),
  visible: true,
  title: '',
  subtitle: '',
  location: '',
  start: '',
  end: '',
  description: '',
  bullets: [],
  tags: [],
  level: 0,
  ...p,
})

export const SECTION_TITLES: Record<SectionType, Record<Lang, string>> = {
  summary: { fr: 'Profil', en: 'Profile' },
  experience: { fr: 'Expérience professionnelle', en: 'Work Experience' },
  education: { fr: 'Formation', en: 'Education' },
  skills: { fr: 'Compétences', en: 'Skills' },
  languages: { fr: 'Langues', en: 'Languages' },
  interests: { fr: "Centres d'intérêt", en: 'Interests' },
  projects: { fr: 'Projets', en: 'Projects' },
  certifications: { fr: 'Certifications', en: 'Certifications' },
  awards: { fr: 'Distinctions', en: 'Awards' },
  volunteering: { fr: 'Bénévolat', en: 'Volunteering' },
  publications: { fr: 'Publications', en: 'Publications' },
  references: { fr: 'Références', en: 'References' },
  strengths: { fr: 'Atouts', en: 'Strengths' },
  custom: { fr: 'Nouvelle rubrique', en: 'New section' },
}

export const SECTION_LABELS: Record<SectionType, string> = {
  summary: 'Profil / accroche',
  experience: 'Expérience',
  education: 'Formation',
  skills: 'Compétences',
  languages: 'Langues',
  interests: "Centres d'intérêt",
  projects: 'Projets',
  certifications: 'Certifications',
  awards: 'Distinctions',
  volunteering: 'Bénévolat',
  publications: 'Publications',
  references: 'Références',
  strengths: 'Atouts',
  custom: 'Rubrique libre',
}

/** Rubriques courtes, naturellement placées dans la colonne latérale. */
export const SIDE_TYPES: SectionType[] = ['skills', 'languages', 'interests', 'strengths', 'certifications', 'references']

/** Rubriques dont les éléments sont de simples lignes (titre + détail éventuel). */
export const COMPACT_TYPES: SectionType[] = ['skills', 'languages', 'interests', 'strengths']

export const newSection = (type: SectionType, lang: Lang, p: Partial<Section> = {}): Section => ({
  id: uid(),
  type,
  title: SECTION_TITLES[type][lang],
  visible: true,
  text: '',
  items: [],
  ...p,
})

export const fullName = (b: Basics): string => [b.firstName, b.lastName].filter(Boolean).join(' ')

export const cityLine = (b: { postalCode: string; city: string }): string =>
  [b.postalCode, b.city].filter(Boolean).join(' ')

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Copie profonde avec de nouveaux identifiants, pour dupliquer sections et éléments. */
export const cloneSections = (sections: Section[]): { sections: Section[]; map: Record<string, string> } => {
  const map: Record<string, string> = {}
  const out = sections.map((s) => {
    const id = uid()
    map[s.id] = id
    return { ...clone(s), id, items: s.items.map((i) => ({ ...clone(i), id: uid() })) }
  })
  return { sections: out, map }
}

export const slug = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export const formatDate = (iso: string, lang: Lang = 'fr'): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export const shortDate = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const dateRange = (i: Pick<Item, 'start' | 'end'>): string =>
  i.start && i.end ? `${i.start} – ${i.end}` : i.start || i.end

export const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t: ReturnType<typeof setTimeout> | undefined
  const d = (...a: A) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  d.flush = (...a: A) => {
    clearTimeout(t)
    fn(...a)
  }
  return d
}

export const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Redimensionne une image importée pour ne pas alourdir le fichier de données. */
export const fileToPhoto = (file: File, max = 480): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const size = Math.min(max, side)
      const c = document.createElement('canvas')
      c.width = c.height = size
      c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible'))
    }
    img.src = url
  })

/** Charge une signature (PNG de préférence, pour garder le fond transparent) et la réduit si besoin. */
export const fileToSignature = (file: File, max = 800): Promise<{ src: string; ratio: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({ src: c.toDataURL('image/png'), ratio: c.height / c.width })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible'))
    }
    img.src = url
  })
