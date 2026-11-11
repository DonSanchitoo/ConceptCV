import type { Design } from '../types'

export interface FontDef {
  id: string
  css: string
  docx: string // police de repli sûre pour Word
  kind: 'sans' | 'serif'
  ats: boolean // police standard, reconnue partout
}

export const FONTS: FontDef[] = [
  { id: 'Inter', css: "'Inter Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Source Sans', css: "'Source Sans 3 Variable', Arial, sans-serif", docx: 'Calibri', kind: 'sans', ats: false },
  { id: 'Lato', css: "'Lato', Arial, sans-serif", docx: 'Calibri', kind: 'sans', ats: false },
  { id: 'Montserrat', css: "'Montserrat Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Poppins', css: "'Poppins', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Raleway', css: "'Raleway Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Nunito Sans', css: "'Nunito Sans Variable', Arial, sans-serif", docx: 'Calibri', kind: 'sans', ats: false },
  { id: 'Work Sans', css: "'Work Sans Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'DM Sans', css: "'DM Sans Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Manrope', css: "'Manrope Variable', Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Oswald', css: "'Oswald Variable', 'Arial Narrow', sans-serif", docx: 'Arial', kind: 'sans', ats: false },
  { id: 'Playfair Display', css: "'Playfair Display Variable', Georgia, serif", docx: 'Georgia', kind: 'serif', ats: false },
  { id: 'Lora', css: "'Lora Variable', Georgia, serif", docx: 'Georgia', kind: 'serif', ats: false },
  { id: 'EB Garamond', css: "'EB Garamond Variable', Garamond, Georgia, serif", docx: 'Garamond', kind: 'serif', ats: false },
  { id: 'Source Serif', css: "'Source Serif 4 Variable', Georgia, serif", docx: 'Georgia', kind: 'serif', ats: false },
  { id: 'Roboto Slab', css: "'Roboto Slab Variable', Georgia, serif", docx: 'Georgia', kind: 'serif', ats: false },
  { id: 'Arial', css: 'Arial, Helvetica, sans-serif', docx: 'Arial', kind: 'sans', ats: true },
  { id: 'Helvetica', css: "'Helvetica Neue', Helvetica, Arial, sans-serif", docx: 'Arial', kind: 'sans', ats: true },
  { id: 'Calibri', css: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif", docx: 'Calibri', kind: 'sans', ats: true },
  { id: 'Georgia', css: 'Georgia, serif', docx: 'Georgia', kind: 'serif', ats: true },
  { id: 'Times New Roman', css: "'Times New Roman', Times, serif", docx: 'Times New Roman', kind: 'serif', ats: true },
]

export const fontCss = (id: string): string => FONTS.find((f) => f.id === id)?.css ?? FONTS[0].css
export const fontDocx = (id: string): string => FONTS.find((f) => f.id === id)?.docx ?? 'Arial'

export const BASE_DESIGN: Design = {
  layout: 'single',
  header: 'left',
  headingStyle: 'underline',
  fontHeading: 'Inter',
  fontBody: 'Inter',
  fontSize: 10,
  lineHeight: 1.42,
  nameSize: 26,
  uppercaseName: false,
  accent: '#1d4ed8',
  text: '#1f2937',
  muted: '#6b7280',
  pageBg: '#ffffff',
  sidebarBg: '#f1f5f9',
  sidebarText: '#1f2937',
  headerBg: '#1d4ed8',
  headerText: '#ffffff',
  margin: 15,
  sectionGap: 5.5,
  itemGap: 3.2,
  sidebarWidth: 33,
  showPhoto: false,
  photoShape: 'circle',
  photoSize: 30,
  showIcons: true,
  skillDisplay: 'inline',
  languageDisplay: 'inline',
  datePosition: 'right',
  bullet: 'disc',
  contactInSidebar: false,
  pageFormat: 'A4',
}

export type TemplateCategory = 'ATS' | 'Classique' | 'Moderne' | 'Créatif' | 'Minimal'

export interface CvTemplate {
  id: string
  name: string
  category: TemplateCategory
  tagline: string
  design: Design
}

const t = (id: string, name: string, category: TemplateCategory, tagline: string, d: Partial<Design>): CvTemplate => ({
  id,
  name,
  category,
  tagline,
  design: { ...BASE_DESIGN, ...d },
})

const side = (d: Partial<Design>): Partial<Design> => ({
  layout: 'sidebar-left',
  header: 'sidebar',
  contactInSidebar: true,
  showPhoto: true,
  margin: 12,
  ...d,
})

export const CV_TEMPLATES: CvTemplate[] = [
  // ───────── Une colonne : lecture ATS la plus fiable ─────────
  t('atlas', 'Atlas', 'ATS', 'Une colonne nette, passe partout', {}),
  t('harvard', 'Harvard', 'ATS', 'Le classique académique, sobre et dense', {
    header: 'center', headingStyle: 'caps-line', fontHeading: 'EB Garamond', fontBody: 'EB Garamond', fontSize: 11,
    nameSize: 24, accent: '#111827', text: '#111827', showIcons: false, uppercaseName: true, bullet: 'disc',
  }),
  t('sobre', 'Sobre', 'ATS', 'Zéro décor, polices standard', {
    headingStyle: 'plain', fontHeading: 'Arial', fontBody: 'Arial', accent: '#374151', showIcons: false, nameSize: 22,
  }),
  t('cambridge', 'Cambridge', 'Classique', 'Serif élégant, titres centrés', {
    header: 'center', headingStyle: 'center-lines', fontHeading: 'Source Serif', fontBody: 'Source Serif',
    accent: '#7f1d1d', nameSize: 27,
  }),
  t('helvete', 'Helvète', 'Minimal', 'Grille suisse, accent rouge', {
    header: 'split', headingStyle: 'overline', fontHeading: 'Work Sans', fontBody: 'Work Sans', accent: '#dc2626',
    text: '#111111', nameSize: 30, datePosition: 'left', bullet: 'dash',
  }),
  t('bandeau', 'Bandeau', 'Moderne', 'En-tête pleine largeur coloré', {
    header: 'banner', headingStyle: 'bar-left', fontHeading: 'Montserrat', fontBody: 'Source Sans', fontSize: 10.5,
    accent: '#0f766e', headerBg: '#0f766e', nameSize: 27,
  }),
  t('encadre', 'Encadré', 'Moderne', 'Titres en aplat, en-tête cadré', {
    header: 'boxed', headingStyle: 'filled', fontHeading: 'Source Sans', fontBody: 'Source Sans', fontSize: 10.5,
    accent: '#334155',
  }),
  t('chrono', 'Chrono', 'Moderne', 'Dates en marge, lecture en frise', {
    datePosition: 'left', headingStyle: 'caps-line', fontHeading: 'DM Sans', fontBody: 'DM Sans', accent: '#0e7490',
  }),
  t('notaire', 'Notaire', 'Classique', 'Tradition, juridique et finance', {
    header: 'center', fontHeading: 'Georgia', fontBody: 'Georgia', fontSize: 10, accent: '#1e3a5f', text: '#1a1a1a',
    datePosition: 'below', showIcons: false, nameSize: 24,
  }),
  t('compact', 'Compact', 'ATS', 'Dense : tout tient sur une page', {
    fontHeading: 'Lato', fontBody: 'Lato', fontSize: 9.2, lineHeight: 1.32, margin: 11, sectionGap: 3.8, itemGap: 2.2,
    nameSize: 21, headingStyle: 'caps-line', accent: '#4338ca',
  }),

  // ───────── Colonne latérale à gauche ─────────
  t('meridien', 'Méridien', 'Moderne', 'Colonne marine, photo ronde', side({
    sidebarBg: '#1e293b', sidebarText: '#f1f5f9', accent: '#0ea5e9', headingStyle: 'caps-line', skillDisplay: 'list',
    fontHeading: 'Montserrat', fontBody: 'Source Sans', fontSize: 10.2,
  })),
  t('ardoise', 'Ardoise', 'Moderne', 'Colonne gris clair, très lisible', side({
    header: 'left', contactInSidebar: true, showPhoto: false, sidebarBg: '#f1f5f9', accent: '#334155',
    headingStyle: 'underline', skillDisplay: 'list',
  })),
  t('emeraude', 'Émeraude', 'Moderne', 'Bandeau vert et colonne assortie', side({
    header: 'banner', showPhoto: false, headerBg: '#065f46', sidebarBg: '#ecfdf5', accent: '#047857',
    headingStyle: 'bar-left', fontHeading: 'Poppins', fontBody: 'Nunito Sans', skillDisplay: 'tags',
  })),
  t('nocturne', 'Nocturne', 'Créatif', 'Noir et or, esprit luxe', side({
    sidebarBg: '#111111', sidebarText: '#f5f5f4', accent: '#b45309', headingStyle: 'caps-line',
    fontHeading: 'Playfair Display', fontBody: 'Lato', skillDisplay: 'bars', languageDisplay: 'dots',
  })),
  t('azur', 'Azur', 'Moderne', 'Bleu clair, compétences en étiquettes', side({
    sidebarBg: '#e0f2fe', accent: '#0369a1', headingStyle: 'dot', skillDisplay: 'tags', fontHeading: 'Manrope',
    fontBody: 'Manrope', fontSize: 9.8, photoShape: 'rounded',
  })),
  t('terracotta', 'Terracotta', 'Créatif', 'Tons chauds, serif littéraire', side({
    sidebarBg: '#9a3412', sidebarText: '#fff7ed', accent: '#9a3412', headingStyle: 'underline', fontHeading: 'Lora',
    fontBody: 'Lora', skillDisplay: 'list',
  })),
  t('graphite', 'Graphite', 'Créatif', 'Titres condensés, jauges de niveau', side({
    sidebarBg: '#374151', sidebarText: '#f9fafb', accent: '#f59e0b', headingStyle: 'filled', fontHeading: 'Oswald',
    fontBody: 'Source Sans', fontSize: 10.4, skillDisplay: 'bars', languageDisplay: 'bars', photoShape: 'square',
    uppercaseName: true,
  })),
  t('lavande', 'Lavande', 'Créatif', 'Pastel doux, niveaux en pastilles', side({
    sidebarBg: '#ede9fe', accent: '#6d28d9', headingStyle: 'dot', fontHeading: 'Nunito Sans', fontBody: 'Nunito Sans',
    skillDisplay: 'tags', languageDisplay: 'dots',
  })),

  // ───────── Colonne latérale à droite ─────────
  t('riviera', 'Riviera', 'Moderne', 'Contenu à gauche, repères à droite', side({
    layout: 'sidebar-right', header: 'left', showPhoto: false, sidebarBg: '#f8fafc', accent: '#2563eb',
    headingStyle: 'caps-line', skillDisplay: 'list',
  })),
  t('onyx', 'Onyx', 'Créatif', 'Colonne sombre à droite', side({
    layout: 'sidebar-right', header: 'left', showPhoto: false, sidebarBg: '#18181b', sidebarText: '#fafafa',
    accent: '#e11d48', headingStyle: 'overline', fontHeading: 'DM Sans', fontBody: 'DM Sans', skillDisplay: 'tags',
  })),
  t('corail', 'Corail', 'Créatif', 'Accent corail, formes rondes', side({
    layout: 'sidebar-right', sidebarBg: '#fff1f2', accent: '#e11d48', headingStyle: 'dot', fontHeading: 'Poppins',
    fontBody: 'Poppins', fontSize: 9.4, skillDisplay: 'tags', languageDisplay: 'dots',
  })),
  t('boreal', 'Boréal', 'Moderne', 'Bandeau pétrole, colonne à droite', side({
    layout: 'sidebar-right', header: 'banner', showPhoto: false, headerBg: '#134e4a', sidebarBg: '#f0fdfa',
    accent: '#0f766e', headingStyle: 'underline', fontHeading: 'Raleway', fontBody: 'Source Sans', fontSize: 10.4,
  })),
  t('sable', 'Sable', 'Classique', 'Beige et serif, chaleureux', side({
    layout: 'sidebar-right', header: 'left', showPhoto: false, sidebarBg: '#f5f0e6', accent: '#78350f',
    headingStyle: 'caps-line', fontHeading: 'Source Serif', fontBody: 'Source Serif', skillDisplay: 'list',
  })),

  // ───────── Deux colonnes sans aplat ─────────
  t('duo', 'Duo', 'Minimal', 'Deux colonnes aérées', {
    layout: 'split', headingStyle: 'underline', fontHeading: 'Manrope', fontBody: 'Manrope', fontSize: 9.8,
    accent: '#4f46e5', skillDisplay: 'list',
  }),
  t('editorial', 'Éditorial', 'Créatif', 'Grand titre serif façon magazine', {
    layout: 'split', header: 'center', headingStyle: 'caps-line', fontHeading: 'Playfair Display', fontBody: 'Source Sans',
    fontSize: 10.3, nameSize: 34, accent: '#111827', skillDisplay: 'list',
  }),
  t('studio', 'Studio', 'Créatif', 'Bandeau sombre, compétences en étiquettes', {
    layout: 'split', header: 'banner', headerBg: '#0f172a', headingStyle: 'bar-left', fontHeading: 'Raleway',
    fontBody: 'Raleway', fontSize: 9.8, accent: '#7c3aed', skillDisplay: 'tags', showPhoto: true,
  }),
  t('nordique', 'Nordique', 'Minimal', 'Beaucoup de blanc, rien de trop', {
    layout: 'split', headingStyle: 'plain', fontHeading: 'DM Sans', fontBody: 'DM Sans', accent: '#0f172a',
    muted: '#64748b', margin: 18, sectionGap: 6.5, showIcons: false, skillDisplay: 'list', nameSize: 28,
  }),
  t('indigo', 'Indigo', 'Moderne', 'En-tête cadré, titres en aplat', {
    layout: 'split', header: 'boxed', headingStyle: 'filled', accent: '#4338ca', skillDisplay: 'bars',
    languageDisplay: 'dots',
  }),
  t('presse', 'Presse', 'Classique', 'Titres slab, filets au-dessus', {
    layout: 'split', headingStyle: 'overline', fontHeading: 'Roboto Slab', fontBody: 'Source Sans', fontSize: 10.3,
    accent: '#b91c1c', skillDisplay: 'list',
  }),
  t('signature', 'Signature', 'Classique', 'Serif et touches dorées', {
    layout: 'split', header: 'split', headingStyle: 'dot', fontHeading: 'Lora', fontBody: 'Lora', fontSize: 9.8,
    accent: '#a16207', skillDisplay: 'list', languageDisplay: 'dots',
  }),
]

export const getTemplate = (id: string): CvTemplate => CV_TEMPLATES.find((x) => x.id === id) ?? CV_TEMPLATES[0]

export const ACCENTS = [
  '#1d4ed8', '#2563eb', '#0369a1', '#0e7490', '#0f766e', '#047857', '#4d7c0f', '#a16207', '#b45309', '#c2410c',
  '#b91c1c', '#e11d48', '#be185d', '#7c3aed', '#6d28d9', '#4338ca', '#334155', '#1e293b', '#111827', '#78350f',
]
