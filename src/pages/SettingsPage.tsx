import { useRef } from 'react'
import { CloudUpload, FolderOpen, FolderSync, HardDriveDownload, ShieldCheck, Trash2, Unplug } from 'lucide-react'
import { mutate, toast, useStore } from '../store'
import { connectFolder, disconnectFolder, exportDbFile, folderSupported, openDbFile, reconnectFolder, DB_FILE } from '../storage/sync'
import { emptyDb } from '../lib/factory'
import { downloadBlob } from '../lib/util'
import { idbSet } from '../storage/idb'
import { confirmDialog } from '../ui/dialog'
import { Segmented, Toggle } from '../ui/kit'

declare const __APP_VERSION__: string

export const StorageCard = ({ compact }: { compact?: boolean }) => {
  const { syncStatus, folderName, lastSavedAt } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const connected = !!folderName && syncStatus !== 'needs-permission'
  return (
    <div className="storage">
      {folderSupported() ? (
        <div className="storage-mode">
          <div className="storage-icon"><FolderSync /></div>
          <div>
            <b>Dossier synchronisé {connected && <span className="badge ok">actif</span>}</b>
            <p className="muted">
              {connected
                ? `Tout est enregistré automatiquement dans « ${folderName} » : la base complète (${DB_FILE}) et un fichier par projet dans le sous-dossier Projets${lastSavedAt ? `, dernière écriture à ${new Date(lastSavedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}. Une copie de sécurité par jour est gardée dans le sous-dossier Sauvegardes.`
                : 'Choisissez un dossier de votre iCloud Drive. Chaque modification y est écrite aussitôt, et iCloud la propage à vos autres appareils.'}
            </p>
            <div className="row">
              {syncStatus === 'needs-permission' ? (
                <button className="btn primary" onClick={() => void reconnectFolder()}><FolderOpen /> Reconnecter « {folderName} »</button>
              ) : (
                <button className="btn primary" onClick={() => void connectFolder()}><FolderOpen /> {connected ? 'Changer de dossier' : 'Choisir le dossier'}</button>
              )}
              {folderName && <button className="btn ghost" onClick={() => void disconnectFolder()}><Unplug /> Déconnecter</button>}
            </div>
          </div>
        </div>
      ) : (
        <div className="storage-mode">
          <div className="storage-icon"><CloudUpload /></div>
          <div>
            <b>Fichier iCloud</b>
            <p className="muted">
              Ce navigateur ne peut pas se brancher sur un dossier (c’est le cas sur iPhone et dans Safari). Importez un projet à la fois depuis le sous-dossier <code>Projets</code> de votre dossier iCloud, travaillez dessus, puis enregistrez-le au même endroit avec le bouton « Enregistrer le projet ». Votre ordinateur le récupère tout seul. Vous pouvez aussi ouvrir la base complète <code>{DB_FILE}</code>.
            </p>
          </div>
        </div>
      )}
      <div className="storage-mode">
        <div className="storage-icon"><HardDriveDownload /></div>
        <div>
          {!compact && <b>Ouvrir ou enregistrer un fichier à la main</b>}
          <div className="row">
            <button className="btn" onClick={() => file.current?.click()}><FolderOpen /> Importer un projet ou la base</button>
            <button className="btn" onClick={() => void exportDbFile()}><CloudUpload /> Enregistrer la base complète</button>
          </div>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void openDbFile(f) }} />
        </div>
      </div>
    </div>
  )
}

export const SettingsPage = () => {
  const settings = useStore((s) => s.db.settings)
  const db = useStore((s) => s.db)
  const reset = async () => {
    if (!(await confirmDialog({ title: 'Tout effacer sur cet appareil ?', message: 'Les données stockées dans ce navigateur sont supprimées. Le fichier de votre dossier iCloud n’est pas touché si vous déconnectez le dossier avant.', ok: 'Tout effacer', danger: true }))) return
    await disconnectFolder()
    const fresh = emptyDb()
    fresh.settings.onboarded = true
    useStore.getState().replaceDb(fresh)
    await idbSet('db', fresh)
    toast('Données locales effacées.', 'ok')
  }
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Réglages</h1>
          <p className="muted">Où vivent vos données, et comment l’application se comporte.</p>
        </div>
      </header>
      <div className="card">
        <h3>Stockage et synchronisation</h3>
        <StorageCard />
      </div>
      <div className="card">
        <h3><ShieldCheck /> Confidentialité</h3>
        <p className="muted">
          ConceptCV n’a ni serveur ni compte. Vos CV, lettres et notes restent dans ce navigateur et dans le dossier que vous choisissez. La seule sortie possible est le correcteur orthographique, qui envoie le texte vérifié à LanguageTool quand vous le demandez.
        </p>
        <Toggle label="Autoriser le correcteur LanguageTool sans redemander" checked={settings.spellcheckConsent} onChange={(v) => mutate((d) => void (d.settings.spellcheckConsent = v))} />
      </div>
      <div className="card">
        <h3>Préférences</h3>
        <Segmented label="Apparence" value={settings.theme} onChange={(v) => mutate((d) => void (d.settings.theme = v))} options={[{ value: 'auto', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />
        <Toggle label="Assistant « Adapter à l’offre » dans l’éditeur de CV" checked={settings.assistant !== false} onChange={(v) => mutate((d) => void (d.settings.assistant = v))} />
        <Segmented label="Langue par défaut des documents" value={settings.defaultLang} onChange={(v) => mutate((d) => void (d.settings.defaultLang = v))} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'Anglais' }]} />
      </div>
      <div className="card">
        <h3>Données</h3>
        <p className="muted">{db.applications.length} candidature(s), {db.applications.reduce((n, a) => n + a.docs.length, 0)} document(s). Révision {db.rev}.</p>
        <div className="row">
          <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }), `ConceptCV_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`)}><HardDriveDownload /> Télécharger une sauvegarde</button>
          <button className="btn ghost danger-text" onClick={() => void reset()}><Trash2 /> Effacer les données de cet appareil</button>
        </div>
      </div>
      <p className="muted small center">ConceptCV {__APP_VERSION__}</p>
    </div>
  )
}
