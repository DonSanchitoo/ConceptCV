// Relais de recherche d'offres pour ConceptCV (fonction Vercel, gratuite).
// Il ne voit jamais les CV : seulement une adresse de page à lire ou des critères de recherche.
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://donsanchitoo.github.io,http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim())
const MAX_BYTES = 3_000_000
const UA = 'Mozilla/5.0 (compatible; ConceptCV/1.0; recherche d\'offres personnelle)'

const privateV4 = (ip) => {
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}
const privateIp = (ip) => {
  if (isIP(ip) === 4) return privateV4(ip)
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return privateV4(v.slice(7))
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
}

/** Refuse tout ce qui n'est pas une page web publique : le relais ne doit pas servir à atteindre un réseau interne. */
export const assertPublic = async (raw) => {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new Error('Adresse invalide')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Seules les adresses http(s) sont acceptées')
  if (u.username || u.password) throw new Error('Adresse avec identifiants refusée')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new Error('Adresse interne refusée')
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address)
  if (!ips.length || ips.some(privateIp)) throw new Error('Adresse interne refusée')
  return u
}

const decode = (buf, contentType) => {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1]
  if (!charset) {
    const head = new TextDecoder('latin1').decode(buf.subarray(0, 2048))
    charset = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

const readPage = async (raw) => {
  let url = (await assertPublic(raw)).toString()
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(9000),
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,*/*;q=0.5', 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.5' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublic(new URL(res.headers.get('location'), url).toString())).toString()
      continue
    }
    const type = res.headers.get('content-type') || ''
    if (type && !/text|xml|json|html/i.test(type)) return { ok: false, status: res.status, url, contentType: type, text: '', error: 'Ce n\'est pas une page de texte' }
    const reader = res.body?.getReader()
    const chunks = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      chunks.push(value)
      if (size > MAX_BYTES) {
        await reader.cancel()
        break
      }
    }
    return { ok: res.ok, status: res.status, url, contentType: type, text: decode(Buffer.concat(chunks), type) }
  }
  throw new Error('Trop de redirections')
}

/* ───────── France Travail (API officielle Offres d'emploi v2) ───────── */
let token = { value: '', until: 0 }
const ftToken = async () => {
  if (token.value && Date.now() < token.until) return token.value
  const res = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', {
    method: 'POST',
    signal: AbortSignal.timeout(9000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.FT_CLIENT_ID, client_secret: process.env.FT_CLIENT_SECRET, scope: process.env.FT_SCOPE || 'api_offresdemploiv2 o2dsoffre' }),
  })
  if (!res.ok) throw new Error(`France Travail a refusé les identifiants (${res.status})`)
  const j = await res.json()
  token = { value: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 }
  return token.value
}
const FT_PARAMS = ['motsCles', 'departement', 'commune', 'distance', 'region', 'typeContrat', 'publieeDepuis', 'range', 'sort', 'experience', 'tempsPlein']
const franceTravail = async (query) => {
  const qs = new URLSearchParams()
  for (const k of FT_PARAMS) if (query[k]) qs.set(k, String(query[k]))
  const res = await fetch(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${qs}`, {
    signal: AbortSignal.timeout(9000),
    headers: { authorization: `Bearer ${await ftToken()}`, accept: 'application/json' },
  })
  if (res.status === 204) return { ok: true, status: 204, resultats: [] }
  const text = await res.text()
  let data = {}
  try {
    data = JSON.parse(text)
  } catch {
    /* réponse non JSON */
  }
  return { ok: res.ok, status: res.status, resultats: data.resultats || [], error: res.ok ? undefined : data.message || text.slice(0, 200) }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ORIGINS.includes(origin)
  const keyOk = !!process.env.RELAY_KEY && (req.headers['x-relay-key'] === process.env.RELAY_KEY || req.query.k === process.env.RELAY_KEY)
  if (allowed) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'origin')
    res.setHeader('access-control-allow-headers', 'x-relay-key')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('cache-control', 'no-store')
  if (!allowed && !keyOk) return res.status(403).json({ ok: false, error: 'Origine non autorisée' })
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET uniquement' })
  const hasFt = !!(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET)
  try {
    const op = req.query.op
    if (op === 'ping') return res.status(200).json({ ok: true, franceTravail: hasFt })
    if (op === 'fetch') return res.status(200).json(await readPage(String(req.query.url || '')))
    if (op === 'francetravail') {
      if (!hasFt) return res.status(200).json({ ok: false, status: 0, resultats: [], error: 'Identifiants France Travail non configurés sur le relais' })
      return res.status(200).json(await franceTravail(req.query))
    }
    return res.status(400).json({ ok: false, error: 'Opération inconnue' })
  } catch (e) {
    return res.status(200).json({ ok: false, status: 0, text: '', error: e?.name === 'TimeoutError' ? 'Le site n\'a pas répondu à temps' : String(e?.message || e) })
  }
}
