import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { CvDoc } from '../types'
import { analyzeCv, type Check, type Level } from '../analysis/ats'
import { cvPlainText } from '../analysis/keywords'
import { Area, ScoreRing, cx } from '../ui/kit'

export const LevelIcon = ({ level }: { level: Level }) =>
  level === 'ok' ? <CheckCircle2 className="lv ok" /> : level === 'error' ? <XCircle className="lv error" /> : level === 'warn' ? <AlertTriangle className="lv warn" /> : <Info className="lv info" />

const ORDER: Level[] = ['error', 'warn', 'info', 'ok']

export const AtsPanel = ({ cv, jobText, onJobText, pages, onSelectSection, extra }: { cv: CvDoc; jobText: string; onJobText: (v: string) => void; pages: number; onSelectSection?: (id: string) => void; extra?: React.ReactNode }) => {
  const report = useMemo(() => analyzeCv(cv, jobText, pages), [cv, jobText, pages])
  const [raw, setRaw] = useState(false)
  const groups = [...new Set(report.checks.map((c) => c.group))]
  const verdict = report.score >= 80 ? 'Prêt à envoyer' : report.score >= 55 ? 'Quelques points à corriger' : 'À retravailler'
  return (
    <div className="ats">
      <div className="score-card">
        <ScoreRing score={report.score} size={84} label="/100" />
        <div>
          <b>{verdict}</b>
          <p>
            Structure et rédaction : {report.base}/100
            {report.coverage !== null && <> · adéquation à l’offre : {report.coverage} %</>}
          </p>
          <p className="muted">{report.words} mots · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
      </div>
      {extra}
      <Area label="Texte de l’offre visée" rows={3} value={jobText} onChange={onJobText} placeholder="Collez ici l’annonce : l’outil en tire les termes clés et les compare à votre CV." className="job-area" />
      {report.matches.length > 0 && (
        <div className="kw">
          <span className="field-label">Termes clés de l’offre</span>
          <div className="kw-list">
            {report.matches.map((m) => (
              <span key={m.keyword.stems.join(' ')} className={cx('kw-chip', m.found ? 'found' : 'missing')} title={`${m.keyword.count} occurrence(s) dans l’offre`}>
                {m.keyword.term}
              </span>
            ))}
          </div>
          <p className="muted small">En vert : présents dans le CV. En rouge : absents. N’ajoutez que ceux qui sont vrais pour vous.</p>
        </div>
      )}
      {groups.map((g) => (
        <div className="check-group" key={g}>
          <h4>{g}</h4>
          {report.checks
            .filter((c) => c.group === g)
            .sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level))
            .map((c: Check) => (
              <div key={c.id} className={cx('check', c.level, c.sectionId && onSelectSection && 'link')} onClick={c.sectionId && onSelectSection ? () => onSelectSection(c.sectionId!) : undefined}>
                <LevelIcon level={c.level} />
                <div>
                  <b>{c.title}</b>
                  {c.detail && <p>{c.detail}</p>}
                </div>
              </div>
            ))}
        </div>
      ))}
      <div className="check-group">
        <button className="btn small" onClick={() => setRaw((r) => !r)}>
          {raw ? 'Masquer' : 'Voir'} ce qu’un ATS lit
        </button>
        {raw && (
          <>
            <p className="muted small">Texte brut, dans l’ordre de lecture d’un logiciel de tri. Si cet ordre a du sens, le CV sera correctement interprété.</p>
            <pre className="raw">{cvPlainText(cv)}</pre>
          </>
        )}
      </div>
    </div>
  )
}
