import type { DB } from '../types'
import { useStore, toast } from '../store'
import { idbDel, idbGet, idbSet } from './idb'
import { debounce, downloadBlob } from '../lib/util'
import { confirmDialog } from '../ui/dialog'

export const DB_FILE = 'ConceptCV.json'
const BACKUP_DIR = 'Sauvegardes'

export const folderSupported = (): boolean => typeof window.showDirectoryPicker === 'function'

let dir: FileSystemDirectoryHandle | null = null
let knownModified = 0
let backedUpDay = ''
let writing = false

const isDb = (v: unknown): v is DB =>
  !!v && typeof v === 'object' && (v as DB).app === 'ConceptCV' && Array.isArray((v as DB).applications)

export const parseDb = (text: string): DB => {
  const v: unknown = JSON.parse(text)
  if (!isDb(v)) throw new Error("Ce fichier n'est pas une base ConceptCV.")
  return v
}

const hasContent = (db: DB): boolean =>
  db.applications.length > 0 || db.profile.sections.length > 0 || !!db.profile.basics.lastName

const readFolder = async (): Promise<DB | null> => {
  if (!dir) return null
  try {
    const fh = await dir.getFileHandle(DB_FILE)
    const file = await fh.getFile()
    knownModified = file.lastModified
    const text = await file.text()
    return text.trim() ? parseDb(text) : null
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return null
    throw e
  }
}

const writeFolder = async (db: DB) => {
  if (!dir) return
  writing = true
  const st = useStore.getState()
  st.set({ syncStatus: 'saving' })
  try {
    const json = JSON.stringify(db)
    const fh = await dir.getFileHandle(DB_FILE, { create: true })
    const w = await fh.createWritable()
    await w.write(json)
    await w.close()
    knownModified = (await fh.getFile()).lastModified
    // Une copie de sécurité par jour, dans un sous-dossier.
    const day = new Date().toISOString().slice(0, 10)
    if (backedUpDay !== day) {
      const b = await dir.getDirectoryHandle(BACKUP_DIR, { create: true })
      const bf = await b.getFileHandle(`ConceptCV_${day}.json`, { create: true })
      const bw = await bf.createWritable()
      await bw.write(json)
      await bw.close()
      backedUpDay = day
    }
    useStore.getState().set({ syncStatus: 'saved', lastSavedAt: new Date().toISOString() })
  } catch (e) {
    console.error(e)
    useStore.getState().set({ syncStatus: 'error' })
  } finally {
    writing = false
  }
}

const persist = debounce((db: DB) => {
  idbSet('db', db).catch(console.error)
  if (dir) void writeFolder(db)
}, 500)

/** Charge la base du dossier si elle est plus récente ; sinon y écrit la base locale. */
const reconcile = async (askOnConflict: boolean) => {
  const st = useStore.getState()
  const remote = await readFolder()
  const local = st.db
  if (!remote) {
    await writeFolder(local)
    return
  }
  if (remote.updatedAt === local.updatedAt) {
    st.set({ syncStatus: 'saved', lastSavedAt: remote.updatedAt })
    return
  }
  let takeRemote = remote.updatedAt > local.updatedAt || !hasContent(local)
  if (askOnConflict && hasContent(local) && hasContent(remote)) {
    takeRemote = await confirmDialog({
      title: 'Deux versions de vos données',
      message: `Le dossier contient une base (${remote.applications.length} candidature(s), modifiée le ${new Date(remote.updatedAt).toLocaleString('fr-FR')}). Cet appareil en contient une autre (${local.applications.length} candidature(s), modifiée le ${new Date(local.updatedAt).toLocaleString('fr-FR')}).`,
      ok: 'Charger celle du dossier',
      cancel: 'Garder celle de cet appareil',
    })
  }
  if (takeRemote) {
    st.replaceDb(remote)
    await idbSet('db', remote)
    st.set({ syncStatus: 'saved', lastSavedAt: remote.updatedAt })
  } else {
    await writeFolder(local)
  }
}

export const connectFolder = async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'conceptcv' })
    dir = handle
    await idbSet('dir', handle)
    useStore.getState().set({ folderName: handle.name || 'dossier' })
    await reconcile(true)
    toast(`Dossier « ${handle.name || 'dossier'} » connecté. Tout y est enregistré automatiquement.`, 'ok')
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') {
      console.error(e)
      toast("Impossible d'ouvrir ce dossier.", 'warn')
    }
  }
}

export const reconnectFolder = async () => {
  const handle = await idbGet<FileSystemDirectoryHandle>('dir')
  if (!handle) return
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return
  dir = handle
  await reconcile(true)
}

export const disconnectFolder = async () => {
  dir = null
  await idbDel('dir')
  useStore.getState().set({ folderName: '', syncStatus: 'local' })
}

/** Autre appareil (iCloud) : on recharge si le fichier a changé sous nos pieds. */
const poll = async () => {
  if (!dir || writing || document.hidden) return
  try {
    const fh = await dir.getFileHandle(DB_FILE)
    const file = await fh.getFile()
    if (file.lastModified === knownModified) return
    knownModified = file.lastModified
    const remote = parseDb(await file.text())
    const st = useStore.getState()
    if (remote.updatedAt > st.db.updatedAt) {
      st.replaceDb(remote)
      await idbSet('db', remote)
      st.set({ syncStatus: 'saved', lastSavedAt: remote.updatedAt })
      toast('Données mises à jour depuis iCloud.', 'ok')
    }
  } catch {
    /* fichier en cours de synchronisation : on réessaiera */
  }
}

export const initPersistence = async () => {
  const st = useStore.getState()
  try {
    const local = await idbGet<DB>('db')
    if (local && isDb(local)) st.replaceDb(local)
    const handle = await idbGet<FileSystemDirectoryHandle>('dir')
    if (handle && folderSupported()) {
      st.set({ folderName: handle.name || 'dossier' })
      const perm = await handle.queryPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        dir = handle
        await reconcile(false)
      } else {
        st.set({ syncStatus: 'needs-permission' })
      }
    }
  } catch (e) {
    console.error(e)
  }
  st.set({ ready: true })
  let lastRev = useStore.getState().db.rev
  useStore.subscribe((s) => {
    if (s.db.rev !== lastRev) {
      lastRev = s.db.rev
      persist(s.db)
    }
  })
  setInterval(poll, 4000)
  document.addEventListener('visibilitychange', () => void poll())
  window.addEventListener('pagehide', () => persist.flush(useStore.getState().db))
}

/* ───────── Mode fichier (iPhone, Safari, Firefox) ───────── */

export const openDbFile = async (file: File) => {
  const st = useStore.getState()
  let remote: DB
  try {
    remote = parseDb(await file.text())
  } catch (e) {
    toast((e as Error).message || 'Fichier illisible.', 'warn')
    return
  }
  const local = st.db
  if (hasContent(local) && local.updatedAt > remote.updatedAt && local.rev !== st.exportedRev) {
    const ok = await confirmDialog({
      title: 'Ce fichier est plus ancien',
      message: 'Cet appareil contient des modifications plus récentes que le fichier choisi. Les remplacer ?',
      ok: 'Remplacer par le fichier',
      cancel: 'Annuler',
    })
    if (!ok) return
  }
  st.replaceDb(remote)
  await idbSet('db', remote)
  localStorage.setItem('ccv-exported-rev', String(remote.rev))
  st.set({ exportedRev: remote.rev })
  toast(`Base chargée : ${remote.applications.length} candidature(s).`, 'ok')
}

export const exportDbFile = async () => {
  const st = useStore.getState()
  const file = new File([JSON.stringify(st.db)], DB_FILE, { type: 'application/json' })
  const done = () => {
    localStorage.setItem('ccv-exported-rev', String(st.db.rev))
    st.set({ exportedRev: st.db.rev })
  }
  // Sur iPhone, la feuille de partage propose « Enregistrer dans Fichiers » (iCloud Drive).
  const touch = matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      done()
    } catch {
      /* partage annulé */
    }
    return
  }
  downloadBlob(file, DB_FILE)
  done()
}
