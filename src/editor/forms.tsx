import { useRef, useState } from 'react'
import { ChevronDown, Copy, Eye, EyeOff, ImagePlus, Lightbulb, Plus, Trash2, X } from 'lucide-react'
import type { Basics, Item, Lang, Section } from '../types'
import { COMPACT_TYPES, clone, fileToPhoto, newItem, uid } from '../lib/util'
import { ACTION_VERBS, ITEM_LABELS, SECTION_GUIDES, type Guide } from '../templates/guides'
import { Area, Field, cx } from '../ui/kit'
import { Handle, SortableList, SortableRow } from '../ui/Sortable'
import { countWords, norm } from '../analysis/keywords'
import { toast } from '../store'

export const GuideBox = ({ guide, verbs }: { guide: Guide; verbs?: string[] }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className={cx('guide', open && 'open')}>
      <button type="button" className="guide-head" onClick={() => setOpen((o) => !o)}>
        <Lightbulb />
        <span>{guide.intro}</span>
        <ChevronDown className="chev" />
      </button>
      {open && (
        <div className="guide-body">
          <ul>
            {guide.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {guide.example && <p className="guide-example">Exemple : {guide.example}</p>}
          {verbs && (
            <div className="verbs">
              {verbs.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const BasicsForm = ({ basics, onChange, withPhoto = true }: { basics: Basics; onChange: (p: Partial<Basics>) => void; withPhoto?: boolean }) => {
  const file = useRef<HTMLInputElement>(null)
  const f = (k: keyof Basics, label: string, o: { placeholder?: string; half?: boolean; type?: string } = {}) => (
    <Field label={label} value={basics[k]} onChange={(v) => onChange({ [k]: v })} half={o.half ?? true} placeholder={o.placeholder} type={o.type} />
  )
  return (
    <div className="form-grid">
      {withPhoto && (
        <div className="photo-row">
          {basics.photo ? <img src={basics.photo} alt="" /> : <div className="photo-empty"><ImagePlus /></div>}
          <div>
            <button type="button" className="btn small" onClick={() => file.current?.click()}>
              {basics.photo ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {basics.photo && (
              <button type="button" className="btn small ghost" onClick={() => onChange({ photo: '' })}>
                Retirer
              </button>
            )}
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const x = e.target.files?.[0]
                e.target.value = ''
                if (!x) return
                try {
                  onChange({ photo: await fileToPhoto(x) })
                } catch {
                  toast('Image illisible.', 'warn')
                }
              }}
            />
          </div>
        </div>
      )}
      {f('firstName', 'Prénom')}
      {f('lastName', 'Nom')}
      {f('headline', 'Titre du CV', { half: false, placeholder: 'Le poste visé, ex. Chef de projet SIG' })}
      {f('email', 'E-mail', { type: 'email' })}
      {f('phone', 'Téléphone', { type: 'tel' })}
      {f('address', 'Adresse', { half: false, placeholder: 'Facultatif sur un CV, utile pour une lettre' })}
      {f('postalCode', 'Code postal')}
      {f('city', 'Ville')}
      {f('linkedin', 'LinkedIn', { placeholder: 'linkedin.com/in/…' })}
      {f('website', 'Site ou portfolio')}
      {f('github', 'GitHub')}
      {f('extra', 'Mention libre', { placeholder: 'Permis B, mobilité…' })}
    </div>
  )
}

const WEAK = /^(responsable de|en charge de|charge de|chargee? de|participation a|participe a|aide a|responsible for|in charge of|helped|worked on)/

const BulletHint = ({ text }: { text: string }) => {
  if (!text.trim()) return null
  const weak = WEAK.test(norm(text))
  const num = /\d/.test(text)
  const long = countWords(text) > 32
  if (weak) return <span className="hint warn">Décrit une tâche : commencez par ce que vous avez obtenu.</span>
  if (long) return <span className="hint warn">Plus de 32 mots : coupez en deux.</span>
  if (!num) return <span className="hint">Un chiffre rendrait ce résultat plus concret.</span>
  return <span className="hint ok">Action et chiffre : c’est bon.</span>
}

const parseTags = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)

/** Saisie libre « a, b, c » : le texte tapé reste tel quel, la liste propre est enregistrée. */
const TagsField = ({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) => {
  const [text, setText] = useState(tags.join(', '))
  if (parseTags(text).join('|') !== tags.join('|')) setText(tags.join(', '))
  return (
    <Field
      half
      label="Détail (séparé par des virgules)"
      value={text}
      placeholder="QGIS, ArcGIS Pro…"
      onChange={(v) => {
        setText(v)
        onChange(parseTags(v))
      }}
    />
  )
}

const ItemForm = ({ section, item, mut }: { section: Section; item: Item; mut: (fn: (i: Item) => void) => void }) => {
  const labels = ITEM_LABELS[section.type] ?? ITEM_LABELS.custom!
  const set = (k: 'title' | 'subtitle' | 'location' | 'start' | 'end' | 'description') => (v: string) => mut((i) => void (i[k] = v))
  if (COMPACT_TYPES.includes(section.type)) {
    const isSkill = section.type === 'skills'
    const isLang = section.type === 'languages'
    return (
      <div className="form-grid">
        <Field half label={isSkill ? 'Famille ou compétence' : isLang ? 'Langue' : 'Intitulé'} value={item.title} onChange={set('title')} />
        {isSkill ? (
          <TagsField tags={item.tags} onChange={(tags) => mut((i) => void (i.tags = tags))} />
        ) : (
          <Field half label={isLang ? 'Niveau' : 'Précision'} value={item.subtitle} onChange={set('subtitle')} placeholder={isLang ? 'B2, courant, natif…' : ''} />
        )}
        {(isSkill || isLang) && (
          <div className="field">
            <span className="field-label">Niveau pour les jauges (facultatif)</span>
            <div className="level-pick">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={cx(item.level === n && 'on')} onClick={() => mut((i) => void (i.level = n))}>
                  {n === 0 ? '–' : n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="form-grid">
      <Field half label={labels.title} value={item.title} onChange={set('title')} />
      <Field half label={labels.subtitle} value={item.subtitle} onChange={set('subtitle')} />
      <Field half label="Début" value={item.start} onChange={set('start')} placeholder="sept. 2025" />
      <Field half label="Fin" value={item.end} onChange={set('end')} placeholder="aujourd'hui" />
      <Field label="Lieu" value={item.location} onChange={set('location')} />
      <Area label="Texte d'introduction (facultatif)" value={item.description} onChange={set('description')} rows={1} />
      <div className="field">
        <span className="field-label">Réalisations</span>
        <SortableList ids={item.bullets.map((_, i) => `${item.id}-b${i}`)} onReorder={(ids) => mut((i) => void (i.bullets = ids.map((id) => i.bullets[Number(id.split('-b').pop())])))}>
          {item.bullets.map((b, idx) => (
            <SortableRow key={`${item.id}-b${idx}`} id={`${item.id}-b${idx}`} className="bullet-row">
              <Handle id={`${item.id}-b${idx}`} />
              <div className="bullet-body">
                <Area value={b} onChange={(v) => mut((i) => void (i.bullets[idx] = v))} rows={1} placeholder="Action + résultat chiffré" />
                {section.type === 'experience' && <BulletHint text={b} />}
              </div>
              <button type="button" className="icon-btn" onClick={() => mut((i) => void i.bullets.splice(idx, 1))} aria-label="Supprimer">
                <X />
              </button>
            </SortableRow>
          ))}
        </SortableList>
        <button type="button" className="btn small ghost add" onClick={() => mut((i) => void i.bullets.push(''))}>
          <Plus /> Ajouter une réalisation
        </button>
      </div>
    </div>
  )
}

interface SectionFormProps {
  section: Section
  lang: Lang
  mut: (fn: (s: Section) => void) => void
}

export const SectionForm = ({ section, lang, mut }: SectionFormProps) => {
  const [open, setOpen] = useState<string | null>(section.items[0]?.id ?? null)
  const guide = SECTION_GUIDES[section.type]
  const compact = COMPACT_TYPES.includes(section.type)
  const mutItem = (id: string) => (fn: (i: Item) => void) => mut((s) => { const it = s.items.find((x) => x.id === id); if (it) fn(it) })
  const add = () => {
    const it = newItem()
    mut((s) => void s.items.push(it))
    setOpen(it.id)
  }
  return (
    <div className="section-form">
      <GuideBox guide={guide} verbs={section.type === 'experience' ? ACTION_VERBS[lang] : undefined} />
      <Field label="Titre de la rubrique" value={section.title} onChange={(v) => mut((s) => void (s.title = v))} />
      {section.type === 'summary' ? (
        <Area
          label="Texte"
          rows={4}
          value={section.text}
          onChange={(v) => mut((s) => void (s.text = v))}
          hint={`${countWords(section.text)} mots · visez 30 à 60`}
        />
      ) : (
        <>
          <SortableList ids={section.items.map((i) => i.id)} onReorder={(ids) => mut((s) => void (s.items = ids.map((id) => s.items.find((i) => i.id === id)!)))}>
            {section.items.map((it) => {
              const isOpen = compact || open === it.id
              const label = it.title || it.subtitle || 'Nouvel élément'
              return (
                <SortableRow key={it.id} id={it.id} className={cx('item-card', isOpen && 'open', !it.visible && 'off')}>
                  <div className="item-head">
                    <Handle id={it.id} />
                    {!compact && (
                      <button type="button" className="item-title" onClick={() => setOpen(isOpen ? null : it.id)}>
                        <b>{label}</b>
                        <span>{[it.subtitle && it.title ? it.subtitle : '', it.start, it.end].filter(Boolean).join(' · ')}</span>
                      </button>
                    )}
                    {compact && <div className="item-compact"><ItemForm section={section} item={it} mut={mutItem(it.id)} /></div>}
                    <div className="item-actions">
                      <button type="button" className="icon-btn" title={it.visible ? 'Masquer dans ce CV' : 'Afficher'} onClick={() => mutItem(it.id)((i) => void (i.visible = !i.visible))}>
                        {it.visible ? <Eye /> : <EyeOff />}
                      </button>
                      {!compact && (
                        <button type="button" className="icon-btn" title="Dupliquer" onClick={() => mut((s) => void s.items.splice(s.items.indexOf(s.items.find((x) => x.id === it.id)!) + 1, 0, { ...clone(it), id: uid() }))}>
                          <Copy />
                        </button>
                      )}
                      <button type="button" className="icon-btn" title="Supprimer" onClick={() => mut((s) => void (s.items = s.items.filter((x) => x.id !== it.id)))}>
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                  {!compact && isOpen && <div className="item-body"><ItemForm section={section} item={it} mut={mutItem(it.id)} /></div>}
                </SortableRow>
              )
            })}
          </SortableList>
          <button type="button" className="btn small add" onClick={add}>
            <Plus /> Ajouter
          </button>
        </>
      )}
    </div>
  )
}
