import { norm } from '../analysis/keywords'
import { NO_PLACE, type Place } from './score'

const API = 'https://geo.api.gouv.fr'
interface Commune { nom: string; code: string; codesPostaux?: string[]; departement?: { code: string; nom: string }; region?: { code: string; nom: string } }
interface Dept { nom: string; code: string; region?: { code: string; nom: string } }
interface Region { nom: string; code: string }

const get = async <T>(path: string): Promise<T[]> => {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) return []
    const j: unknown = await res.json()
    return Array.isArray(j) ? (j as T[]) : j ? [j as T] : []
  } catch {
    return []
  }
}

/**
 * Comprend « Nîmes », « Gard », « 30 » ou « Occitanie » grâce au référentiel public geo.api.gouv.fr
 * (appel direct depuis le navigateur, sans relais). Renvoie les codes utiles aux sources et les noms à chercher dans les textes.
 */
export const resolvePlace = async (input: string): Promise<Place> => {
  const q = input.trim()
  if (!q) return NO_PLACE
  const n = norm(q)
  if (/^(\d{2,3}|2[ab])$/i.test(q)) {
    const [d] = await get<Dept>(`/departements/${q.toUpperCase()}?fields=nom,code,region`)
    if (d) return { label: `${d.nom} (${d.code})`, kind: 'departement', insee: '', city: '', deptCodes: [d.code], regionCode: d.region?.code ?? '', names: [d.nom] }
  }
  const enc = encodeURIComponent(q)
  const [depts, regions, communes] = await Promise.all([
    get<Dept>(`/departements?nom=${enc}&fields=nom,code,region&limit=3`),
    get<Region>(`/regions?nom=${enc}&limit=3`),
    /^\d{5}$/.test(q)
      ? get<Commune>(`/communes?codePostal=${q}&fields=nom,code,codesPostaux,departement,region&limit=3`)
      : get<Commune>(`/communes?nom=${enc}&fields=nom,code,codesPostaux,departement,region&boost=population&limit=3`),
  ])
  const dept = depts.find((d) => norm(d.nom) === n)
  if (dept) return { label: `${dept.nom} (${dept.code})`, kind: 'departement', insee: '', city: '', deptCodes: [dept.code], regionCode: dept.region?.code ?? '', names: [dept.nom] }
  const region = regions.find((r) => norm(r.nom) === n)
  if (region) {
    const inside = await get<Dept>(`/regions/${region.code}/departements?fields=nom,code`)
    return { label: region.nom, kind: 'region', insee: '', city: '', deptCodes: inside.map((d) => d.code), regionCode: region.code, names: [region.nom, ...inside.map((d) => d.nom)] }
  }
  const c = communes[0]
  if (c)
    return {
      label: `${c.nom}${c.departement ? ` (${c.departement.code})` : ''}`,
      kind: 'commune',
      insee: c.code,
      city: c.nom,
      deptCodes: c.departement ? [c.departement.code] : [],
      regionCode: c.region?.code ?? '',
      names: [c.nom, ...(c.departement ? [c.departement.nom] : [])],
    }
  // Référentiel injoignable ou lieu inconnu : on cherche simplement le mot tel quel dans les offres.
  return { label: q, kind: 'commune', insee: '', city: q, deptCodes: [], regionCode: '', names: [q] }
}
