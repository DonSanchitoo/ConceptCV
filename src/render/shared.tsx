import { createContext, useContext, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Globe, Info, Link2, Mail, MapPin, Phone } from 'lucide-react'
import type { Basics, Design, Lang } from '../types'
import { fontCss } from '../templates/cvTemplates'
import { cityLine, fullName } from '../lib/util'

export interface RenderCtx {
  edit: boolean // champs modifiables au clic
  inert: boolean // calque de mesure : même rendu, sans interaction
}

export const Ctx = createContext<RenderCtx>({ edit: false, inert: false })

/** Luminance relative approximative : sert à choisir une couleur lisible sur un aplat. */
export const isDark = (hex: string): boolean => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

export const designVars = (d: Design): CSSProperties => {
  const darkSide = isDark(d.sidebarBg)
  return {
    '--accent': d.accent,
    '--text': d.text,
    '--muted': d.muted,
    '--page-bg': d.pageBg,
    '--side-bg': d.sidebarBg,
    '--side-text': d.sidebarText,
    '--side-accent': darkSide ? d.sidebarText : d.accent,
    '--side-muted': darkSide ? 'color-mix(in srgb, ' + d.sidebarText + ' 72%, transparent)' : d.muted,
    '--hdr-bg': d.headerBg,
    '--hdr-text': d.headerText,
    '--m': d.margin + 'mm',
    '--sg': d.sectionGap + 'mm',
    '--ig': d.itemGap + 'mm',
    '--fs': d.fontSize + 'pt',
    '--lh': String(d.lineHeight),
    '--fh': fontCss(d.fontHeading),
    '--fb': fontCss(d.fontBody),
    '--name': d.nameSize + 'pt',
    '--sw': d.sidebarWidth + '%',
    '--photo': d.photoSize + 'mm',
    '--page-w': d.pageFormat === 'Letter' ? '215.9mm' : '210mm',
    '--page-h': d.pageFormat === 'Letter' ? '279.4mm' : '297mm',
  } as CSSProperties
}

export const pageHeightMm = (d: Design): number => (d.pageFormat === 'Letter' ? 279.4 : 297)

interface EProps {
  value: string
  onCommit?: (v: string) => void
  placeholder?: string
  multiline?: boolean
  optional?: boolean // champ secondaire : rien n'est affiché s'il est vide
  className?: string
  tag?: 'span' | 'div' | 'p' | 'h1' | 'li'
}

/** Texte du document, modifiable sur place quand le rendu est en mode édition. */
export const E = ({ value, onCommit, placeholder, multiline, optional, className, tag = 'span' }: EProps) => {
  const { edit, inert } = useContext(Ctx)
  const Tag = tag
  if (!edit || !onCommit) return value ? <Tag className={className}>{value}</Tag> : null
  if (!value && optional) return null
  if (inert)
    return (
      <Tag className={`e ${className ?? ''}`} data-ph={placeholder}>
        {value}
      </Tag>
    )
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      e.currentTarget.textContent = value
      e.currentTarget.blur()
    }
  }
  return (
    <Tag
      className={`e ${className ?? ''}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-ph={placeholder}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\s+$/, '')
        if (v !== value) onCommit(v)
      }}
    >
      {value}
    </Tag>
  )
}

export const contactEntries = (b: Basics): { key: string; icon: ReactNode; text: string }[] => {
  const place = [b.address, cityLine(b), b.country].filter(Boolean).join(', ')
  const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  return [
    { key: 'phone', icon: <Phone />, text: b.phone },
    { key: 'email', icon: <Mail />, text: b.email },
    { key: 'place', icon: <MapPin />, text: place },
    { key: 'linkedin', icon: <Link2 />, text: strip(b.linkedin) },
    { key: 'github', icon: <Link2 />, text: strip(b.github) },
    { key: 'website', icon: <Globe />, text: strip(b.website) },
    { key: 'extra', icon: <Info />, text: b.extra },
  ].filter((c) => c.text)
}

/** Autorise la coupure d'une adresse après @, / ou un point, plutôt qu'au milieu d'un mot. */
const breakable = (t: string): ReactNode =>
  t.split(/(?<=[@/.])/).map((part, i) => (
    <span key={i}>
      {i > 0 && <wbr />}
      {part}
    </span>
  ))

export const ContactList = ({ basics, icons, stacked }: { basics: Basics; icons: boolean; stacked?: boolean }) => (
  <div className={`contacts ${stacked ? 'stacked' : ''}`}>
    {contactEntries(basics).map((c) => (
      <span className="contact" key={c.key}>
        {icons && <span className="ico">{c.icon}</span>}
        <span>{c.key === 'email' || c.key === 'linkedin' || c.key === 'github' || c.key === 'website' ? breakable(c.text) : c.text}</span>
      </span>
    ))}
  </div>
)

export const Photo = ({ basics, design }: { basics: Basics; design: Design }) =>
  design.showPhoto && basics.photo ? (
    <img className={`photo photo-${design.photoShape}`} src={basics.photo} alt="" />
  ) : null

interface IdentityProps {
  basics: Basics
  design: Design
  lang: Lang
  withContacts: boolean
  stackedContacts?: boolean
  onBasics?: (p: Partial<Basics>) => void
}

/** Nom, titre, photo et coordonnées : commun au CV et à la lettre. */
export const Identity = ({ basics, design, withContacts, stackedContacts, onBasics }: IdentityProps) => {
  const name = fullName(basics)
  const set = (k: keyof Basics) => (onBasics ? (v: string) => onBasics({ [k]: v }) : undefined)
  return (
    <div className="identity">
      <Photo basics={basics} design={design} />
      <div className="identity-text">
        <h1 className={`name ${design.uppercaseName ? 'upper' : ''}`}>
          {onBasics ? (
            <>
              <E value={basics.firstName} onCommit={set('firstName')} placeholder="Prénom" />{' '}
              <E value={basics.lastName} onCommit={set('lastName')} placeholder="Nom" />
            </>
          ) : (
            name
          )}
        </h1>
        <E tag="div" className="headline" value={basics.headline} onCommit={set('headline')} placeholder="Titre du CV : le poste visé" />
        {withContacts && <ContactList basics={basics} icons={design.showIcons} stacked={stackedContacts} />}
      </div>
    </div>
  )
}

export const T: Record<Lang, { contact: string; subject: string; ref: string; present: string }> = {
  fr: { contact: 'Contact', subject: 'Objet', ref: 'Réf.', present: "aujourd'hui" },
  en: { contact: 'Contact', subject: 'Subject', ref: 'Ref.', present: 'present' },
}
