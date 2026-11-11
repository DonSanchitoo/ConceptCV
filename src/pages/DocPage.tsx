import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { AnalysisDoc, Application, CvDoc, NoteDoc } from '../types'
import { updateDoc } from '../store'
import { go } from '../lib/router'
import { CvEditor } from '../editor/CvEditor'
import { LetterEditor } from '../editor/LetterEditor'
import { AtsPanel } from '../editor/AtsPanel'
import { CvDocument } from '../render/CvDocument'
import { Select, Empty } from '../ui/kit'
import { FileQuestion } from 'lucide-react'

const Bar = ({ app, name, onRename }: { app: Application; name: string; onRename: (v: string) => void }) => (
  <header className="editor-bar">
    <button className="icon-btn" onClick={() => go(`/app/${app.id}`)} aria-label="Retour"><ArrowLeft /></button>
    <input className="doc-name" value={name} onChange={(e) => onRename(e.target.value)} aria-label="Nom du document" />
    <span className="muted small hide-s">{app.company} · enregistré automatiquement</span>
  </header>
)

const NoteEditor = ({ app, note }: { app: Application; note: NoteDoc }) => (
  <div className="simple-doc">
    <Bar app={app} name={note.name} onRename={(v) => updateDoc<NoteDoc>(app.id, note.id, (n) => void (n.name = v))} />
    <textarea
      className="note-area"
      value={note.content}
      autoFocus
      placeholder={'Vos notes pour cette candidature.\n\nQuelques pistes :\n• ce que vous savez de l’entreprise, de l’équipe, du produit\n• les questions à poser en entretien\n• vos arguments et exemples pour ce poste\n• le compte rendu de vos échanges'}
      onChange={(e) => updateDoc<NoteDoc>(app.id, note.id, (n) => void (n.content = e.target.value))}
    />
  </div>
)

const AnalysisView = ({ app, doc }: { app: Application; doc: AnalysisDoc }) => {
  const cvs = app.docs.filter((d): d is CvDoc => d.kind === 'cv')
  const cv = cvs.find((c) => c.id === doc.cvId) ?? cvs[0]
  const [pages, setPages] = useState(1)
  const set = (fn: (d: AnalysisDoc) => void) => updateDoc<AnalysisDoc>(app.id, doc.id, fn)
  return (
    <div className="simple-doc">
      <Bar app={app} name={doc.name} onRename={(v) => set((d) => void (d.name = v))} />
      <div className="analysis">
        {!cv ? (
          <Empty icon={<FileQuestion />} title="Aucun CV dans ce dossier" text="Créez d’abord un CV : l’analyse le compare au texte de l’offre." action={<button className="btn primary" onClick={() => go(`/app/${app.id}`)}>Retour au dossier</button>} />
        ) : (
          <>
            <Select label="CV analysé" value={cv.id} onChange={(v) => set((d) => void (d.cvId = v))} options={cvs.map((c) => ({ value: c.id, label: c.name }))} />
            <AtsPanel cv={cv} jobText={doc.jobText} onJobText={(v) => set((d) => void (d.jobText = v))} pages={pages} extra={<button className="btn small" onClick={() => go(`/app/${app.id}/doc/${cv.id}`)}>Ouvrir ce CV pour le corriger</button>} />
            <div className="offscreen" aria-hidden>
              <CvDocument cv={cv} onPages={setPages} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const DocPage = ({ app, docId }: { app: Application; docId: string }) => {
  const doc = app.docs.find((d) => d.id === docId)
  if (!doc) return <Empty icon={<FileQuestion />} title="Document introuvable" text="Il a peut-être été supprimé." action={<button className="btn primary" onClick={() => go(`/app/${app.id}`)}>Retour au dossier</button>} />
  if (doc.kind === 'cv') return <CvEditor app={app} cv={doc} />
  if (doc.kind === 'letter') return <LetterEditor app={app} letter={doc} />
  if (doc.kind === 'note') return <NoteEditor app={app} note={doc} />
  return <AnalysisView app={app} doc={doc} />
}
