import { ArrowLeft, CopyPlus, Download, Lock } from 'lucide-react'
import type { Application } from '../types'
import { toast, updateApp } from '../store'
import { go } from '../lib/router'
import { clone, downloadBlob, nowIso, shortDate, uid } from '../lib/util'
import { CvDocument } from '../render/CvDocument'
import { LetterDocument } from '../render/LetterDocument'
import { printNode } from '../export/print'
import { cvToDocx, letterToDocx } from '../export/docx'
import { Preview } from '../editor/Preview'
import { Empty, Menu } from '../ui/kit'

/** Document envoyé, en lecture seule : exactement ce que le recruteur a reçu. */
export const SubmissionPage = ({ app, subId, kind }: { app: Application; subId: string; kind: string }) => {
  const subs = app.submissions ?? []
  const sub = subs.find((s) => s.id === subId)
  const doc = kind === 'cv' ? sub?.cv : sub?.letter
  if (!sub || !doc) return <Empty icon={<Lock />} title="Version introuvable" text="Cet envoi n’existe plus." action={<button className="btn primary" onClick={() => go(`/app/${app.id}`)}>Retour au dossier</button>} />
  const n = subs.length - subs.indexOf(sub)
  const file = `${doc.kind === 'cv' ? 'CV' : 'Lettre'}_${app.company.replace(/\W+/g, '_')}_v${n}`
  const restore = () => {
    updateApp(app.id, (a) => void a.docs.push({ ...clone(doc), id: uid(), name: `${doc.name} (depuis la version ${n})`, createdAt: nowIso(), updatedAt: nowIso() }))
    toast('Copie modifiable ajoutée aux documents du dossier.', 'ok')
    go(`/app/${app.id}`)
  }
  return (
    <div className="editor">
      <header className="editor-bar">
        <button className="icon-btn" onClick={() => go(`/app/${app.id}`)} aria-label="Retour"><ArrowLeft /></button>
        <b className="doc-name">{doc.name}</b>
        <span className="badge"><Lock /> Version {n}, envoyée le {shortDate(sub.date)}</span>
        <div className="spacer" />
        <button className="btn" onClick={restore}><CopyPlus /> <span className="hide-s">En faire une copie modifiable</span></button>
        <Menu trigger={<button className="btn primary"><Download /> <span className="hide-s">Exporter</span></button>}>
          {(close) => (
            <>
              <button className="menu-item" onClick={() => { close(); void printNode(doc.kind === 'cv' ? <CvDocument cv={doc} /> : <LetterDocument letter={doc} />, file, doc.design.pageFormat) }}><b>PDF</b></button>
              <button className="menu-item" onClick={async () => { close(); downloadBlob(doc.kind === 'cv' ? await cvToDocx(doc) : await letterToDocx(doc), `${file}.docx`) }}><b>Word (.docx)</b></button>
            </>
          )}
        </Menu>
      </header>
      <div className="editor-preview frozen">
        <Preview pageWidthMm={doc.design.pageFormat === 'Letter' ? 215.9 : 210}>
          {doc.kind === 'cv' ? <CvDocument cv={doc} /> : <LetterDocument letter={doc} />}
        </Preview>
      </div>
    </div>
  )
}
