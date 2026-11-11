import { useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Copy, ExternalLink, FileText, Mail, MoreHorizontal, Plus, StickyNote, Trash2 } from 'lucide-react'
import type { Application, CvDoc, Doc, Lang, LetterDoc } from '../types'
import { mutate, toast, updateApp, useStore } from '../store'
import { newAnalysis, newCv, newLetter, newNote } from '../lib/factory'
import { clone, nowIso, shortDate, uid } from '../lib/util'
import { STATUSES } from '../lib/status'
import { go } from '../lib/router'
import { getTemplate } from '../templates/cvTemplates'
import { getLetterModel } from '../templates/letterModels'
import { extractKeywords } from '../analysis/keywords'
import { CvDocument } from '../render/CvDocument'
import { LetterDocument } from '../render/LetterDocument'
import { Area, Field, Menu, Modal, Segmented, cx } from '../ui/kit'
import { confirmDialog, promptDialog } from '../ui/dialog'
import { TemplateGallery } from '../editor/TemplateGallery'
import { LetterModelPicker } from '../editor/LetterModelPicker'
import { setStatus } from './Dashboard'

const KIND = {
  cv: { label: 'CV', plural: 'CV', icon: <FileText /> },
  letter: { label: 'Lettre', plural: 'Lettres de motivation', icon: <Mail /> },
  analysis: { label: 'Analyse', plural: 'Analyses', icon: <BarChart3 /> },
  note: { label: 'Note', plural: 'Notes', icon: <StickyNote /> },
} as const

const DocCard = ({ app, doc }: { app: Application; doc: Doc }) => {
  const apps = useStore((s) => s.db.applications)
  const [moving, setMoving] = useState(false)
  const open = () => go(`/app/${app.id}/doc/${doc.id}`)
  const copyTo = (targetId: string) => {
    const copy = { ...clone(doc), id: uid(), name: targetId === app.id ? `${doc.name} (copie)` : doc.name, createdAt: nowIso(), updatedAt: nowIso() }
    updateApp(targetId, (a) => void a.docs.push(copy))
    toast(targetId === app.id ? 'Document dupliqué.' : 'Document copié dans l’autre dossier.', 'ok')
  }
  const sub =
    doc.kind === 'cv' ? `Modèle ${getTemplate(doc.templateId).name}` : doc.kind === 'letter' ? getLetterModel(doc.modelId).name : doc.kind === 'note' ? `${doc.content.trim().split(/\s+/).filter(Boolean).length} mots` : 'Adéquation à l’offre'
  return (
    <div className="doc-card">
      <button className="doc-thumb" onClick={open} aria-label={`Ouvrir ${doc.name}`}>
        {doc.kind === 'cv' && (
          <div className="thumb-zoom">
            <CvDocument cv={doc} paginate={false} />
          </div>
        )}
        {doc.kind === 'letter' && (
          <div className="thumb-zoom">
            <LetterDocument letter={doc} />
          </div>
        )}
        {(doc.kind === 'note' || doc.kind === 'analysis') && (
          <div className="thumb-text">
            {KIND[doc.kind].icon}
            <p>{doc.kind === 'note' ? doc.content.slice(0, 220) || 'Note vide' : doc.jobText.slice(0, 220) || 'Collez une offre pour lancer l’analyse'}</p>
          </div>
        )}
      </button>
      <div className="doc-meta">
        <button className="doc-name-btn" onClick={open}>
          <b>{doc.name}</b>
          <span>{sub} · {shortDate(doc.updatedAt)}</span>
        </button>
        <Menu trigger={<button className="icon-btn" aria-label="Actions"><MoreHorizontal /></button>}>
          {(close) => (
            <>
              <button className="menu-item" onClick={async () => { close(); const v = await promptDialog({ title: 'Renommer', value: doc.name, ok: 'Renommer' }); if (v) updateApp(app.id, (a) => void (a.docs.find((d) => d.id === doc.id)!.name = v)) }}><b>Renommer</b></button>
              <button className="menu-item" onClick={() => { close(); copyTo(app.id) }}><b>Dupliquer</b></button>
              {apps.length > 1 && <button className="menu-item" onClick={() => { close(); setMoving(true) }}><b>Copier vers un autre dossier</b></button>}
              <button className="menu-item danger" onClick={async () => { close(); if (await confirmDialog({ title: `Supprimer « ${doc.name} » ?`, message: 'Cette action peut être annulée avec Ctrl+Z tant que vous ne quittez pas la page.', ok: 'Supprimer', danger: true })) updateApp(app.id, (a) => void (a.docs = a.docs.filter((d) => d.id !== doc.id))) }}><b>Supprimer</b></button>
            </>
          )}
        </Menu>
      </div>
      {moving && (
        <Modal title="Copier vers…" onClose={() => setMoving(false)}>
          <div className="pick-list">
            {apps.filter((a) => a.id !== app.id).map((a) => (
              <button key={a.id} className="pick" onClick={() => { copyTo(a.id); setMoving(false) }}>
                <b>{a.company}</b>
                <span>{a.role}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

export const ApplicationPage = ({ app }: { app: Application }) => {
  const db = useStore((s) => s.db)
  const [tab, setTab] = useState<'docs' | 'job' | 'track'>('docs')
  const [modal, setModal] = useState<'cv' | 'letter' | 'dup' | null>(null)
  const [lang, setLang] = useState<Lang>(db.settings.defaultLang)
  const [event, setEvent] = useState('')
  const set = <K extends keyof Application>(k: K) => (v: Application[K]) => updateApp(app.id, (a) => void (a[k] = v))
  const keywords = useMemo(() => (app.jobText.length > 80 ? extractKeywords(app.jobText, 18) : []), [app.jobText])
  const allCvs = db.applications.flatMap((a) => a.docs.filter((d): d is CvDoc => d.kind === 'cv').map((d) => ({ a, d })))
  const addDoc = (doc: Doc, openIt = true) => {
    updateApp(app.id, (a) => void a.docs.push(doc))
    if (openIt) go(`/app/${app.id}/doc/${doc.id}`)
  }
  const count = (k: Doc['kind']) => app.docs.filter((d) => d.kind === k).length
  const create = (k: Doc['kind']) => {
    if (k === 'cv') setModal('cv')
    else if (k === 'letter') setModal('letter')
    else if (k === 'note') addDoc(newNote(`Note ${count('note') + 1}`))
    else addDoc(newAnalysis(`Analyse ${count('analysis') + 1}`, app))
  }
  const remove = async () => {
    if (!(await confirmDialog({ title: `Supprimer le dossier « ${app.company} » ?`, message: `${app.docs.length} document(s) seront supprimés.`, ok: 'Supprimer', danger: true }))) return
    go('/')
    mutate((d) => void (d.applications = d.applications.filter((a) => a.id !== app.id)))
  }
  const duplicate = () => {
    const copy: Application = { ...clone(app), id: uid(), company: `${app.company} (copie)`, status: 'draft', timeline: [], appliedAt: '', createdAt: nowIso(), updatedAt: nowIso(), docs: app.docs.map((d) => ({ ...clone(d), id: uid() })) }
    mutate((d) => void d.applications.unshift(copy))
    go(`/app/${copy.id}`)
    toast('Dossier dupliqué.', 'ok')
  }

  return (
    <div className="page">
      <header className="app-head" style={{ '--c': app.color } as React.CSSProperties}>
        <button className="icon-btn" onClick={() => go('/')} aria-label="Retour"><ArrowLeft /></button>
        <span className="avatar big">{(app.company || '?').slice(0, 2).toUpperCase()}</span>
        <div className="app-head-fields">
          <input className="h-input" value={app.company} onChange={(e) => set('company')(e.target.value)} placeholder="Entreprise" />
          <div className="app-head-sub">
            <input value={app.role} onChange={(e) => set('role')(e.target.value)} placeholder="Poste visé" />
            <input value={app.location} onChange={(e) => set('location')(e.target.value)} placeholder="Lieu" />
          </div>
        </div>
        <select className="status-select" value={app.status} onChange={(e) => setStatus(app.id, e.target.value as Application['status'])} style={{ '--s': STATUSES.find((s) => s.id === app.status)!.color } as React.CSSProperties}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <Menu trigger={<button className="icon-btn" aria-label="Actions"><MoreHorizontal /></button>}>
          {(close) => (
            <>
              <button className="menu-item" onClick={() => { close(); duplicate() }}><Copy /> <b>Dupliquer le dossier</b></button>
              <button className="menu-item danger" onClick={() => { close(); void remove() }}><Trash2 /> <b>Supprimer le dossier</b></button>
            </>
          )}
        </Menu>
      </header>

      <nav className="page-tabs">
        <button className={cx(tab === 'docs' && 'on')} onClick={() => setTab('docs')}>Documents <span>{app.docs.length}</span></button>
        <button className={cx(tab === 'job' && 'on')} onClick={() => setTab('job')}>Offre</button>
        <button className={cx(tab === 'track' && 'on')} onClick={() => setTab('track')}>Suivi <span>{app.timeline.length}</span></button>
      </nav>

      {tab === 'docs' &&
        (['cv', 'letter', 'analysis', 'note'] as const).map((k) => (
          <section key={k} className="doc-section">
            <div className="doc-section-head">
              <h3>{KIND[k].icon} {KIND[k].plural}</h3>
              <div className="row">
                {k === 'cv' && allCvs.length > 0 && <button className="btn small ghost" onClick={() => setModal('dup')}><Copy /> Partir d’un CV existant</button>}
                <button className="btn small" onClick={() => create(k)}><Plus /> {k === 'cv' ? 'Nouveau CV' : k === 'letter' ? 'Nouvelle lettre' : k === 'note' ? 'Nouvelle note' : 'Nouvelle analyse'}</button>
              </div>
            </div>
            <div className="doc-grid">
              {app.docs.filter((d) => d.kind === k).map((d) => (
                <DocCard key={d.id} app={app} doc={d} />
              ))}
              {count(k) === 0 && (
                <button className="doc-empty" onClick={() => create(k)}>
                  <Plus />
                  <span>{k === 'cv' ? 'Choisir un modèle et créer le CV' : k === 'letter' ? 'Choisir un modèle de lettre' : k === 'analysis' ? 'Comparer un CV à l’offre' : 'Prendre des notes'}</span>
                </button>
              )}
            </div>
          </section>
        ))}

      {tab === 'job' && (
        <div className="cards-2">
          <div className="card">
            <h3>L’annonce</h3>
            <div className="form-grid">
              <Field label="Lien" value={app.url} onChange={set('url')} placeholder="https://…" />
              {app.url && <a className="btn small ghost" href={app.url} target="_blank" rel="noreferrer"><ExternalLink /> Ouvrir l’annonce</a>}
              <Area label="Texte de l’annonce" rows={10} value={app.jobText} onChange={set('jobText')} placeholder="Collez ici le texte complet de l’offre." />
            </div>
          </div>
          <div className="card">
            <h3>Repères</h3>
            <div className="form-grid">
              <Field half label="Contact" value={app.contactName} onChange={set('contactName')} placeholder="Mme Dupont" />
              <Field half label="E-mail du contact" value={app.contactEmail} onChange={set('contactEmail')} />
              <Field half label="Rémunération" value={app.salary} onChange={set('salary')} />
              <Field half label="Date limite" type="date" value={app.deadline} onChange={set('deadline')} />
            </div>
            {keywords.length > 0 && (
              <>
                <h4>Termes clés repérés dans l’annonce</h4>
                <div className="kw-list">
                  {keywords.map((k) => (
                    <span key={k.stems.join(' ')} className="kw-chip">{k.term}</span>
                  ))}
                </div>
                <p className="muted small">Créez une analyse dans l’onglet Documents pour les comparer à un CV.</p>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'track' && (
        <div className="cards-2">
          <div className="card">
            <h3>Dates</h3>
            <div className="form-grid">
              <Field half label="Candidature envoyée le" type="date" value={app.appliedAt} onChange={set('appliedAt')} />
              <Field half label="Relancer le" type="date" value={app.followUpAt} onChange={set('followUpAt')} hint="Une relance après 10 à 15 jours sans réponse est bien perçue." />
            </div>
          </div>
          <div className="card">
            <h3>Journal</h3>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                if (!event.trim()) return
                updateApp(app.id, (a) => void a.timeline.unshift({ id: uid(), date: new Date().toISOString().slice(0, 10), text: event.trim() }))
                setEvent('')
              }}
            >
              <input className="input" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Appel avec la RH, entretien prévu le…" />
              <button className="btn" type="submit"><Plus /> Ajouter</button>
            </form>
            <ul className="timeline">
              {app.timeline.map((t) => (
                <li key={t.id}>
                  <span>{shortDate(t.date)}</span>
                  <p>{t.text}</p>
                  <button className="icon-btn" onClick={() => updateApp(app.id, (a) => void (a.timeline = a.timeline.filter((x) => x.id !== t.id)))} aria-label="Supprimer"><Trash2 /></button>
                </li>
              ))}
              {!app.timeline.length && <li className="muted">Rien pour l’instant. Les changements de statut s’ajoutent ici automatiquement.</li>}
            </ul>
          </div>
        </div>
      )}

      {modal === 'cv' && (
        <TemplateGallery
          title="Nouveau CV · choisissez un modèle"
          source={db.profile}
          header={<Segmented value={lang} onChange={setLang} options={[{ value: 'fr', label: 'CV en français' }, { value: 'en', label: 'CV en anglais' }]} />}
          onClose={() => setModal(null)}
          onPick={(t) => {
            setModal(null)
            addDoc(newCv(db.profile, t.id, lang, `CV ${app.company}`.trim()))
          }}
        />
      )}
      {modal === 'dup' && (
        <Modal title="Partir d’un CV existant" onClose={() => setModal(null)}>
          <p className="muted">Le CV est copié dans ce dossier : vous l’adaptez à cette offre sans toucher à l’original.</p>
          <div className="pick-list">
            {allCvs.map(({ a, d }) => (
              <button key={d.id} className="pick" onClick={() => { setModal(null); addDoc({ ...clone(d), id: uid(), name: `CV ${app.company}`.trim(), createdAt: nowIso(), updatedAt: nowIso() }) }}>
                <b>{d.name}</b>
                <span>{a.company} · modèle {getTemplate(d.templateId).name} · {shortDate(d.updatedAt)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === 'letter' && (
        <LetterModelPicker
          lang={lang}
          onClose={() => setModal(null)}
          onPick={(m) => {
            setModal(null)
            const cv = app.docs.find((d): d is CvDoc => d.kind === 'cv')
            const letter: LetterDoc = newLetter(db.profile, app, cv?.templateId ?? 'atlas', m.id, m.lang, `Lettre ${app.company}`.trim())
            if (cv) {
              letter.design = { ...clone(cv.design), showPhoto: false }
              letter.sender = clone(cv.basics)
            }
            addDoc(letter)
          }}
        />
      )}
    </div>
  )
}
