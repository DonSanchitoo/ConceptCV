import { useState } from 'react'
import { DndContext, closestCenter, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, ChevronDown, Eye, EyeOff, LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import type { Basics, CvDoc, Design, Section, SectionType } from '../types'
import { ACCENTS, CV_TEMPLATES, FONTS } from '../templates/cvTemplates'
import { BASICS_GUIDE } from '../templates/guides'
import { SECTION_LABELS, SIDE_TYPES, newSection } from '../lib/util'
import { ColorField, Range, Segmented, Select, Toggle, cx } from '../ui/kit'
import { Handle, SortableRow, useDndSensors } from '../ui/Sortable'
import { confirmDialog } from '../ui/dialog'
import { BasicsForm, GuideBox, SectionForm } from './forms'
import type { Patch } from '../render/CvDocument'

/* ───────── Contenu : parcours guidé, une étape par rubrique ───────── */

const sectionDone = (s: Section) => (s.type === 'summary' ? s.text.trim().length > 20 : s.items.some((i) => i.visible && i.title.trim()))
const basicsDone = (b: Basics) => !!(b.firstName && b.lastName && b.email && b.phone && b.city && b.headline)

const ADDABLE: SectionType[] = ['summary', 'experience', 'education', 'skills', 'languages', 'interests', 'projects', 'certifications', 'strengths', 'volunteering', 'awards', 'publications', 'references', 'custom']

export const ContentPanel = ({ cv, patch, step, setStep }: { cv: CvDoc; patch: Patch; step: string; setStep: (s: string) => void }) => {
  const [adding, setAdding] = useState(false)
  const ordered = [...cv.main, ...cv.side].map((id) => cv.sections.find((s) => s.id === id)).filter((s): s is Section => !!s)
  const steps = ['basics', ...ordered.map((s) => s.id)]
  const next = (id: string) => {
    const i = steps.indexOf(id)
    return steps[i + 1]
  }
  const addSection = (type: SectionType) => {
    const s = newSection(type, cv.lang)
    patch((c) => {
      c.sections.push(s)
      if (SIDE_TYPES.includes(type)) c.side.push(s.id)
      else c.main.push(s.id)
    })
    setAdding(false)
    setStep(s.id)
  }
  const Step = ({ id, n, title, done, hidden, children }: { id: string; n: number; title: string; done: boolean; hidden?: boolean; children: React.ReactNode }) => {
    const open = step === id
    return (
      <div key={id} className={cx('step', open && 'open', hidden && 'off')} id={`step-${id}`}>
        <button type="button" className="step-head" onClick={() => setStep(open ? '' : id)}>
          <span className={cx('step-n', done && 'done')}>{done ? <Check /> : n}</span>
          <b>{title}</b>
          {hidden && <span className="badge">masquée</span>}
          <ChevronDown className="chev" />
        </button>
        {open && (
          <div className="step-body">
            {children}
            {next(id) && (
              <button type="button" className="btn primary small next" onClick={() => setStep(next(id))}>
                Étape suivante
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="steps">
      {Step({
        id: 'basics', n: 1, title: 'Coordonnées et titre', done: basicsDone(cv.basics),
        children: (
          <>
            <GuideBox guide={BASICS_GUIDE} />
            <BasicsForm basics={cv.basics} onChange={(p) => patch((c) => void Object.assign(c.basics, p))} />
          </>
        ),
      })}
      {ordered.map((s, i) =>
        Step({
          id: s.id, n: i + 2, title: s.title || SECTION_LABELS[s.type], done: sectionDone(s), hidden: !s.visible,
          children: <SectionForm section={s} lang={cv.lang} mut={(fn) => patch((c) => { const x = c.sections.find((y) => y.id === s.id); if (x) fn(x) })} />,
        }),
      )}
      <div className="add-section">
        <button type="button" className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus /> Ajouter une rubrique
        </button>
        {adding && (
          <div className="add-grid">
            {ADDABLE.map((t) => (
              <button key={t} type="button" className="pill" onClick={() => addSection(t)}>
                {SECTION_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────── Design ───────── */

const fontOptions = FONTS.map((f) => ({ value: f.id, label: `${f.id}${f.ats ? ' · standard' : ''}` }))

export const DesignControls = ({ design, set, letter }: { design: Design; set: (p: Partial<Design>) => void; letter?: boolean }) => (
  <>
    <div className="panel-block">
      <h4>Couleurs</h4>
      <div className="swatches">
        {ACCENTS.map((c) => (
          <button key={c} type="button" className={cx('swatch', design.accent.toLowerCase() === c && 'on')} style={{ background: c }} onClick={() => set({ accent: c, ...(design.header === 'banner' ? { headerBg: c } : {}) })} aria-label={c} />
        ))}
      </div>
      <div className="form-grid">
        <ColorField label="Accent" value={design.accent} onChange={(v) => set({ accent: v })} />
        <ColorField label="Texte" value={design.text} onChange={(v) => set({ text: v })} />
        {design.layout !== 'single' && design.layout !== 'split' && (
          <>
            <ColorField label="Fond de colonne" value={design.sidebarBg} onChange={(v) => set({ sidebarBg: v })} />
            <ColorField label="Texte de colonne" value={design.sidebarText} onChange={(v) => set({ sidebarText: v })} />
          </>
        )}
        {design.header === 'banner' && (
          <>
            <ColorField label="Fond du bandeau" value={design.headerBg} onChange={(v) => set({ headerBg: v })} />
            <ColorField label="Texte du bandeau" value={design.headerText} onChange={(v) => set({ headerText: v })} />
          </>
        )}
      </div>
    </div>
    <div className="panel-block">
      <h4>Typographie</h4>
      <div className="form-grid">
        <Select half label="Titres" value={design.fontHeading} onChange={(v) => set({ fontHeading: v })} options={fontOptions} />
        <Select half label="Texte" value={design.fontBody} onChange={(v) => set({ fontBody: v })} options={fontOptions} />
        <Range label="Taille du texte" value={design.fontSize} onChange={(v) => set({ fontSize: v })} min={8} max={12.5} step={0.1} unit=" pt" />
        <Range label="Interligne" value={design.lineHeight} onChange={(v) => set({ lineHeight: v })} min={1.15} max={1.8} step={0.01} />
        <Range label="Taille du nom" value={design.nameSize} onChange={(v) => set({ nameSize: v })} min={16} max={40} unit=" pt" />
        <div className="field half"><Toggle label="Nom en capitales" checked={design.uppercaseName} onChange={(v) => set({ uppercaseName: v })} /></div>
      </div>
    </div>
    <div className="panel-block">
      <h4>Mise en page</h4>
      <Segmented
        label="Colonnes"
        value={design.layout}
        onChange={(v) => set({ layout: v, ...(v === 'single' ? { contactInSidebar: false, header: design.header === 'sidebar' ? 'left' : design.header } : {}) })}
        options={[
          { value: 'single', label: 'Une' },
          { value: 'sidebar-left', label: 'Latérale gauche' },
          { value: 'sidebar-right', label: 'Latérale droite' },
          ...(letter ? [] : [{ value: 'split' as const, label: 'Deux' }]),
        ]}
      />
      <Select
        label="En-tête"
        value={design.header}
        onChange={(v) => set({ header: v })}
        options={[
          { value: 'left', label: 'Aligné à gauche' },
          { value: 'center', label: 'Centré' },
          { value: 'split', label: 'Nom à gauche, contact à droite' },
          { value: 'banner', label: 'Bandeau coloré' },
          { value: 'boxed', label: 'Encadré' },
          ...(design.layout !== 'single' ? [{ value: 'sidebar' as const, label: 'Dans la colonne latérale' }] : []),
        ]}
      />
      {!letter && (
        <Select
          label="Titres de rubrique"
          value={design.headingStyle}
          onChange={(v) => set({ headingStyle: v })}
          options={[
            { value: 'underline', label: 'Soulignés' },
            { value: 'caps-line', label: 'Capitales et filet' },
            { value: 'bar-left', label: 'Barre à gauche' },
            { value: 'filled', label: 'Aplat de couleur' },
            { value: 'plain', label: 'Sobres' },
            { value: 'center-lines', label: 'Centrés entre deux filets' },
            { value: 'dot', label: 'Pastille' },
            { value: 'overline', label: 'Filet au-dessus' },
          ]}
        />
      )}
      <div className="form-grid">
        <Range label="Marges" value={design.margin} onChange={(v) => set({ margin: v })} min={8} max={25} unit=" mm" />
        {design.layout !== 'single' && <Range label="Largeur de colonne" value={design.sidebarWidth} onChange={(v) => set({ sidebarWidth: v })} min={24} max={42} unit=" %" />}
        {!letter && <Range label="Espace entre rubriques" value={design.sectionGap} onChange={(v) => set({ sectionGap: v })} min={2} max={10} step={0.1} unit=" mm" />}
        {!letter && <Range label="Espace entre éléments" value={design.itemGap} onChange={(v) => set({ itemGap: v })} min={1} max={7} step={0.1} unit=" mm" />}
      </div>
      {design.layout !== 'single' && <Toggle label="Coordonnées dans la colonne latérale" checked={design.contactInSidebar} onChange={(v) => set({ contactInSidebar: v })} />}
      <Segmented label="Format" value={design.pageFormat} onChange={(v) => set({ pageFormat: v })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'US Letter' }]} />
    </div>
    <div className="panel-block">
      <h4>Détails</h4>
      <Toggle label="Icônes devant les coordonnées" checked={design.showIcons} onChange={(v) => set({ showIcons: v })} />
      {!letter && (
        <>
          <Toggle label="Afficher la photo" checked={design.showPhoto} onChange={(v) => set({ showPhoto: v })} />
          {design.showPhoto && (
            <div className="form-grid">
              <Select half label="Forme" value={design.photoShape} onChange={(v) => set({ photoShape: v })} options={[{ value: 'circle', label: 'Ronde' }, { value: 'rounded', label: 'Arrondie' }, { value: 'square', label: 'Carrée' }]} />
              <Range label="Taille" value={design.photoSize} onChange={(v) => set({ photoSize: v })} min={20} max={45} unit=" mm" />
            </div>
          )}
          <div className="form-grid">
            <Select half label="Compétences" value={design.skillDisplay} onChange={(v) => set({ skillDisplay: v })} options={[{ value: 'list', label: 'Liste par famille' }, { value: 'inline', label: 'En ligne' }, { value: 'tags', label: 'Étiquettes' }, { value: 'bars', label: 'Jauges' }, { value: 'dots', label: 'Pastilles' }]} />
            <Select half label="Langues" value={design.languageDisplay} onChange={(v) => set({ languageDisplay: v })} options={[{ value: 'inline', label: 'En ligne' }, { value: 'list', label: 'Liste' }, { value: 'tags', label: 'Étiquettes' }, { value: 'bars', label: 'Jauges' }, { value: 'dots', label: 'Pastilles' }]} />
            <Select half label="Dates" value={design.datePosition} onChange={(v) => set({ datePosition: v })} options={[{ value: 'right', label: 'À droite' }, { value: 'left', label: 'En marge gauche' }, { value: 'below', label: 'Sous l’intitulé' }]} />
            <Select half label="Puces" value={design.bullet} onChange={(v) => set({ bullet: v })} options={[{ value: 'disc', label: '• Ronde' }, { value: 'dash', label: '– Tiret' }, { value: 'square', label: '▪ Carrée' }, { value: 'arrow', label: '› Chevron' }, { value: 'none', label: 'Aucune' }]} />
          </div>
        </>
      )}
    </div>
  </>
)

export const DesignPanel = ({ cv, patch, onGallery }: { cv: CvDoc; patch: Patch; onGallery: () => void }) => {
  const tpl = CV_TEMPLATES.find((t) => t.id === cv.templateId)
  return (
    <div className="design">
      <div className="panel-block tpl-current">
        <div>
          <span className="field-label">Modèle</span>
          <b>{tpl?.name ?? 'Personnalisé'}</b>
          <span className="muted small">{tpl?.tagline}</span>
        </div>
        <button className="btn" onClick={onGallery}>
          <LayoutTemplate /> Changer
        </button>
      </div>
      <DesignControls design={cv.design} set={(p) => patch((c) => void Object.assign(c.design, p))} />
      <button
        className="btn ghost small"
        onClick={async () => {
          if (tpl && (await confirmDialog({ title: 'Réinitialiser le design ?', message: `Les réglages reviennent à ceux du modèle ${tpl.name}. Le contenu ne change pas.`, ok: 'Réinitialiser' })))
            patch((c) => void (c.design = { ...tpl.design }))
        }}
      >
        Revenir aux réglages du modèle
      </button>
    </div>
  )
}

/* ───────── Structure : glisser-déposer entre colonnes ───────── */

const DropZone = ({ id, children, title, hint }: { id: string; children: React.ReactNode; title: string; hint: string }) => {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cx('zone', isOver && 'over')}>
      <h4>{title}</h4>
      <p className="muted small">{hint}</p>
      {children}
    </div>
  )
}

export const StructurePanel = ({ cv, patch, onOpen }: { cv: CvDoc; patch: Patch; onOpen: (id: string) => void }) => {
  const sensors = useDndSensors()
  const single = cv.design.layout === 'single'
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const id = String(e.active.id)
    const over = String(e.over.id)
    patch((c) => {
      const from = c.main.includes(id) ? c.main : c.side
      const to = over === 'main' ? c.main : over === 'side' ? c.side : c.main.includes(over) ? c.main : c.side
      const fromIdx = from.indexOf(id)
      if (fromIdx < 0) return
      let toIdx = over === 'main' || over === 'side' ? to.length : to.indexOf(over)
      from.splice(fromIdx, 1)
      if (from === to && toIdx > to.length) toIdx = to.length
      to.splice(Math.max(0, toIdx), 0, id)
    })
  }
  const row = (id: string) => {
    const s = cv.sections.find((x) => x.id === id)
    if (!s) return null
    return (
      <SortableRow key={id} id={id} className={cx('struct-row', !s.visible && 'off')}>
        <Handle id={id} />
        <button type="button" className="struct-name" onClick={() => onOpen(id)}>
          <b>{s.title || SECTION_LABELS[s.type]}</b>
          <span>{s.type === 'summary' ? 'Texte' : `${s.items.filter((i) => i.visible).length} élément(s)`}</span>
        </button>
        <button type="button" className="icon-btn" title={s.visible ? 'Masquer' : 'Afficher'} onClick={() => patch((c) => void (c.sections.find((x) => x.id === id)!.visible = !s.visible))}>
          {s.visible ? <Eye /> : <EyeOff />}
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Supprimer"
          onClick={async () => {
            if (!(await confirmDialog({ title: `Supprimer « ${s.title} » ?`, message: 'La rubrique est retirée de ce CV. Votre profil n’est pas touché.', ok: 'Supprimer', danger: true }))) return
            patch((c) => {
              c.sections = c.sections.filter((x) => x.id !== id)
              c.main = c.main.filter((x) => x !== id)
              c.side = c.side.filter((x) => x !== id)
            })
          }}
        >
          <Trash2 />
        </button>
      </SortableRow>
    )
  }
  return (
    <div className="structure">
      <p className="muted">Faites glisser les rubriques pour les réordonner ou les changer de colonne. Vous pouvez aussi les déplacer en survolant l’aperçu.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <DropZone id="main" title={single ? 'Début du CV' : 'Colonne principale'} hint={single ? 'Ces rubriques apparaissent en premier.' : 'Expériences, formation : le cœur du CV.'}>
          <SortableContext items={cv.main} strategy={verticalListSortingStrategy}>
            {cv.main.map(row)}
          </SortableContext>
        </DropZone>
        <DropZone id="side" title={single ? 'Suite du CV' : 'Colonne latérale'} hint={single ? 'Placées à la suite. Deviennent la colonne latérale si vous passez en colonnes.' : 'Compétences, langues : les repères rapides.'}>
          <SortableContext items={cv.side} strategy={verticalListSortingStrategy}>
            {cv.side.map(row)}
          </SortableContext>
        </DropZone>
      </DndContext>
    </div>
  )
}
