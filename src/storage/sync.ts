import type { Application, DB, ProjectFile } from '../types'
import { useStore, toast } from '../store'
import { idbDel, idbGet, idbSet } from './idb'
import { debounce, downloadBlob, nowIso, slug } from '../lib/util'
import { confirmDialog } from '../ui/dialog'

export const DB_FILE = 'ConceptCV.json'
const BACKUP_DIR = 'Sauvegardes'
export const PROJECT_DIR = 'Projets'

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

const isProject = (v: unknown): v is ProjectFile =>
  !!v && typeof v === 'object' && (v as ProjectFile).app === 'ConceptCV' && (v as ProjectFile).type === 'project' && !!(v as ProjectFile).application?.id

export const projectFileName = (a: Application): string => `${slug(a.company) || 'Projet'}_${a.id}.json`

const projectFile = (a: Application, db: DB): ProjectFile => ({ app: 'ConceptCV', type: 'project', schema: 1, exportedAt: nowIso(), application: a, profile: db.profile })

/** Intègre un dossier reçu d'un fichier : ajouté s'il est nouveau, remplacé s'il est plus récent. */
const mergeProject = (pf: ProjectFile): 'added' | 'updated' | 'older' | 'same' => {
  const st = useStore.getState()
  const local = st.db.applications.find((a) => a.id === pf.application.id)
  if (local && local.updatedAt === pf.application.updatedAt) return 'same'
  if (local && local.updatedAt > pf.application.updatedAt) return 'older'
  st.mutate((db) => {
    const i = db.applications.findIndex((a) => a.id === pf.application.id)
    if (i >= 0) db.applications[i] = pf.application
    else db.applications.unshift(pf.application)
    if (db.deleted) delete db.deleted[pf.application.id]
    // Sur un appareil vide, le profil joint au projet sert de base.
    if (!db.profile.sections.length && !db.profile.basics.lastName && pf.profile) db.profile = pf.profile
    db.settings.onboarded = true
  })
  return local ? 'updated' : 'added'
}

/* État des fichiers de projet du dossier : ce qu'on a écrit, et ce qu'on a déjà lu. */
const written = new Map<string, { updatedAt: string; name: string }>()
const seen = new Map<string, number>()

const writeProjects = async (db: DB) => {
  if (!dir) return
  const pd = await dir.getDirectoryHandle(PROJECT_DIR, { create: true })
  for (const a of db.applications) {
    const name = projectFileName(a)
    const w = written.get(a.id)
    if (w && w.updatedAt === a.updatedAt && w.name === name) continue
    const fh = await pd.getFileHandle(name, { create: true })
    const out = await fh.createWritable()
    await out.write(JSON.stringify(projectFile(a, db)))
    await out.close()
    seen.set(name, (await fh.getFile()).lastModified)
    if (w && w.name !== name) await pd.removeEntry(w.name).catch(() => {})
    written.set(a.id, { updatedAt: a.updatedAt, name })
  }
  for (const [id, w] of [...written]) {
    if (db.applications.some((a) => a.id === id)) continue
    await pd.removeEntry(w.name).catch(() => {})
    written.delete(id)
    seen.delete(w.name)
  }
}

/** Lit les fichiers de projet modifiés ailleurs (téléphone) et les fusionne. Renvoie le nombre de dossiers mis à jour. */
const scanProjects = async (): Promise<number> => {
  if (!dir) return 0
  let pd: FileSystemDirectoryHandle
  try {
    pd = await dir.getDirectoryHandle(PROJECT_DIR)
  } catch {
    return 0
  }
  let changed = 0
  for await (const [name, h] of pd.entries()) {
    if (h.kind !== 'file' || !name.endsWith('.json')) continue
    try {
      const file = await (h as FileSystemFileHandle).getFile()
      if (seen.get(name) === file.lastModified) continue
      seen.set(name, file.lastModified)
      const pf: unknown = JSON.parse(await file.text())
      if (!isProject(pf)) continue
      const id = pf.application.id
      const db = useStore.getState().db
      const gone = db.deleted?.[id]
      if (gone && gone >= pf.application.updatedAt) {
        await pd.removeEntry(name).catch(() => {})
        seen.delete(name)
        continue
      }
      const r = mergeProject(pf)
      if (r === 'added' || r === 'updated') changed++
      const cur = useStore.getState().db.applications.find((a) => a.id === id)!
      const canonical = projectFileName(cur)
      if (name !== canonical) {
        // Ancien nom (entreprise renommée) ou doublon : le fichier au bon nom sera réécrit.
        await pd.removeEntry(name).catch(() => {})
        seen.delete(name)
        written.delete(id)
      } else if (r === 'older') written.delete(id)
      else written.set(id, { updatedAt: cur.updatedAt, name })
    } catch {
      seen.delete(name) // fichier en cours de synchronisation : on réessaiera
    }
  }
  return changed
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
    await writeProjects(db)
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
    written.clear()
    seen.clear()
    await idbSet('dir', handle)
    useStore.getState().set({ folderName: handle.name || 'dossier' })
    await reconcile(true)
    await scanProjects()
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
  await scanProjects()
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
    if (file.lastModified !== knownModified) {
      knownModified = file.lastModified
      const remote = parseDb(await file.text())
      const st = useStore.getState()
      if (remote.updatedAt > st.db.updatedAt) {
        st.replaceDb(remote)
        await idbSet('db', remote)
        st.set({ syncStatus: 'saved', lastSavedAt: remote.updatedAt })
        toast('Données mises à jour depuis iCloud.', 'ok')
      }
    }
  } catch {
    /* fichier en cours de synchronisation : on réessaiera */
  }
  try {
    const n = await scanProjects()
    if (n) toast(n === 1 ? 'Un projet mis à jour depuis iCloud.' : `${n} projets mis à jour depuis iCloud.`, 'ok')
  } catch {
    /* idem */
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
        await scanProjects()
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
    const raw: unknown = JSON.parse(await file.text())
    if (isProject(raw)) {
      const r = mergeProject(raw)
      const a = raw.application
      if (r === 'older') {
        toast(`« ${a.company} » : la version de cet appareil est plus récente, rien n'a été remplacé.`, 'warn')
        return
      }
      markProjectSaved(a)
      toast(r === 'same' ? `« ${a.company} » est déjà à jour.` : `Projet « ${a.company} » chargé : ${a.docs.length} document(s).`, 'ok')
      location.hash = `/app/${a.id}`
      return
    }
    if (!isDb(raw)) throw new Error("Ce fichier n'est pas un fichier ConceptCV.")
    remote = raw
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
  const all = Object.fromEntries(remote.applications.map((a) => [a.id, a.updatedAt]))
  localStorage.setItem('ccv-exported-apps', JSON.stringify(all))
  st.set({ exportedRev: remote.rev, exportedApps: all })
  toast(`Base chargée : ${remote.applications.length} candidature(s).`, 'ok')
}

const markProjectSaved = (a: Application) => {
  const map = { ...useStore.getState().exportedApps, [a.id]: a.updatedAt }
  localStorage.setItem('ccv-exported-apps', JSON.stringify(map))
  useStore.getState().set({ exportedApps: map })
}

/** Remet un fichier à l'utilisateur : feuille de partage sur mobile (« Enregistrer dans Fichiers »), téléchargement sinon. */
const handOver = async (file: File, done: () => void) => {
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
  downloadBlob(file, file.name)
  done()
}

/** Enregistre un seul projet : à déposer dans le sous-dossier Projets du dossier iCloud. */
export const exportProjectFile = (a: Application) =>
  handOver(new File([JSON.stringify(projectFile(a, useStore.getState().db))], projectFileName(a), { type: 'application/json' }), () => markProjectSaved(a))

export const exportDbFile = async () => {
  const st = useStore.getState()
  const file = new File([JSON.stringify(st.db)], DB_FILE, { type: 'application/json' })
  const done = () => {
    localStorage.setItem('ccv-exported-rev', String(st.db.rev))
    const all = Object.fromEntries(st.db.applications.map((a) => [a.id, a.updatedAt]))
    localStorage.setItem('ccv-exported-apps', JSON.stringify(all))
    st.set({ exportedRev: st.db.rev, exportedApps: all })
  }
  return handOver(file, done)
}
