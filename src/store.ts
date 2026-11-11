import { create } from 'zustand'
import { produce } from 'immer'
import type { Application, DB, Doc } from './types'
import { emptyDb } from './lib/factory'
import { nowIso } from './lib/util'

export type SyncStatus = 'local' | 'saving' | 'saved' | 'error' | 'needs-permission'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'ok' | 'warn'
}

interface State {
  db: DB
  ready: boolean
  past: DB[]
  future: DB[]
  lastMutation: number
  syncStatus: SyncStatus
  folderName: string
  lastSavedAt: string
  exportedRev: number
  toasts: Toast[]
  mutate: (fn: (db: DB) => void) => void
  replaceDb: (db: DB, keepHistory?: boolean) => void
  undo: () => void
  redo: () => void
  set: (p: Partial<State>) => void
  toast: (text: string, tone?: Toast['tone']) => void
}

let toastId = 0

export const useStore = create<State>((set, get) => ({
  db: emptyDb(),
  ready: false,
  past: [],
  future: [],
  lastMutation: 0,
  syncStatus: 'local',
  folderName: '',
  lastSavedAt: '',
  exportedRev: Number(localStorage.getItem('ccv-exported-rev') || 0),
  toasts: [],
  mutate: (fn) => {
    const { db, past, lastMutation } = get()
    const next = produce(db, (d) => {
      fn(d as DB)
      d.rev += 1
      d.updatedAt = nowIso()
    })
    const t = Date.now()
    // Les frappes rapprochées forment une seule étape d'annulation.
    const merged = t - lastMutation < 900 && past.length > 0
    set({ db: next, past: merged ? past : [...past.slice(-79), db], future: [], lastMutation: t })
  },
  replaceDb: (db, keepHistory = false) => set(keepHistory ? { db } : { db, past: [], future: [] }),
  undo: () => {
    const { db, past, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      db: { ...prev, rev: db.rev + 1, updatedAt: nowIso() },
      past: past.slice(0, -1),
      future: [db, ...future],
      lastMutation: 0,
    })
  },
  redo: () => {
    const { db, past, future } = get()
    if (!future.length) return
    set({
      db: { ...future[0], rev: db.rev + 1, updatedAt: nowIso() },
      past: [...past, db],
      future: future.slice(1),
      lastMutation: 0,
    })
  },
  set: (p) => set(p),
  toast: (text, tone = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text, tone }] })
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 4200)
  },
}))

export const mutate = (fn: (db: DB) => void) => useStore.getState().mutate(fn)
export const toast = (text: string, tone?: Toast['tone']) => useStore.getState().toast(text, tone)

export const updateApp = (appId: string, fn: (a: Application) => void) =>
  mutate((db) => {
    const a = db.applications.find((x) => x.id === appId)
    if (!a) return
    fn(a)
    a.updatedAt = nowIso()
  })

export const updateDoc = <T extends Doc>(appId: string, docId: string, fn: (d: T) => void) =>
  updateApp(appId, (a) => {
    const d = a.docs.find((x) => x.id === docId)
    if (!d) return
    fn(d as T)
    d.updatedAt = nowIso()
  })

export const useApp = (appId: string | undefined) => useStore((s) => s.db.applications.find((a) => a.id === appId))
