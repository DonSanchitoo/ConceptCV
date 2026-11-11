import { useMemo, useRef, useState } from 'react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { BellRing, Briefcase, CalendarClock, FileText, Columns3, LayoutGrid, Mail, MapPin, Plus, Search, StickyNote } from 'lucide-react'
import type { AppStatus, Application } from '../types'
import { mutate, useStore } from '../store'
import { newApplication } from '../lib/factory'
import { nowIso, shortDate, uid } from '../lib/util'
import { STATUSES, statusOf } from '../lib/status'
import { go } from '../lib/router'
import { Area, Empty, Field, Modal, cx } from '../ui/kit'
import { useDndSensors } from '../ui/Sortable'

const today = () => new Date().toISOString().slice(0, 10)

export const setStatus = (appId: string, status: AppStatus) =>
  mutate((db) => {
    const a = db.applications.find((x) => x.id === appId)
    if (!a || a.status === status) return
    a.status = status
    a.updatedAt = nowIso()
    if (status === 'sent' && !a.appliedAt) a.appliedAt = today()
    a.timeline.unshift({ id: uid(), date: today(), text: `Statut : ${statusOf(status).label}` })
  })

const Card = ({ a, compact }: { a: Application; compact?: boolean }) => {
  const st = statusOf(a.status)
  const n = (k: string) => a.docs.filter((d) => d.kind === k).length
  const late = a.followUpAt && a.followUpAt <= today() && !['offer', 'rejected', 'archived'].includes(a.status)
  return (
    <button className={cx('app-card', compact && 'compact')} onClick={() => go(`/app/${a.id}`)} style={{ '--c': a.color } as React.CSSProperties}>
      <div className="app-card-top">
        <span className="avatar">{(a.company || '?').slice(0, 2).toUpperCase()}</span>
        <div className="app-card-title">
          <b>{a.company || 'Sans nom'}</b>
          <span>{a.role || 'Poste à préciser'}</span>
        </div>
      </div>
      {!compact && (
        <div className="app-card-meta">
          {a.location && <span><MapPin /> {a.location}</span>}
          {a.deadline && <span><CalendarClock /> {shortDate(a.deadline)}</span>}
          {late && <span className="late"><BellRing /> Relance</span>}
        </div>
      )}
      <div className="app-card-foot">
        {!compact && <span className="status" style={{ '--s': st.color } as React.CSSProperties}>{st.label}</span>}
        <span className="counts">
          <span title="CV"><FileText /> {n('cv')}</span>
          <span title="Lettres"><Mail /> {n('letter')}</span>
          <span title="Notes et analyses"><StickyNote /> {n('note') + n('analysis')}</span>
        </span>
      </div>
    </button>
  )
}

const Draggable = ({ a }: { a: Application }) => {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: a.id })
  // Un glisser-déposer ne doit pas ouvrir le dossier au relâchement.
  const dragged = useRef(false)
  if (isDragging) dragged.current = true
  const swallow = (e: React.MouseEvent) => {
    if (!dragged.current) return
    dragged.current = false
    e.stopPropagation()
    e.preventDefault()
  }
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClickCapture={swallow} style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.85 : 1 }}>
      <Card a={a} compact />
    </div>
  )
}

const Column = ({ status, apps }: { status: (typeof STATUSES)[number]; apps: Application[] }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  return (
    <div ref={setNodeRef} className={cx('kcol', isOver && 'over')}>
      <h4>
        <i style={{ background: status.color }} /> {status.label} <span>{apps.length}</span>
      </h4>
      {apps.map((a) => (
        <Draggable key={a.id} a={a} />
      ))}
    </div>
  )
}

export const NewApplicationModal = ({ onClose }: { onClose: () => void }) => {
  const [f, setF] = useState({ company: '', role: '', location: '', url: '', jobText: '' })
  const create = () => {
    const a = newApplication({ ...f })
    mutate((db) => void db.applications.unshift(a))
    onClose()
    go(`/app/${a.id}`)
  }
  return (
    <Modal
      title="Nouvelle candidature"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!f.company.trim()} onClick={create}>Créer le dossier</button>
        </>
      }
    >
      <div className="form-grid">
        <Field half autoFocus label="Entreprise" value={f.company} onChange={(v) => setF({ ...f, company: v })} />
        <Field half label="Poste visé" value={f.role} onChange={(v) => setF({ ...f, role: v })} />
        <Field half label="Lieu" value={f.location} onChange={(v) => setF({ ...f, location: v })} />
        <Field half label="Lien de l’annonce" value={f.url} onChange={(v) => setF({ ...f, url: v })} />
        <Area label="Texte de l’annonce (facultatif)" rows={4} value={f.jobText} onChange={(v) => setF({ ...f, jobText: v })} hint="Sert à mesurer l’adéquation de vos CV et à suggérer des mots-clés." />
      </div>
    </Modal>
  )
}

export const Dashboard = () => {
  const apps = useStore((s) => s.db.applications)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<AppStatus | 'all'>('all')
  const [view, setView] = useState<'grid' | 'board'>(() => (localStorage.getItem('ccv-view') as 'grid' | 'board') || 'grid')
  const [creating, setCreating] = useState(false)
  const sensors = useDndSensors()
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return apps.filter((a) => (filter === 'all' || a.status === filter) && (!n || `${a.company} ${a.role} ${a.location}`.toLowerCase().includes(n)))
  }, [apps, q, filter])
  const sent = apps.filter((a) => ['sent', 'interview', 'offer', 'rejected'].includes(a.status)).length
  const answered = apps.filter((a) => ['interview', 'offer', 'rejected'].includes(a.status)).length
  const follow = apps.filter((a) => a.followUpAt && a.followUpAt <= today() && !['offer', 'rejected', 'archived'].includes(a.status)).length
  const stats = [
    { label: 'Candidatures', value: apps.length },
    { label: 'Envoyées', value: sent },
    { label: 'Entretiens', value: apps.filter((a) => a.status === 'interview' || a.status === 'offer').length },
    { label: 'Taux de réponse', value: sent ? `${Math.round((answered / sent) * 100)} %` : '–' },
    { label: 'Relances à faire', value: follow, alert: follow > 0 },
  ]
  const switchView = (v: 'grid' | 'board') => {
    setView(v)
    localStorage.setItem('ccv-view', v)
  }
  const onDragEnd = (e: DragEndEvent) => e.over && setStatus(String(e.active.id), e.over.id as AppStatus)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Candidatures</h1>
          <p className="muted">Un dossier par entreprise : CV, lettres, analyses et notes.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus /> Nouvelle candidature
        </button>
      </header>
      {apps.length === 0 ? (
        <Empty icon={<Briefcase />} title="Aucune candidature pour l’instant" text="Créez un premier dossier : vous y rangerez le CV, la lettre et vos notes pour cette entreprise." action={<button className="btn primary" onClick={() => setCreating(true)}><Plus /> Créer mon premier dossier</button>} />
      ) : (
        <>
          <div className="stats">
            {stats.map((s) => (
              <div key={s.label} className={cx('stat', s.alert && 'alert')}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="toolbar">
            <label className="search">
              <Search />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une entreprise, un poste, une ville" />
            </label>
            <div className="segmented">
              <button className={cx(view === 'grid' && 'on')} onClick={() => switchView('grid')} title="Grille"><LayoutGrid /></button>
              <button className={cx(view === 'board' && 'on')} onClick={() => switchView('board')} title="Tableau de suivi"><Columns3 /></button>
            </div>
          </div>
          {view === 'grid' ? (
            <>
              <div className="chips-row">
                <button className={cx('pill', filter === 'all' && 'on')} onClick={() => setFilter('all')}>Toutes</button>
                {STATUSES.filter((s) => apps.some((a) => a.status === s.id)).map((s) => (
                  <button key={s.id} className={cx('pill', filter === s.id && 'on')} onClick={() => setFilter(s.id)}>
                    {s.label} · {apps.filter((a) => a.status === s.id).length}
                  </button>
                ))}
              </div>
              <div className="app-grid">
                {list.map((a) => (
                  <Card key={a.id} a={a} />
                ))}
              </div>
              {!list.length && <p className="muted center">Aucun dossier ne correspond.</p>}
            </>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="board">
                {STATUSES.map((s) => (
                  <Column key={s.id} status={s} apps={list.filter((a) => a.status === s.id)} />
                ))}
              </div>
            </DndContext>
          )}
        </>
      )}
      {creating && <NewApplicationModal onClose={() => setCreating(false)} />}
    </div>
  )
}
