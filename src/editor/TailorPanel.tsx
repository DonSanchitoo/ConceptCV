import { useMemo } from 'react'
import { ArrowUpToLine, Check, Eye, ListPlus, Plus, Type, X } from 'lucide-react'
import type { Application, CvDoc } from '../types'
import { mutate, useStore } from '../store'
import { tailor, type Proposal } from '../analysis/tailor'
import type { Patch } from '../render/CvDocument'
import { Area, ScoreRing } from '../ui/kit'

const ICON: Record<Proposal['kind'], React.ReactNode> = {
  headline: <Type />, show: <Eye />, 'add-item': <ListPlus />, 'add-bullet': <Plus />, 'add-skill': <Plus />, reorder: <ArrowUpToLine />,
}

/** Assistant « Adapter à l'offre » : il propose, l'utilisateur valide ou écarte chaque point. */
export const TailorPanel = ({ cv, app, patch, onJobText }: { cv: CvDoc; app: Application; patch: Patch; onJobText: (v: string) => void }) => {
  const profile = useStore((s) => s.db.profile)
  const r = useMemo(() => tailor(cv, profile, app.jobText, app.role), [cv, profile, app.jobText, app.role])
  const ignored = cv.ignored?.length ?? 0
  const hasJob = app.jobText.trim().length >= 80
  return (
    <div className="ats">
      <div className="score-card">
        <ScoreRing score={hasJob ? r.coverage : 0} size={84} label="%" />
        <div>
          <b>{hasJob ? 'Adéquation à l’offre' : 'Collez d’abord l’annonce'}</b>
          <p>{hasJob ? `${r.proposals.length} proposition(s). Rien n’est modifié sans votre accord.` : 'L’assistant compare l’offre, ce CV et votre profil.'}</p>
          <p className="muted small">Chaque action s’annule avec Ctrl+Z.</p>
        </div>
      </div>
      <Area label="Texte de l’offre visée" rows={3} value={app.jobText} onChange={onJobText} placeholder="Collez ici l’annonce." className="job-area" />
      {hasJob && (
        <div className="check-group">
          <h4>Propositions</h4>
          {!r.proposals.length && <p className="muted">Plus rien à proposer : ce CV reprend ce que votre profil contient pour cette offre.</p>}
          {r.proposals.map((p) => (
            <div key={p.id} className="proposal">
              <span className="proposal-icon">{ICON[p.kind]}</span>
              <div className="proposal-body">
                <b>{p.title}</b>
                {p.detail && <p>{p.detail}</p>}
                {p.keywords.length > 0 && (
                  <div className="kw-list">
                    {p.keywords.map((k) => (
                      <span key={k} className="kw-chip missing">{k}</span>
                    ))}
                  </div>
                )}
                <div className="row">
                  <button className="btn small primary" onClick={() => patch((c) => p.apply(c))}><Check /> Appliquer</button>
                  <button className="btn small ghost" onClick={() => patch((c) => void (c.ignored = [...(c.ignored ?? []), p.id]))}><X /> Ignorer</button>
                </div>
              </div>
            </div>
          ))}
          {ignored > 0 && (
            <button className="btn small ghost" onClick={() => patch((c) => void (c.ignored = []))}>
              Revoir les {ignored} proposition(s) ignorée(s)
            </button>
          )}
        </div>
      )}
      {hasJob && r.unsourced.length > 0 && (
        <div className="check-group">
          <h4>Termes de l’offre absents de votre profil</h4>
          <div className="kw-list">
            {r.unsourced.map((k) => (
              <span key={k.term} className="kw-chip">{k.term}</span>
            ))}
          </div>
          <p className="muted small">L’assistant ne peut rien proposer pour ceux-là. Si l’un d’eux décrit vraiment votre expérience, ajoutez-le vous-même, puis enregistrez-le dans votre profil pour les prochaines fois.</p>
        </div>
      )}
      <button className="btn small ghost" onClick={() => mutate((db) => void (db.settings.assistant = false))}>
        Désactiver l’assistant (réactivable dans les réglages)
      </button>
    </div>
  )
}
