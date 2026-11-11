import { useMemo, useState } from 'react'
import { BellRing, CalendarPlus, Copy, FileDown, Lock, Mail, Send } from 'lucide-react'
import type { Application, CvDoc, LetterDoc, Submission } from '../types'
import { mutate, toast, updateApp, updateDoc, useStore } from '../store'
import { preflight } from '../analysis/preflight'
import { addDays, applicationMail, followUpIcs, followUpMail, mailto, type Mail as MailText } from '../lib/kit'
import { clone, downloadBlob, fullName, nowIso, shortDate, slug, uid } from '../lib/util'
import { printNode } from '../export/print'
import { CvDocument } from '../render/CvDocument'
import { LetterDocument } from '../render/LetterDocument'
import { cvFileName } from '../editor/CvEditor'
import { LevelIcon } from '../editor/AtsPanel'
import { Area, Field, Select, cx } from '../ui/kit'
import { confirmDialog } from '../ui/dialog'
import { go } from '../lib/router'

const today = () => new Date().toISOString().slice(0, 10)

const MailBox = ({ title, mail, to }: { title: string; mail: MailText; to: string }) => {
  const [m, setM] = useState(mail)
  const [seed, setSeed] = useState(mail)
  if (seed.subject !== mail.subject || seed.body !== mail.body) {
    setSeed(mail)
    setM(mail)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${m.subject}\n\n${m.body}`)
      toast('Mail copié.', 'ok')
    } catch {
      toast('Copie impossible : sélectionnez le texte à la main.', 'warn')
    }
  }
  return (
    <div className="mailbox">
      <h4>{title}</h4>
      <Field label="Objet" value={m.subject} onChange={(v) => setM({ ...m, subject: v })} />
      <Area label="Message" rows={6} value={m.body} onChange={(v) => setM({ ...m, body: v })} />
      <div className="row">
        <a className="btn small primary" href={mailto(to, m)}><Mail /> Ouvrir dans ma messagerie</a>
        <button className="btn small" onClick={() => void copy()}><Copy /> Copier</button>
      </div>
      <p className="muted small">Le mail s’ouvre sans pièces jointes : ajoutez les PDF exportés ci-dessus.</p>
    </div>
  )
}

export const SendTab = ({ app }: { app: Application }) => {
  const apps = useStore((s) => s.db.applications)
  const cvs = app.docs.filter((d): d is CvDoc => d.kind === 'cv')
  const letters = app.docs.filter((d): d is LetterDoc => d.kind === 'letter')
  const [cvId, setCvId] = useState(cvs[0]?.id ?? '')
  const [letterId, setLetterId] = useState(letters[0]?.id ?? '')
  const cv = cvs.find((c) => c.id === cvId)
  const letter = letters.find((l) => l.id === letterId)
  const others = useMemo(() => apps.filter((a) => a.id !== app.id), [apps, app.id])
  const checks = useMemo(() => preflight(app, others, cv, letter), [app, others, cv, letter])
  const basics = cv?.basics ?? letter?.sender ?? useStore.getState().db.profile.basics
  const lang = cv?.lang ?? letter?.lang ?? 'fr'
  const subs = app.submissions ?? []
  const blocking = checks.filter((c) => c.level === 'error').length
  const letterFile = letter ? slug(['Lettre', fullName(letter.sender), app.company].filter(Boolean).join(' ')) : ''

  const send = async () => {
    if (!cv) return
    if (blocking && !(await confirmDialog({ title: 'Des points bloquants subsistent', message: `${blocking} erreur(s) signalée(s) par le contrôle. Enregistrer l’envoi quand même ?`, ok: 'Enregistrer quand même', danger: true }))) return
    const sub: Submission = { id: uid(), date: today(), note: '', cv: clone(cv), ...(letter ? { letter: clone(letter) } : {}) }
    mutate((db) => {
      const a = db.applications.find((x) => x.id === app.id)
      if (!a) return
      a.submissions = [sub, ...(a.submissions ?? [])]
      a.status = a.status === 'draft' || a.status === 'ready' ? 'sent' : a.status
      a.appliedAt = a.appliedAt || sub.date
      if (!a.followUpAt) a.followUpAt = addDays(sub.date, 12)
      a.timeline.unshift({ id: uid(), date: sub.date, text: `Candidature envoyée (version ${a.submissions.length}) : ${cv.name}${letter ? ` + ${letter.name}` : ''}` })
      a.updatedAt = nowIso()
    })
    toast('Envoi enregistré. Les documents envoyés sont figés, vous pouvez continuer à modifier les originaux.', 'ok')
  }
  const followed = () => {
    updateApp(app.id, (a) => {
      a.followUps = [...(a.followUps ?? []), today()]
      a.timeline.unshift({ id: uid(), date: today(), text: `Relance n° ${a.followUps.length} envoyée` })
      a.followUpAt = addDays(today(), 10)
    })
    toast('Relance notée. Prochain rappel dans 10 jours.', 'ok')
  }

  return (
    <div className="cards-2">
      <div>
        <div className="card">
          <h3>1. Les documents de cet envoi</h3>
          <div className="form-grid">
            <Select half label="CV" value={cvId} onChange={setCvId} options={cvs.length ? cvs.map((c) => ({ value: c.id, label: c.name })) : [{ value: '', label: 'Aucun CV dans ce dossier' }]} />
            <Select half label="Lettre" value={letterId} onChange={setLetterId} options={[...letters.map((l) => ({ value: l.id, label: l.name })), { value: '', label: 'Sans lettre' }]} />
          </div>
          <div className="row">
            {cv && <button className="btn small" onClick={() => void printNode(<CvDocument cv={cv} />, cvFileName(cv, app), cv.design.pageFormat)}><FileDown /> {cvFileName(cv, app)}.pdf</button>}
            {letter && <button className="btn small" onClick={() => void printNode(<LetterDocument letter={letter} />, letterFile, letter.design.pageFormat)}><FileDown /> {letterFile}.pdf</button>}
          </div>
        </div>
        <div className="card">
          <h3>2. Contrôle avant envoi</h3>
          {checks.map((c) => (
            <div key={c.id} className={cx('check', c.level)}>
              <LevelIcon level={c.level} />
              <div>
                <b>{c.title}</b>
                {c.detail && <p>{c.detail}</p>}
                {c.fix && letter && (
                  <button className="btn small fix" onClick={() => updateDoc<LetterDoc>(app.id, letter.id, (l) => c.fix!.apply(cv, l))}>
                    {c.fix.label}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="row">
            {cv && <button className="btn small ghost" onClick={() => go(`/app/${app.id}/doc/${cv.id}`)}>Ouvrir le CV</button>}
            {letter && <button className="btn small ghost" onClick={() => go(`/app/${app.id}/doc/${letter.id}`)}>Ouvrir la lettre</button>}
          </div>
        </div>
        <div className="card">
          <h3>3. Envoyer</h3>
          <MailBox title="Mail d’accompagnement" mail={applicationMail(app, basics, lang, !!letter)} to={app.contactEmail} />
          <button className="btn primary" disabled={!cv} onClick={() => void send()}>
            <Send /> J’ai envoyé cette candidature
          </button>
          <p className="muted small">Une copie du CV et de la lettre est figée à cet instant. Si vous renvoyez une version corrigée plus tard, enregistrez un nouvel envoi : l’historique garde chaque version.</p>
        </div>
      </div>
      <div>
        <div className="card">
          <h3><Lock /> Versions envoyées</h3>
          {!subs.length && <p className="muted">Aucun envoi enregistré pour l’instant.</p>}
          {subs.map((s, i) => (
            <div key={s.id} className="submission">
              <div className="submission-head">
                <b>Version {subs.length - i}</b>
                <span className="muted small">{shortDate(s.date)}</span>
              </div>
              <div className="row">
                {s.cv && <button className="btn small" onClick={() => go(`/app/${app.id}/envoi/${s.id}/cv`)}>Voir le CV envoyé</button>}
                {s.letter && <button className="btn small" onClick={() => go(`/app/${app.id}/envoi/${s.id}/lettre`)}>Voir la lettre envoyée</button>}
              </div>
              <input className="input" value={s.note} placeholder="Note : canal, interlocuteur, référence…" onChange={(e) => updateApp(app.id, (a) => void (a.submissions!.find((x) => x.id === s.id)!.note = e.target.value))} />
            </div>
          ))}
        </div>
        <div className="card">
          <h3><BellRing /> Relance</h3>
          <div className="form-grid">
            <Field half label="Envoyée le" type="date" value={app.appliedAt} onChange={(v) => updateApp(app.id, (a) => void (a.appliedAt = v))} />
            <Field half label="Relancer le" type="date" value={app.followUpAt} onChange={(v) => updateApp(app.id, (a) => void (a.followUpAt = v))} />
          </div>
          <div className="row">
            <button className="btn small" disabled={!app.followUpAt} onClick={() => downloadBlob(new Blob([followUpIcs(app)], { type: 'text/calendar;charset=utf-8' }), `Relance_${slug(app.company) || 'candidature'}.ics`)}>
              <CalendarPlus /> Ajouter au calendrier
            </button>
            <span className="muted small">{(app.followUps ?? []).length ? `${app.followUps!.length} relance(s) faite(s), dernière le ${shortDate(app.followUps![app.followUps!.length - 1])}` : 'Aucune relance faite'}</span>
          </div>
          <MailBox title="Mail de relance" mail={followUpMail(app, basics, lang)} to={app.contactEmail} />
          <button className="btn" onClick={followed}><Send /> J’ai relancé</button>
        </div>
      </div>
    </div>
  )
}
