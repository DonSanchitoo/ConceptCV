/** Petit stockage clé/valeur sur IndexedDB : copie de travail locale et poignée du dossier iCloud. */
const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('conceptcv', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('kv', mode)
    const req = fn(tx.objectStore('kv'))
    tx.oncomplete = () => {
      db.close()
      resolve(req.result)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export const idbGet = <T>(key: string): Promise<T | undefined> => run<T | undefined>('readonly', (s) => s.get(key))
export const idbSet = (key: string, value: unknown): Promise<unknown> => run('readwrite', (s) => s.put(value, key))
export const idbDel = (key: string): Promise<unknown> => run('readwrite', (s) => s.delete(key))
