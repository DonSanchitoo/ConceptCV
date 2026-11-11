import { useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkPlus, CheckCircle2, CircleAlert, ExternalLink, EyeOff, FolderPlus, Link2, Loader2, MapPin, Plus, Save, Search, Settings2, Trash2 } from 'lucide-react'
import type { JobQuery, JobsConfig } from '../types'
import { mutate, toast, useStore } from '../store'
import { shortDate, uid } from '../lib/util'
import { DEFAULT_RELAY, bookmarklet, defaultJobs, emptyQuery, fetchOffer, fillUrl, newSource, pingRelay, runSearch, type SearchResult } from '../jobs/search'
import { resolvePlace } from '../jobs/geo'
import { NO_PLACE, offerId, type Place } from '../jobs/score'
import { splitTitle } from '../jobs/parse'
import { Empty, Field, Range, Segmented, Toggle, cx } from '../ui/kit'
import { NewApplicationModal } from './Dashboard'

type Draft = { company: string; role: string; location: string; url: string; jobText: string }

const CACHE = 'ccv-jobs-last'
const loadCache = (): { query: JobQuery; result: SearchResult; place: Place } | null => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null')
  } catch {
    return null
  }
}

/** Lien dont l'adresse est un script : React refuse de le rendre, on le pose donc à la main. */
const Bookmarklet = () => {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => ref.current?.setAttribute('href', bookmarklet(location.origin + location.pathname)), [])
  return (
    <a ref={ref} className="btn small bookmarklet" onClick={(e) => e.preventDefault()} title="Faites glisser ce bouton dans votre barre de favoris">
      <BookmarkPlus /> Envoyer vers ConceptCV
    </a>
  )
}

export const JobsPage = ({ capture }: { capture?: boolean }) => {
  const stored = useStore((s) => s.db.jobs)
  const profile = useStore((s) => s.db.profile)
  const apps = useStore((s) => s.db.applications)
  const jobs = useMemo<JobsConfig>(() => (stored ? { ...stored, relayUrl: stored.relayUrl || DEFAULT_RELAY } : defaultJobs()), [stored])
  const set = (fn: (j: JobsConfig) => void) => mutate((db) => { if (!db.jobs) db.jobs = defaultJobs(); fn(db.jobs) })
  const cached = useMemo(loadCache, [])
  const [q, setQ] = useState<JobQuery>(cached?.query ?? emptyQuery())
  const [place, setPlace] = useState<Place>(cached?.place ?? NO_PLACE)
  const [result, setResult] = useState<SearchResult | null>(cached?.result ?? null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [addUrl, setAddUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [src, setSrc] = useState({ name: '', url: '', kind: 'rss' as 'rss' | 'page' })
  const [relayState, setRelayState] = useState<'unknown' | 'ok' | 'ok-ft' | 'bad'>('unknown')
  const [minScore, setMinScore] = useState(0)
  const known = useMemo(() => new Set(apps.filter((a) => a.url).map((a) => offerId(a.url))), [apps])
  const hasRelay = !!jobs.relayUrl.trim()

  // Arrivée depuis le signet de capture : l'adresse contient la page, son titre et son texte.
  useEffect(() => {
    if (!capture) return
    const p = new URLSearchParams(location.hash.split('?')[1] ?? '')
    const t = splitTitle(p.get('t') ?? '')
    setDraft({ company: t.company, role: t.role, location: '', url: p.get('u') ?? '', jobText: p.get('x') ?? '' })
    history.replaceState(null, '', '#/offres')
  }, [capture])

  useEffect(() => {
    if (!hasRelay) return setRelayState('unknown')
    let alive = true
    pingRelay(jobs.relayUrl).then((r) => alive && setRelayState(r.franceTravail ? 'ok-ft' : 'ok')).catch(() => alive && setRelayState('bad'))
    return () => { alive = false }
  }, [jobs.relayUrl, hasRelay])

  const locate = async (): Promise<Place> => {
    const p = await resolvePlace(q.place)
    setPlace(p)
    return p
  }
  const search = async (query = q) => {
    if (!hasRelay) return toast('Indiquez d’abord l’adresse du relais, en bas de la page.', 'warn')
    if (!query.keywords.trim()) return toast('Indiquez au moins un mot-clé.', 'warn')
    setBusy(true)
    try {
      const p = await resolvePlace(query.place)
      setPlace(p)
      const r = await runSearch(jobs, query, p, profile)
      setResult(r)
      localStorage.setItem(CACHE, JSON.stringify({ query, result: { ...r, offers: r.offers.slice(0, 150) }, place: p }))
      if (!r.offers.length) toast('Aucune offre ne correspond. Élargissez la zone ou retirez un mot-clé.', 'warn')
    } catch (e) {
      toast((e as Error).message || 'La recherche a échoué.', 'warn')
    } finally {
      setBusy(false)
    }
  }
  const addFromUrl = async () => {
    const url = addUrl.trim()
    if (!/^https?:\/\//.test(url)) return toast('Collez une adresse complète, commençant par https://', 'warn')
    if (!hasRelay) return setDraft({ company: '', role: '', location: '', url, jobText: '' })
    setAdding(true)
    try {
      const o = await fetchOffer(jobs.relayUrl, url)
      setDraft({ company: o.company, role: o.title, location: o.location, url, jobText: o.text })
    } catch (e) {
      toast(`${(e as Error).message}. Complétez le dossier à la main.`, 'warn')
      setDraft({ company: '', role: '', location: '', url, jobText: '' })
    } finally {
      setAdding(false)
      setAddUrl('')
    }
  }
  const offers = (result?.offers ?? []).filter((o) => o.score >= minScore && !jobs.hidden.includes(o.id))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Offres</h1>
          <p className="muted">Recherche à la demande sur vos sources, tri par pertinence sans IA, création du dossier en un clic.</p>
        </div>
      </header>

      <div className="jobs-layout">
        <div>
          <form className="card" onSubmit={(e) => { e.preventDefault(); void search() }}>
            <div className="form-grid">
              <Field label="Métier ou mots-clés" value={q.keywords} onChange={(v) => setQ({ ...q, keywords: v })} placeholder="géomaticien, chargé de mission SIG…" />
              <label className="field half">
                <span className="field-label">Ville, département ou région</span>
                <input className="input" value={q.place} placeholder="Nîmes, Gard, 30, Occitanie" onChange={(e) => setQ({ ...q, place: e.target.value })} onBlur={() => void locate()} />
                {place.label && <span className="field-hint"><MapPin /> {place.label}{place.kind === 'region' ? ` · ${place.deptCodes.length} départements` : ''}</span>}
              </label>
              <Range label="Rayon autour de la ville" value={q.radius} onChange={(v) => setQ({ ...q, radius: v })} min={0} max={100} step={5} unit=" km" />
            </div>
            <details className="fold flat">
              <summary>Critères facultatifs</summary>
              <div className="form-grid">
                <Field half label="Type de contrat" value={q.contract} onChange={(v) => setQ({ ...q, contract: v })} placeholder="CDI, CDD, alternance…" />
                <Field half label="Mots à exclure" value={q.exclude} onChange={(v) => setQ({ ...q, exclude: v })} placeholder="stage, commercial…" />
                <Range label="Publiées depuis" value={q.maxDays} onChange={(v) => setQ({ ...q, maxDays: v })} min={1} max={60} unit=" j" />
                <div className="field half"><Toggle label="Écarter les offres hors zone ou sans lieu" checked={q.strictPlace} onChange={(v) => setQ({ ...q, strictPlace: v })} /></div>
              </div>
            </details>
            <div className="row">
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <Search />} {busy ? 'Recherche en cours…' : 'Rechercher'}
              </button>
              <button
                className="btn"
                type="button"
                disabled={!q.keywords.trim()}
                onClick={() => {
                  set((j) => void j.searches.unshift({ ...q, id: uid(), name: [q.keywords, q.place].filter(Boolean).join(' · ') }))
                  toast('Recherche enregistrée.', 'ok')
                }}
              >
                <Save /> Enregistrer cette recherche
              </button>
            </div>
            {jobs.searches.length > 0 && (
              <div className="chips-row">
                {jobs.searches.map((s) => (
                  <span key={s.id} className="pill saved">
                    <button type="button" onClick={() => { const { id: _i, name: _n, ...query } = s; setQ(query); void search(query) }}>{s.name}</button>
                    <button type="button" aria-label="Supprimer" onClick={() => set((j) => void (j.searches = j.searches.filter((x) => x.id !== s.id)))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </form>

          {result && (
            <div className="source-status">
              {result.status.map((s) => (
                <span key={s.id} className={cx('badge', s.error ? 'warn' : 'ok')} title={s.error}>
                  {s.error ? <CircleAlert /> : <CheckCircle2 />} {s.name} : {s.error ?? `${s.count} lue(s)`}
                </span>
              ))}
              <span className="muted small">{offers.length} offre(s) retenue(s) · {shortDate(result.at)}</span>
            </div>
          )}

          {result && result.offers.length > 0 && (
            <div className="row filter-row">
              <Segmented value={String(minScore)} onChange={(v) => setMinScore(Number(v))} options={[{ value: '0', label: 'Toutes' }, { value: '40', label: 'Pertinentes' }, { value: '65', label: 'Très pertinentes' }]} />
            </div>
          )}

          {offers.map((o) => (
            <article key={o.id} className={cx('offer', known.has(o.id) && 'known')}>
              <div className={cx('offer-score', o.score >= 65 ? 'good' : o.score >= 40 ? 'mid' : 'low')}>{o.score}</div>
              <div className="offer-body">
                <h3>{o.title}</h3>
                <p className="offer-meta">
                  {[o.company, o.location, o.contract, o.salary, o.date && shortDate(o.date)].filter(Boolean).join(' · ')}
                  <span className="badge">{o.source}</span>
                </p>
                {o.text && <p className="offer-text">{o.text.slice(0, 260)}{o.text.length > 260 ? '…' : ''}</p>}
                {o.reasons.length > 0 && <p className="offer-why">{o.reasons.join(' · ')}</p>}
                <div className="row">
                  {known.has(o.id) ? (
                    <span className="badge ok"><CheckCircle2 /> Déjà dans vos dossiers</span>
                  ) : (
                    <button className="btn small primary" onClick={() => setDraft({ company: o.company, role: o.title, location: o.location, url: o.url, jobText: o.text })}><FolderPlus /> Créer le dossier</button>
                  )}
                  <a className="btn small" href={o.url} target="_blank" rel="noreferrer"><ExternalLink /> Voir l’annonce</a>
                  <button className="btn small ghost" onClick={() => set((j) => void j.hidden.push(o.id))}><EyeOff /> Écarter</button>
                </div>
              </div>
            </article>
          ))}
          {!result && <Empty icon={<Search />} title="Lancez une recherche" text="Les sources actives sont interrogées en même temps. Les offres sont notées d’après vos mots-clés, les compétences de votre profil, la date et le lieu." />}
          {jobs.hidden.length > 0 && <button className="btn small ghost" onClick={() => set((j) => void (j.hidden = []))}>Réafficher les {jobs.hidden.length} offre(s) écartée(s)</button>}
        </div>

        <aside>
          <div className="card">
            <h3><ExternalLink /> Chercher aussi sur</h3>
            <p className="muted small">Ces sites refusent la lecture automatique. Le lien ouvre leur recherche déjà remplie avec vos critères.</p>
            <div className="chips-row">
              {jobs.links.map((l) => (
                <a key={l.id} className="pill" href={fillUrl(l.url, q, place)} target="_blank" rel="noreferrer">{l.name}</a>
              ))}
            </div>
          </div>

          <div className="card">
            <h3><Link2 /> Ajouter une offre trouvée ailleurs</h3>
            <form className="row" onSubmit={(e) => { e.preventDefault(); void addFromUrl() }}>
              <input className="input grow" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="Collez l’adresse de l’annonce" />
              <button className="btn" type="submit" disabled={adding}>{adding ? <Loader2 className="spin" /> : <Plus />} Ajouter</button>
            </form>
            <p className="muted small">L’outil lit la page et pré-remplit le dossier. Si le site bloque la lecture, il vous laisse compléter.</p>
            <p className="muted small">Sur ordinateur, glissez ce bouton dans votre barre de favoris. Sur n’importe quelle annonce, un clic dessus crée le dossier avec le texte de la page :</p>
            <Bookmarklet />
          </div>

          <div className="card">
            <h3><Settings2 /> Sources interrogées</h3>
            {jobs.sources.map((s) => (
              <div key={s.id} className="source-row">
                <Toggle label="" checked={s.enabled} onChange={(v) => set((j) => void (j.sources.find((x) => x.id === s.id)!.enabled = v))} />
                <div>
                  <b>{s.name}</b>
                  <span className="muted small">{s.kind === 'francetravail' ? (relayState === 'ok-ft' ? 'API officielle, active' : 'API officielle : identifiants à ajouter sur le relais') : `${s.kind === 'rss' ? 'Flux RSS' : 'Page de résultats'} · ${s.url}`}</span>
                </div>
                {s.kind !== 'francetravail' && <button className="icon-btn" aria-label="Supprimer" onClick={() => set((j) => void (j.sources = j.sources.filter((x) => x.id !== s.id)))}><Trash2 /></button>}
              </div>
            ))}
            <details className="fold flat">
              <summary>Ajouter un site</summary>
              <Field label="Nom" value={src.name} onChange={(v) => setSrc({ ...src, name: v })} placeholder="GeoRezo, site d’une agence…" />
              <Field label="Adresse du flux ou de la page d’offres" value={src.url} onChange={(v) => setSrc({ ...src, url: v })} placeholder="https://…" hint="{q} est remplacé par vos mots-clés, {lieu} par la ville, {dept} par le numéro de département." />
              <Segmented value={src.kind} onChange={(v) => setSrc({ ...src, kind: v })} options={[{ value: 'rss', label: 'Flux RSS' }, { value: 'page', label: 'Page de résultats' }]} />
              <button
                className="btn small add"
                onClick={() => {
                  if (!src.name.trim() || !/^https?:\/\//.test(src.url.trim())) return toast('Donnez un nom et une adresse commençant par https://', 'warn')
                  set((j) => void j.sources.push(newSource(src.name.trim(), src.url.trim(), src.kind)))
                  setSrc({ name: '', url: '', kind: 'rss' })
                }}
              >
                <Plus /> Ajouter la source
              </button>
            </details>
          </div>

          <div className="card">
            <h3>Relais</h3>
            <Field label="Adresse du relais Vercel" value={jobs.relayUrl} onChange={(v) => set((j) => void (j.relayUrl = v))} placeholder="https://conceptcv-relay.vercel.app" />
            <p className={cx('small', relayState === 'bad' ? 'danger-text' : 'muted')}>
              {!hasRelay
                ? 'Sans relais, seuls les liens pré-remplis et l’ajout manuel fonctionnent.'
                : relayState === 'bad'
                  ? 'Le relais ne répond pas ou refuse cette adresse.'
                  : relayState === 'unknown'
                    ? 'Vérification…'
                    : `Relais joignable. France Travail : ${relayState === 'ok-ft' ? 'actif' : 'non configuré'}.`}
            </p>
            <p className="muted small">Le relais ne reçoit que vos critères de recherche et les adresses à lire. Vos CV et vos dossiers n’y passent jamais.</p>
          </div>
        </aside>
      </div>
      {draft && <NewApplicationModal initial={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}
