import { useRef, useState } from 'react'
import { ArrowRight, FileUp, FolderLock, LayoutTemplate, ShieldCheck, Sparkles } from 'lucide-react'
import { mutate, useStore } from '../store'
import { StorageCard } from './SettingsPage'
import { importCvIntoProfile } from './ProfilePage'
import { go } from '../lib/router'

export const Onboarding = () => {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const hasData = useStore((s) => s.db.applications.length > 0 || s.db.profile.sections.length > 0)
  const finish = (to: string) => {
    mutate((db) => void (db.settings.onboarded = true))
    go(to)
  }
  return (
    <div className="onboarding">
      <div className="onb-card">
        <div className="onb-brand">
          <img src="./icon.svg" alt="" />
          <b>ConceptCV</b>
        </div>
        <div className="onb-dots">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {step === 0 && (
          <>
            <h1>Votre atelier de candidatures, rien qu’à vous.</h1>
            <p className="lead">Un dossier par entreprise, des CV et des lettres conçus pas à pas, vérifiés avant l’envoi.</p>
            <ul className="onb-points">
              <li><LayoutTemplate /><div><b>30 modèles de CV, 30 modèles de lettres</b><span>Tout se modifie : couleurs, polices, colonnes, ordre des rubriques.</span></div></li>
              <li><ShieldCheck /><div><b>Contrôle ATS et coach de rédaction</b><span>Score, mots-clés de l’offre, conseils paragraphe par paragraphe.</span></div></li>
              <li><FolderLock /><div><b>Aucun serveur, aucun compte</b><span>Vos données restent dans votre dossier iCloud et sur vos appareils.</span></div></li>
            </ul>
            <button className="btn primary big" onClick={() => setStep(1)}>Commencer <ArrowRight /></button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Où ranger vos données ?</h1>
            <p className="lead">Choisissez un dossier de votre iCloud Drive : il servira de base de données, et iCloud le synchronisera entre vos appareils.</p>
            <StorageCard compact />
            <div className="row end">
              <button className="btn ghost" onClick={() => setStep(0)}>Retour</button>
              <button className="btn primary" onClick={() => (hasData ? finish('/') : setStep(2))}>{hasData ? 'Ouvrir mes candidatures' : 'Continuer'} <ArrowRight /></button>
            </div>
            <p className="muted small">Vous pourrez changer ce choix à tout moment dans les réglages. Sans dossier, tout reste stocké dans ce navigateur.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Partons de votre CV actuel.</h1>
            <p className="lead">Déposez un CV en PDF : l’outil en tire vos coordonnées, expériences, formations et compétences. Le fichier est lu sur votre appareil, il n’est envoyé nulle part.</p>
            <button className="drop" disabled={busy} onClick={() => file.current?.click()}>
              <FileUp />
              <b>{busy ? 'Lecture du PDF…' : 'Choisir un CV en PDF'}</b>
              <span>Vous relirez et corrigerez le résultat juste après.</span>
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
                const ok = await importCvIntoProfile(f)
                setBusy(false)
                if (ok) finish('/profil')
              }}
            />
            <div className="row end">
              <button className="btn ghost" onClick={() => setStep(1)}>Retour</button>
              <button className="btn" onClick={() => finish('/profil')}><Sparkles /> Remplir mon profil à la main</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
