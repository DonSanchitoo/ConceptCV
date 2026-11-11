import { useEffect, useState } from 'react'

const read = (): string => location.hash.replace(/^#/, '') || '/'

export const go = (path: string) => {
  location.hash = path
}

/** Routage par ancre : fonctionne sur GitHub Pages sans configuration serveur. */
export const useRoute = (): string[] => {
  const [path, setPath] = useState(read)
  useEffect(() => {
    const on = () => {
      setPath(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path.split('/').filter(Boolean)
}
