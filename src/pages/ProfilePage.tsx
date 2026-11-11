import { useRef, useState } from 'react'
import { ChevronDown, FileUp, Plus, Trash2 } from 'lucide-react'
import type { Section, SectionType } from '../types'
import { mutate, toast, useStore } from '../store'
import { SECTION_LABELS, newSection } from '../lib/util'
import { BASICS_GUIDE } from '../templates/guides'
import { confirmDialog } from '../ui/dialog'
import { Field, cx } from '../ui/kit'
import { BasicsForm, GuideBox, SectionForm } from '../editor/forms'

const TYPES: SectionType[] = ['summary', 'experience', 'education', 'skills', 'languages', 'interests', 'projects', 'certifications', 'strengths', 'volunteering', 'awards', 'publications', 'references', 'custom']

/** Lit un CV PDF et remplit le profil. Renvoie vrai si le profil a été modifié. */
export const importCvIntoProfile = async (file: File): Promise<boolean> => {
  const { importPdf } = await import('../import/pdfImport')
  try {
    const parsed = await importPdf(file)
    const profile = useStore.getState().db.profile
    if (profile.sections.length && !(await confirmDialog({ title: 'Remplacer le profil ?', message: 'Le contenu actuel du profil sera remplacé par celui du PDF. Vos candidatures ne changent pas.', ok: 'Remplacer' }))) return false
    mutate((db) => {
      db.profile.basics = { ...parsed.basics, photo: db.profile.basics.photo }
      db.profile.sections = parsed.sections
      if (!db.profile.signature) db.profile.signature = [parsed.basics.firstName, parsed.basics.lastName].filter(Boolean).join(' ')
    })
    toast(`Profil pré-rempli : ${parsed.sections.length} rubriques reconnues. Relisez-les avant de créer un CV.`, 'ok')
    return true
  } catch (e) {
    toast((e as Error).message || 'Lecture du PDF impossible.', 'warn')
    return false
  }
}

export const ProfilePage = () => {
  const profile = useStore((s) => s.db.profile)
  const lang = useStore((s) => s.db.settings.defaultLang)
  const [open, setOpen] = useState<string>('basics')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const mutSection = (id: string) => (fn: (s: Section) => void) => mutate((db) => { const s = db.profile.sections.find((x) => x.id === id); if (s) fn(s) })
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Mon profil</h1>
          <p className="muted">Votre base commune. Chaque nouveau CV en part, puis s’adapte à l’offre sans modifier le profil.</p>
        </div>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>
          <FileUp /> {busy ? 'Lecture…' : 'Importer un CV (PDF)'}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/pdf"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true)
            await importCvIntoProfile(f)
            setBusy(false)
          }}
        />
      </header>

      <div className={cx('step', open === 'basics' && 'open')}>
        <button className="step-head" onClick={() => setOpen(open === 'basics' ? '' : 'basics')}>
          <b>Coordonnées</b>
          <ChevronDown className="chev" />
        </button>
        {open === 'basics' && (
          <div className="step-body">
            <GuideBox guide={BASICS_GUIDE} />
            <BasicsForm basics={profile.basics} onChange={(p) => mutate((db) => void Object.assign(db.profile.basics, p))} />
            <Field label="Signature des lettres" value={profile.signature} onChange={(v) => mutate((db) => void (db.profile.signature = v))} placeholder="Prénom Nom" />
          </div>
        )}
      </div>

      {profile.sections.map((s) => (
        <div key={s.id} className={cx('step', open === s.id && 'open')}>
          <button className="step-head" onClick={() => setOpen(open === s.id ? '' : s.id)}>
            <b>{s.title || SECTION_LABELS[s.type]}</b>
            <span className="muted small">{s.type === 'summary' ? '' : `${s.items.length} élément(s)`}</span>
            <ChevronDown className="chev" />
          </button>
          {open === s.id && (
            <div className="step-body">
              <SectionForm section={s} lang={lang} mut={mutSection(s.id)} />
              <button
                className="btn small ghost danger-text"
                onClick={async () => {
                  if (await confirmDialog({ title: `Supprimer « ${s.title} » du profil ?`, ok: 'Supprimer', danger: true })) mutate((db) => void (db.profile.sections = db.profile.sections.filter((x) => x.id !== s.id)))
                }}
              >
                <Trash2 /> Supprimer cette rubrique
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="add-section">
        <button className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus /> Ajouter une rubrique
        </button>
        {adding && (
          <div className="add-grid">
            {TYPES.map((t) => (
              <button
                key={t}
                className="pill"
                onClick={() => {
                  const s = newSection(t, lang)
                  mutate((db) => void db.profile.sections.push(s))
                  setAdding(false)
                  setOpen(s.id)
                }}
              >
                {SECTION_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
