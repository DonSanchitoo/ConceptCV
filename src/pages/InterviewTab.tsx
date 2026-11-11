import { Plus, Sparkles, Trash2 } from 'lucide-react'
import type { Application, CvDoc, Interview } from '../types'
import { updateApp } from '../store'
import { interviewDraft } from '../lib/kit'
import { uid } from '../lib/util'
import { Area, Empty, Field } from '../ui/kit'
import { confirmDialog } from '../ui/dialog'

/** Fiche de préparation d'entretien : canevas généré depuis l'offre et le CV, entièrement modifiable. */
export const InterviewTab = ({ app }: { app: Application }) => {
  const cv = app.submissions?.[0]?.cv ?? app.docs.find((d): d is CvDoc => d.kind === 'cv')
  const iv = app.interview
  const set = (fn: (i: Interview) => void) => updateApp(app.id, (a) => void (a.interview && fn(a.interview)))
  const generate = () => updateApp(app.id, (a) => void (a.interview = interviewDraft(a, cv)))
  if (!iv)
    return (
      <Empty
        icon={<Sparkles />}
        title="Préparer l’entretien"
        text="L’outil prépare un canevas : les questions probables d’après l’annonce, vos exemples d’après le CV, vos questions à poser. Vous modifiez ensuite tout ce que vous voulez."
        action={<button className="btn primary" onClick={generate}><Sparkles /> Créer la fiche</button>}
      />
    )
  return (
    <div className="cards-2">
      <div>
        <div className="card">
          <h3>Questions probables</h3>
          <p className="muted small">Notez quelques mots-clés, pas un texte à réciter.</p>
          {iv.questions.map((q, i) => (
            <div key={q.id} className="qa">
              <div className="qa-head">
                <input className="qa-q" value={q.q} placeholder="Question" onChange={(e) => set((x) => void (x.questions[i].q = e.target.value))} />
                <button className="icon-btn" aria-label="Supprimer" onClick={() => set((x) => void x.questions.splice(i, 1))}><Trash2 /></button>
              </div>
              <Area value={q.a} rows={1} placeholder="Votre réponse en quelques points" onChange={(v) => set((x) => void (x.questions[i].a = v))} />
            </div>
          ))}
          <button className="btn small add" onClick={() => set((x) => void x.questions.push({ id: uid(), q: '', a: '' }))}><Plus /> Ajouter une question</button>
        </div>
        <div className="card">
          <h3>Mes exemples à raconter</h3>
          <p className="muted small">Un exemple tient en trois temps : la situation, ce que vous avez fait, le résultat.</p>
          {iv.stories.map((s, i) => (
            <div key={s.id} className="qa">
              <div className="qa-head">
                <input className="qa-q" value={s.title} placeholder="Titre de l’exemple" onChange={(e) => set((x) => void (x.stories[i].title = e.target.value))} />
                <button className="icon-btn" aria-label="Supprimer" onClick={() => set((x) => void x.stories.splice(i, 1))}><Trash2 /></button>
              </div>
              <Area label="Situation" rows={1} value={s.situation} onChange={(v) => set((x) => void (x.stories[i].situation = v))} />
              <Area label="Ce que j’ai fait" rows={1} value={s.action} onChange={(v) => set((x) => void (x.stories[i].action = v))} />
              <Area label="Résultat" rows={1} value={s.result} onChange={(v) => set((x) => void (x.stories[i].result = v))} />
            </div>
          ))}
          <button className="btn small add" onClick={() => set((x) => void x.stories.push({ id: uid(), title: '', situation: '', action: '', result: '' }))}><Plus /> Ajouter un exemple</button>
        </div>
      </div>
      <div>
        <div className="card">
          <h3>Le rendez-vous</h3>
          <div className="form-grid">
            <Field half label="Date et heure" type="datetime-local" value={iv.date} onChange={(v) => set((x) => void (x.date = v))} />
            <Field half label="Lieu ou lien visio" value={iv.place} onChange={(v) => set((x) => void (x.place = v))} />
            <Field label="Interlocuteurs" value={iv.people} onChange={(v) => set((x) => void (x.people = v))} placeholder="Nom, fonction" />
          </div>
        </div>
        <div className="card">
          <h3>Mes questions à poser</h3>
          <Area rows={4} value={iv.ask} onChange={(v) => set((x) => void (x.ask = v))} />
        </div>
        <div className="card">
          <h3>Notes</h3>
          <Area rows={6} value={iv.notes} onChange={(v) => set((x) => void (x.notes = v))} placeholder="Ce que vous savez de l’entreprise, ce qui s’est dit pendant l’entretien, la suite annoncée." />
        </div>
        <button
          className="btn small ghost danger-text"
          onClick={async () => {
            if (await confirmDialog({ title: 'Repartir d’un canevas neuf ?', message: 'La fiche actuelle est remplacée.', ok: 'Remplacer', danger: true })) generate()
          }}
        >
          Régénérer le canevas
        </button>
      </div>
    </div>
  )
}
