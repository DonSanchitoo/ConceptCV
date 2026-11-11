import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GraduationCap, Palette, PenLine, Plus, Signature, SpellCheck, Trash2 } from 'lucide-react'
import type { Application, CvDoc, LetterDoc, ParagraphRole, Recipient } from '../types'
import { mutate, toast, updateDoc, useStore } from '../store'
import { LetterDocument } from '../render/LetterDocument'
import { analyzeLetter } from '../analysis/coach'
import { countWords, letterPlainText } from '../analysis/keywords'
import { checkSpelling, type SpellIssue } from '../analysis/spell'
import { CLOSINGS, GREETINGS, ROLE_GUIDES, getLetterModel } from '../templates/letterModels'
import { CV_TEMPLATES, getTemplate } from '../templates/cvTemplates'
import { downloadBlob, fileToSignature, fullName, slug, uid } from '../lib/util'
import { printNode } from '../export/print'
import { letterToDocx } from '../export/docx'
import { confirmDialog } from '../ui/dialog'
import { Area, Field, Range, ScoreRing, Select, cx } from '../ui/kit'
import { EditorShell } from './EditorShell'
import { Preview } from './Preview'
import { DesignControls } from './CvPanels'
import { BasicsForm } from './forms'
import { LevelIcon } from './AtsPanel'
import { LetterModelPicker } from './LetterModelPicker'

const ROLES: ParagraphRole[] = ['hook', 'me', 'you', 'us', 'closing', 'free']

interface LocatedIssue extends SpellIssue {
  paragraphId: string
}

export const LetterEditor = ({ app, letter }: { app: Application; letter: LetterDoc }) => {
  const [tab, setTab] = useState('write')
  const [pages, setPages] = useState(1)
  const [focus, setFocus] = useState<string>('')
  const [picker, setPicker] = useState(false)
  const [issues, setIssues] = useState<LocatedIssue[] | null>(null)
  const [checking, setChecking] = useState(false)
  const consent = useStore((s) => s.db.settings.spellcheckConsent)
  const profileSig = useStore((s) => s.db.profile.signatureImage)
  const sigFile = useRef<HTMLInputElement>(null)
  const patch = useCallback((fn: (l: LetterDoc) => void) => updateDoc<LetterDoc>(app.id, letter.id, fn), [app.id, letter.id])
  const report = useMemo(() => analyzeLetter(letter, pages, app.company, app.role), [letter, pages, app.company, app.role])
  const guides = ROLE_GUIDES[letter.lang]
  const file = slug(['Lettre', fullName(letter.sender), app.company].filter(Boolean).join(' ')) || 'Lettre'
  const setR = (k: keyof Recipient) => (v: string) => patch((l) => void (l.recipient[k] = v))
  const cvOfApp = app.docs.find((d): d is CvDoc => d.kind === 'cv')

  const spell = async () => {
    if (!consent) {
      const ok = await confirmDialog({
        title: 'Vérifier l’orthographe',
        message: 'Le texte de la lettre est envoyé au service gratuit LanguageTool (api.languagetool.org) pour analyse. C’est le seul moment où un contenu quitte votre appareil. Continuer ?',
        ok: 'Vérifier',
      })
      if (!ok) return
      mutate((db) => void (db.settings.spellcheckConsent = true))
    }
    setChecking(true)
    try {
      const found: LocatedIssue[] = []
      const text = letter.paragraphs.map((p) => p.text).join('\n\n')
      const all = await checkSpelling(text, letter.lang)
      let offset = 0
      for (const p of letter.paragraphs) {
        for (const i of all) if (i.offset >= offset && i.offset + i.length <= offset + p.text.length) found.push({ ...i, offset: i.offset - offset, paragraphId: p.id })
        offset += p.text.length + 2
      }
      setIssues(found)
      toast(found.length ? `${found.length} point(s) à vérifier.` : 'Aucune faute détectée.', found.length ? 'info' : 'ok')
    } catch (e) {
      toast((e as Error).message || 'Correcteur indisponible.', 'warn')
    } finally {
      setChecking(false)
    }
  }
  const applyFix = (issue: LocatedIssue, replacement: string) => {
    patch((l) => {
      const p = l.paragraphs.find((x) => x.id === issue.paragraphId)
      if (p && p.text.slice(issue.offset, issue.offset + issue.length) === issue.bad) p.text = p.text.slice(0, issue.offset) + replacement + p.text.slice(issue.offset + issue.length)
    })
    const delta = replacement.length - issue.length
    setIssues((list) => (list ?? []).filter((x) => x !== issue).map((x) => (x.paragraphId === issue.paragraphId && x.offset > issue.offset ? { ...x, offset: x.offset + delta } : x)))
  }

  const write = (
    <div className="steps">
      <div className="panel-block tpl-current">
        <div>
          <span className="field-label">Modèle de lettre</span>
          <b>{getLetterModel(letter.modelId).name}</b>
          <span className="muted small">{getLetterModel(letter.modelId).when}</span>
        </div>
        <button className="btn" onClick={() => setPicker(true)}>Changer</button>
      </div>
      <details className="fold">
        <summary>Vos coordonnées</summary>
        <BasicsForm basics={letter.sender} onChange={(p) => patch((l) => void Object.assign(l.sender, p))} withPhoto={false} />
      </details>
      <details className="fold" open={!letter.recipient.address}>
        <summary>Destinataire</summary>
        <div className="form-grid">
          <Field half label="Entreprise" value={letter.recipient.company} onChange={setR('company')} />
          <Field half label="Destinataire" value={letter.recipient.contact} onChange={setR('contact')} placeholder="Mme Dupont" hint="Un nom vaut mieux que « Madame, Monsieur »." />
          <Field half label="Fonction" value={letter.recipient.title} onChange={setR('title')} placeholder="Responsable recrutement" />
          <Field half label="Adresse" value={letter.recipient.address} onChange={setR('address')} />
          <Field half label="Code postal" value={letter.recipient.postalCode} onChange={setR('postalCode')} />
          <Field half label="Ville" value={letter.recipient.city} onChange={setR('city')} />
        </div>
      </details>
      <details className="fold" open>
        <summary>Lieu, date, objet</summary>
        <div className="form-grid">
          <Field half label="Lieu" value={letter.place} onChange={(v) => patch((l) => void (l.place = v))} />
          <Field half label="Date" value={letter.date} onChange={(v) => patch((l) => void (l.date = v))} />
          <Field label="Objet" value={letter.subject} onChange={(v) => patch((l) => void (l.subject = v))} hint="Le poste, et la référence de l’annonce s’il y en a une." />
          <Field half label="Référence de l’annonce" value={letter.reference} onChange={(v) => patch((l) => void (l.reference = v))} />
          <Field half label="Formule d’appel" value={letter.greeting} onChange={(v) => patch((l) => void (l.greeting = v))} />
        </div>
        <div className="chips-row">
          {GREETINGS[letter.lang].map((g) => (
            <button key={g} className="pill" onClick={() => patch((l) => void (l.greeting = g.replace(/\[nom\]|\[name\]/, l.recipient.contact || '…')))}>
              {g}
            </button>
          ))}
        </div>
      </details>

      {letter.paragraphs.map((p, idx) => {
        const g = guides[p.role]
        const wc = countWords(p.text)
        const [min, max] = g.words
        const adv = report.byParagraph[p.id] ?? []
        const open = focus === p.id
        return (
          <div key={p.id} className={cx('para-card', open && 'open')} id={`para-${p.id}`}>
            <div className="para-head">
              <span className="step-n">{idx + 1}</span>
              <select className="para-role" value={p.role} onChange={(e) => patch((l) => void (l.paragraphs[idx].role = e.target.value as ParagraphRole))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {guides[r].label}
                  </option>
                ))}
              </select>
              <button className="icon-btn" disabled={idx === 0} onClick={() => patch((l) => void ([l.paragraphs[idx - 1], l.paragraphs[idx]] = [l.paragraphs[idx], l.paragraphs[idx - 1]]))}><ArrowUp /></button>
              <button className="icon-btn" disabled={idx === letter.paragraphs.length - 1} onClick={() => patch((l) => void ([l.paragraphs[idx + 1], l.paragraphs[idx]] = [l.paragraphs[idx], l.paragraphs[idx + 1]]))}><ArrowDown /></button>
              <button className="icon-btn" onClick={() => patch((l) => void l.paragraphs.splice(idx, 1))}><Trash2 /></button>
            </div>
            <p className="para-goal">{g.goal}</p>
            <Area value={p.text} onChange={(v) => patch((l) => void (l.paragraphs[idx].text = v))} rows={3} onFocus={() => setFocus(p.id)} />
            <div className="gauge-row">
              <div className="gauge">
                <span className={cx(wc < min * 0.6 ? 'low' : wc > max * 1.25 ? 'high' : 'fine')} style={{ width: `${Math.min(100, (wc / (max * 1.25)) * 100)}%` }} />
              </div>
              <span className="muted small">{wc} mots · {min} à {max} conseillés</span>
            </div>
            {open && (
              <div className="para-help">
                <ul>
                  {g.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {g.starters.length > 0 && (
                  <div className="chips-row">
                    {g.starters.map((s) => (
                      <button key={s} className="pill" title="Insérer cette amorce" onClick={() => patch((l) => void (l.paragraphs[idx].text = (l.paragraphs[idx].text ? l.paragraphs[idx].text + ' ' : '') + s))}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {adv.filter((a) => a.level !== 'ok').map((a) => (
              <div key={a.id} className={cx('check', a.level, 'tight')}>
                <LevelIcon level={a.level} />
                <div>
                  <b>{a.title}</b>
                  {a.detail && <p>{a.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <button className="btn small add" onClick={() => patch((l) => void l.paragraphs.push({ id: uid(), role: 'free', text: '' }))}>
        <Plus /> Ajouter un paragraphe
      </button>

      <details className="fold" open>
        <summary>Formule de politesse et signature</summary>
        <Area value={letter.closing} onChange={(v) => patch((l) => void (l.closing = v))} rows={2} />
        <div className="chips-row">
          {CLOSINGS[letter.lang].map((c) => (
            <button key={c} className="pill" onClick={() => patch((l) => void (l.closing = c))}>
              {c.length > 44 ? c.slice(0, 42) + '…' : c}
            </button>
          ))}
        </div>
        <Field label="Signature" value={letter.signature} onChange={(v) => patch((l) => void (l.signature = v))} />
        <div className="field">
          <span className="field-label">Signature manuscrite</span>
          <div className="row">
            <button className="btn small" onClick={() => sigFile.current?.click()}><Signature /> {letter.sig ? 'Changer l’image' : 'Importer une image (PNG)'}</button>
            {!letter.sig && profileSig && <button className="btn small" onClick={() => patch((l) => void (l.sig = { ...profileSig, w: 45, x: 0, y: 0 }))}>Reprendre celle du profil</button>}
            {letter.sig && <button className="btn small ghost" onClick={() => patch((l) => void (l.sig && Object.assign(l.sig, { x: 0, y: 0, w: 45 })))}>Replacer</button>}
            {letter.sig && <button className="btn small ghost danger-text" onClick={() => patch((l) => void delete l.sig)}>Retirer</button>}
          </div>
          {letter.sig && <Range label="Largeur" value={letter.sig.w} onChange={(v) => patch((l) => void (l.sig && (l.sig.w = v)))} min={12} max={110} unit=" mm" />}
          <span className="field-hint">{letter.sig ? 'Dans l’aperçu : faites glisser la signature pour la placer, tirez la poignée ou pincez pour la redimensionner.' : 'Un PNG à fond transparent donne le meilleur résultat. L’image est gardée dans votre profil pour les prochaines lettres.'}</span>
          <input
            ref={sigFile}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const img = await fileToSignature(f)
                patch((l) => void (l.sig = { ...img, w: l.sig?.w ?? 45, x: l.sig?.x ?? 0, y: l.sig?.y ?? 0 }))
                mutate((db) => void (db.profile.signatureImage = img))
              } catch {
                toast('Image illisible.', 'warn')
              }
            }}
          />
        </div>
      </details>
    </div>
  )

  const design = (
    <div className="design">
      <div className="panel-block">
        <h4>Assortir à un modèle de CV</h4>
        <Select
          value={letter.templateId}
          onChange={(v) => patch((l) => { l.templateId = v; l.design = { ...getTemplate(v).design, showPhoto: false, pageFormat: l.design.pageFormat } })}
          options={CV_TEMPLATES.map((t) => ({ value: t.id, label: `${t.name} · ${t.tagline}` }))}
        />
        {cvOfApp && (
          <button className="btn small" onClick={() => patch((l) => { l.templateId = cvOfApp.templateId; l.design = { ...cvOfApp.design, showPhoto: false } })}>
            Reprendre le design de « {cvOfApp.name} »
          </button>
        )}
      </div>
      <DesignControls design={letter.design} set={(p) => patch((l) => void Object.assign(l.design, p))} letter />
    </div>
  )

  const coach = (
    <div className="ats">
      <div className="score-card">
        <ScoreRing score={report.score} size={84} label="/100" />
        <div>
          <b>{report.score >= 80 ? 'Lettre solide' : report.score >= 55 ? 'Quelques points à revoir' : 'À retravailler'}</b>
          <p>{report.words} mots · {pages} page{pages > 1 ? 's' : ''}</p>
          <p className="muted small">Structure conseillée : accroche, ce que vous apportez, pourquoi cette entreprise, conclusion.</p>
        </div>
      </div>
      <div className="check-group">
        <h4>Conseils</h4>
        {report.advices.filter((a) => a.level !== 'ok').length === 0 && <p className="muted">Rien à signaler.</p>}
        {report.advices
          .filter((a) => a.level !== 'ok' || !a.paragraphId)
          .sort((a, b) => ['error', 'warn', 'info', 'ok'].indexOf(a.level) - ['error', 'warn', 'info', 'ok'].indexOf(b.level))
          .map((a) => (
            <div key={a.id} className={cx('check', a.level, a.paragraphId && 'link')} onClick={a.paragraphId ? () => { setTab('write'); setFocus(a.paragraphId!); setTimeout(() => document.getElementById(`para-${a.paragraphId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) } : undefined}>
              <LevelIcon level={a.level} />
              <div>
                <b>{a.title}</b>
                {a.detail && <p>{a.detail}</p>}
              </div>
            </div>
          ))}
      </div>
      <div className="check-group">
        <h4>Orthographe et grammaire</h4>
        <button className="btn" onClick={spell} disabled={checking}>
          <SpellCheck /> {checking ? 'Vérification…' : 'Vérifier la lettre'}
        </button>
        <p className="muted small">Service LanguageTool, gratuit. Le texte n’est envoyé que lorsque vous cliquez.</p>
        {issues?.map((i, n) => {
          const p = letter.paragraphs.find((x) => x.id === i.paragraphId)
          const ctx = p ? p.text.slice(Math.max(0, i.offset - 24), i.offset + i.length + 24) : ''
          return (
            <div key={n} className="spell">
              <p className="spell-ctx">
                …{ctx.slice(0, Math.min(24, i.offset))}
                <mark>{i.bad}</mark>
                {ctx.slice(Math.min(24, i.offset) + i.length)}…
              </p>
              <p className="muted small">{i.message}</p>
              <div className="chips-row">
                {i.replacements.map((r) => (
                  <button key={r} className="pill on" onClick={() => applyFix(i, r)}>
                    {r}
                  </button>
                ))}
                <button className="pill" onClick={() => setIssues((l) => (l ?? []).filter((x) => x !== i))}>Ignorer</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      <EditorShell
        appId={app.id}
        name={letter.name}
        onRename={(v) => patch((l) => void (l.name = v))}
        badge={
          <button className={`score-chip ${report.score >= 80 ? 'good' : report.score >= 55 ? 'mid' : 'bad'}`} onClick={() => setTab('coach')} title="Score de rédaction">
            <GraduationCap /> {report.score}
          </button>
        }
        tabs={[
          { id: 'write', label: 'Rédaction', icon: <PenLine /> },
          { id: 'design', label: 'Design', icon: <Palette /> },
          { id: 'coach', label: 'Coach', icon: <GraduationCap /> },
        ]}
        tab={tab}
        setTab={setTab}
        panel={tab === 'write' ? write : tab === 'design' ? design : coach}
        preview={
          <Preview pageWidthMm={letter.design.pageFormat === 'Letter' ? 215.9 : 210} footer={<span className={cx('pages', pages > 1 && 'bad')}>{pages} page{pages > 1 ? 's' : ''}</span>}>
            <LetterDocument letter={letter} edit patch={patch} onPages={setPages} onSelectParagraph={(id) => { setFocus(id); if (tab === 'write') document.getElementById(`para-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} />
          </Preview>
        }
        exports={[
          { label: 'PDF', hint: 'Identique à l’aperçu', run: () => printNode(<LetterDocument letter={letter} />, file, letter.design.pageFormat) },
          { label: 'Word (.docx)', hint: 'Modifiable dans Word', run: async () => downloadBlob(await letterToDocx(letter), `${file}.docx`) },
          { label: 'Texte brut (.txt)', hint: 'Pour un mail ou un formulaire', run: () => downloadBlob(new Blob([letterPlainText(letter)], { type: 'text/plain;charset=utf-8' }), `${file}.txt`) },
        ]}
      />
      {picker && (
        <LetterModelPicker
          lang={letter.lang}
          current={letter.modelId}
          onClose={() => setPicker(false)}
          onPick={async (m) => {
            setPicker(false)
            const hasText = letter.paragraphs.some((p) => p.text.trim())
            if (hasText && !(await confirmDialog({ title: 'Remplacer le texte ?', message: `Les paragraphes actuels sont remplacés par ceux du modèle « ${m.name} ».`, ok: 'Remplacer' }))) return
            const fill = (s: string) => s.replaceAll('[poste]', app.role || '[poste]').replaceAll('[entreprise]', app.company || '[entreprise]').replaceAll('[role]', app.role || '[role]').replaceAll('[company]', app.company || '[company]')
            patch((l) => {
              l.modelId = m.id
              l.lang = m.lang
              l.subject = fill(m.subject)
              l.paragraphs = m.paragraphs.map((p) => ({ id: uid(), role: p.role, text: fill(p.text) }))
            })
          }}
        />
      )}
    </>
  )
}
