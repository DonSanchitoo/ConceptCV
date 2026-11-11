import { useEffect } from 'react'
import { AlertTriangle, Briefcase, Check, CloudUpload, FolderSync, HardDrive, Loader2, Settings, UserRound } from 'lucide-react'
import { useStore } from './store'
import { go, useRoute } from './lib/router'
import { exportDbFile, folderSupported, reconnectFolder } from './storage/sync'
import { Dashboard } from './pages/Dashboard'
import { ApplicationPage } from './pages/ApplicationPage'
import { DocPage } from './pages/DocPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { Onboarding } from './pages/Onboarding'
import { DialogHost } from './ui/dialog'
import { Empty, cx } from './ui/kit'

const SyncPill = () => {
  const { syncStatus, folderName, exportedRev } = useStore()
  const rev = useStore((s) => s.db.rev)
  if (syncStatus === 'needs-permission')
    return (
      <button className="sync warn" onClick={() => void reconnectFolder()} title="Le navigateur redemande l’accès au dossier">
        <AlertTriangle /> <span>Reconnecter « {folderName} »</span>
      </button>
    )
  if (folderName)
    return (
      <button className={cx('sync', syncStatus === 'error' ? 'warn' : 'ok')} onClick={() => go('/reglages')}>
        {syncStatus === 'saving' ? <Loader2 className="spin" /> : syncStatus === 'error' ? <AlertTriangle /> : <FolderSync />}
        <span>{syncStatus === 'saving' ? 'Enregistrement…' : syncStatus === 'error' ? 'Écriture impossible' : `Enregistré dans ${folderName}`}</span>
      </button>
    )
  if (folderSupported())
    return (
      <button className="sync warn" onClick={() => go('/reglages')} title="Sans dossier, les données restent dans ce navigateur">
        <FolderSync /> <span>Connecter un dossier iCloud</span>
      </button>
    )
  if (rev > 0 && exportedRev !== rev)
    return (
      <button className="sync warn" onClick={() => void exportDbFile()} title="Enregistrer le fichier dans iCloud">
        <CloudUpload /> <span>Enregistrer dans iCloud</span>
      </button>
    )
  return (
    <button className="sync" onClick={() => go('/reglages')}>
      {rev > 0 ? <Check /> : <HardDrive />} <span>{rev > 0 ? 'Fichier iCloud à jour' : 'Stocké sur cet appareil'}</span>
    </button>
  )
}

const NAV = [
  { path: '/', label: 'Candidatures', icon: <Briefcase />, match: (r: string[]) => r.length === 0 || r[0] === 'app' },
  { path: '/profil', label: 'Profil', icon: <UserRound />, match: (r: string[]) => r[0] === 'profil' },
  { path: '/reglages', label: 'Réglages', icon: <Settings />, match: (r: string[]) => r[0] === 'reglages' },
]

export const App = () => {
  const route = useRoute()
  const ready = useStore((s) => s.ready)
  const settings = useStore((s) => s.db.settings)
  const apps = useStore((s) => s.db.applications)
  const toasts = useStore((s) => s.toasts)

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => (document.documentElement.dataset.theme = settings.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : settings.theme)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      e.preventDefault()
      if (e.shiftKey) useStore.getState().redo()
      else useStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!ready) return <div className="boot"><Loader2 className="spin" /></div>

  const app = route[0] === 'app' ? apps.find((a) => a.id === route[1]) : undefined
  const inEditor = !!app && route[2] === 'doc'
  let content
  if (!settings.onboarded) content = <Onboarding />
  else if (inEditor) content = <DocPage app={app} docId={route[3]} />
  else {
    const page =
      route[0] === 'app' ? (
        app ? <ApplicationPage app={app} /> : <Empty icon={<Briefcase />} title="Dossier introuvable" text="Il a peut-être été supprimé sur un autre appareil." action={<button className="btn primary" onClick={() => go('/')}>Voir mes candidatures</button>} />
      ) : route[0] === 'profil' ? (
        <ProfilePage />
      ) : route[0] === 'reglages' ? (
        <SettingsPage />
      ) : (
        <Dashboard />
      )
    content = (
      <div className="shell">
        <aside className="nav">
          <button className="brand" onClick={() => go('/')}>
            <img src="./icon.svg" alt="" />
            <b>ConceptCV</b>
          </button>
          <nav>
            {NAV.map((n) => (
              <button key={n.path} className={cx(n.match(route) && 'on')} onClick={() => go(n.path)}>
                {n.icon}
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <SyncPill />
        </aside>
        <main className="content">{page}</main>
      </div>
    )
  }
  return (
    <>
      {content}
      <DialogHost />
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  )
}
