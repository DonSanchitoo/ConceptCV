import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, EyeOff } from 'lucide-react'
import type { CvDoc, Design, Item, Section, SkillDisplay } from '../types'
import { COMPACT_TYPES, dateRange } from '../lib/util'
import { ContactList, Ctx, E, Identity, Photo, T, designVars, pageHeightMm } from './shared'

export type Patch = (fn: (cv: CvDoc) => void) => void

interface Block {
  key: string
  sectionId?: string
  last: boolean // dernier bloc d'une rubrique : suivi de l'espace inter-rubriques
  node: ReactNode
}

interface Props {
  cv: CvDoc
  edit?: boolean
  paginate?: boolean // faux : une seule page tronquée (vignettes)
  patch?: Patch
  onSelectSection?: (id: string) => void
  onPages?: (n: number) => void
}

const Level = ({ level, kind }: { level: number; kind: 'bars' | 'dots' }) =>
  kind === 'bars' ? (
    <span className="lvl-bar">
      <span style={{ width: `${(Math.max(0, Math.min(5, level)) / 5) * 100}%` }} />
    </span>
  ) : (
    <span className="lvl-dots">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= level ? 'on' : ''} />
      ))}
    </span>
  )

const useSection = (s: Section, patch?: Patch) => {
  const setItem = (id: string, p: Partial<Item>) =>
    patch?.((cv) => {
      const it = cv.sections.find((x) => x.id === s.id)?.items.find((x) => x.id === id)
      if (it) Object.assign(it, p)
    })
  const setSection = (p: Partial<Section>) =>
    patch?.((cv) => {
      const sec = cv.sections.find((x) => x.id === s.id)
      if (sec) Object.assign(sec, p)
    })
  return { setItem, setSection }
}

const Heading = ({ s, patch }: { s: Section; patch?: Patch }) => {
  const { setSection } = useSection(s, patch)
  return (
    <h2 className="sec-title">
      <E value={s.title} onCommit={patch ? (v) => setSection({ title: v }) : undefined} placeholder="Titre de la rubrique" />
    </h2>
  )
}

const Entry = ({ s, it, d, narrow, patch }: { s: Section; it: Item; d: Design; narrow: boolean; patch?: Patch }) => {
  const { setItem } = useSection(s, patch)
  const on = (k: keyof Item) => (patch ? (v: string) => setItem(it.id, { [k]: v }) : undefined)
  const pos = narrow ? 'below' : d.datePosition
  const dates = (
    <span className="it-dates">
      {patch ? (
        <>
          <E value={it.start} onCommit={on('start')} placeholder="Début" />
          {(it.start || it.end) && ' – '}
          <E value={it.end} onCommit={on('end')} placeholder="Fin" optional={!it.start} />
        </>
      ) : (
        dateRange(it)
      )}
    </span>
  )
  // Bloc de texte libre : des puces sans intitulé ni dates. On n'affiche pas d'en-tête vide.
  const bare = !it.title && !it.subtitle && !it.start && !it.end && (it.bullets.length > 0 || !!it.description)
  const hasDates = !bare && (patch || it.start || it.end)
  return (
    <div className={`it dates-${pos}`}>
      {pos === 'left' && <div className="it-datecol">{hasDates && dates}</div>}
      <div className="it-body">
        {!bare && (
          <div className="it-head">
            <E className="it-title" value={it.title} onCommit={on('title')} placeholder="Intitulé" />
            {pos === 'right' && hasDates && dates}
          </div>
        )}
        {!bare && (patch || it.subtitle || it.location) && (
          <div className="it-sub">
            <E value={it.subtitle} onCommit={on('subtitle')} placeholder="Organisation" />
            {it.location && ' · '}
            <E value={it.location} onCommit={on('location')} placeholder="Lieu" optional />
          </div>
        )}
        {pos === 'below' && hasDates && <div className="it-datesbelow">{dates}</div>}
        <E tag="p" className="it-desc" multiline optional value={it.description} onCommit={on('description')} />
        {it.bullets.length > 0 && (
          <ul className={`bul bul-${d.bullet}`}>
            {it.bullets.map((b, i) => (
              <E
                tag="li"
                key={i}
                value={b}
                placeholder="Action + résultat chiffré"
                onCommit={
                  patch
                    ? (v) =>
                        patch((cv) => {
                          const t = cv.sections.find((x) => x.id === s.id)?.items.find((x) => x.id === it.id)
                          if (!t) return
                          if (v.trim()) t.bullets[i] = v
                          else t.bullets.splice(i, 1)
                        })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
        {it.tags.length > 0 && <div className="it-tags">{it.tags.join(' · ')}</div>}
      </div>
    </div>
  )
}

const Compact = ({ s, d, narrow, patch }: { s: Section; d: Design; narrow: boolean; patch?: Patch }) => {
  const { setItem } = useSection(s, patch)
  const items = s.items.filter((i) => i.visible)
  const mode: SkillDisplay = s.type === 'languages' ? d.languageDisplay : d.skillDisplay
  const title = (i: Item) => (
    <E className="ci-title" value={i.title} onCommit={patch ? (v) => setItem(i.id, { title: v }) : undefined} placeholder="Intitulé" />
  )
  const detail = (i: Item) => {
    const txt = i.tags.length ? i.tags.join(', ') : i.subtitle
    if (i.tags.length)
      return (
        <E
          className="ci-detail"
          value={txt}
          optional
          onCommit={patch ? (v) => setItem(i.id, { tags: v.split(',').map((x) => x.trim()).filter(Boolean) }) : undefined}
        />
      )
    return <E className="ci-detail" value={txt} optional onCommit={patch ? (v) => setItem(i.id, { subtitle: v }) : undefined} />
  }

  if (mode === 'tags') {
    const grouped = items.some((i) => i.tags.length)
    if (!grouped)
      return (
        <div className="chips">
          {items.map((i) => (
            <span className="chip" key={i.id}>
              {i.title}
              {i.subtitle ? ` · ${i.subtitle}` : ''}
            </span>
          ))}
        </div>
      )
    return (
      <div className="ci-list">
        {items.map((i) => (
          <div className="ci" key={i.id}>
            {title(i)}
            <div className="chips">
              {i.tags.map((t) => (
                <span className="chip" key={t}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (mode === 'bars' || mode === 'dots') {
    return (
      <div className="ci-list">
        {items.map((i) => (
          <div className="ci ci-level" key={i.id}>
            <div className="ci-row">
              {title(i)}
              {i.level > 0 ? <Level level={i.level} kind={mode} /> : i.subtitle && !i.tags.length ? <span className="ci-detail">{i.subtitle}</span> : null}
            </div>
            {(i.tags.length > 0 || (i.level > 0 && i.subtitle)) && detail(i)}
          </div>
        ))}
      </div>
    )
  }
  const simple = items.every((i) => !i.tags.length && !i.subtitle)
  if (simple && !narrow && mode === 'inline')
    return <div className="ci-inline">{items.map((i) => i.title).join(' · ')}</div>
  return (
    <div className={`ci-list ${mode === 'inline' ? 'ci-oneline' : ''}`}>
      {items.map((i) => (
        <div className="ci" key={i.id}>
          {title(i)}
          {(i.tags.length > 0 || i.subtitle) && (
            <>
              {mode === 'inline' && <span className="ci-sep">{i.tags.length ? ' : ' : ' — '}</span>}
              {detail(i)}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

const sectionBlocks = (s: Section, d: Design, narrow: boolean, edit: boolean, patch?: Patch): Block[] => {
  const p = edit ? patch : undefined
  const head = <Heading s={s} patch={p} />
  const wrap = (key: string, node: ReactNode, last: boolean): Block => ({ key, sectionId: s.id, last, node })
  if (s.type === 'summary') {
    if (!s.text && !edit) return []
    return [
      wrap(
        s.id,
        <>
          {head}
          <E
            tag="p"
            className="summary"
            multiline
            value={s.text}
            placeholder="Deux ou trois phrases : votre métier, votre point fort, ce que vous cherchez."
            onCommit={p ? (v) => p((cv) => void Object.assign(cv.sections.find((x) => x.id === s.id)!, { text: v })) : undefined}
          />
        </>,
        true,
      ),
    ]
  }
  const items = s.items.filter((i) => i.visible)
  if (!items.length) return edit ? [wrap(s.id, <>{head}<p className="empty-hint">Rubrique vide : ajoutez un élément dans le panneau.</p></>, true)] : []
  if (COMPACT_TYPES.includes(s.type)) {
    return [wrap(s.id, <>{head}<Compact s={s} d={d} narrow={narrow} patch={p} /></>, true)]
  }
  return items.map((it, i) =>
    wrap(
      `${s.id}:${it.id}`,
      <>
        {i === 0 && head}
        <Entry s={s} it={it} d={d} narrow={narrow} patch={p} />
      </>,
      i === items.length - 1,
    ),
  )
}

const SectionTools = ({ id, cv, patch }: { id: string; cv: CvDoc; patch: Patch }) => {
  const twoCols = cv.design.layout !== 'single'
  const move = (dir: -1 | 1) =>
    patch((c) => {
      const list = c.main.includes(id) ? c.main : c.side
      const i = list.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      ;[list[i], list[j]] = [list[j], list[i]]
    })
  const swap = () =>
    patch((c) => {
      if (c.main.includes(id)) {
        c.main = c.main.filter((x) => x !== id)
        c.side.push(id)
      } else {
        c.side = c.side.filter((x) => x !== id)
        c.main.push(id)
      }
    })
  const hide = () => patch((c) => void (c.sections.find((s) => s.id === id)!.visible = false))
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    fn()
  }
  return (
    <div className="sec-tools" contentEditable={false}>
      <button title="Monter" onMouseDown={stop(() => move(-1))}><ArrowUp /></button>
      <button title="Descendre" onMouseDown={stop(() => move(1))}><ArrowDown /></button>
      {twoCols && <button title="Changer de colonne" onMouseDown={stop(swap)}><ArrowLeftRight /></button>}
      <button title="Masquer" onMouseDown={stop(hide)}><EyeOff /></button>
    </div>
  )
}

interface Built {
  banner: ReactNode | null
  main: Block[]
  side: Block[]
}

const build = (cv: CvDoc, edit: boolean, patch?: Patch): Built => {
  const d = cv.design
  const single = d.layout === 'single'
  const byId = new Map(cv.sections.map((s) => [s.id, s]))
  const secs = (ids: string[]) => ids.map((id) => byId.get(id)).filter((s): s is Section => !!s && s.visible)
  const contactSide = !single && d.contactInSidebar
  const headerInSide = !single && d.header === 'sidebar'
  const onBasics = edit && patch ? (p: Partial<CvDoc['basics']>) => patch((c) => void Object.assign(c.basics, p)) : undefined

  const identity = (
    <Identity basics={cv.basics} design={d} lang={cv.lang} withContacts={!contactSide} stackedContacts={d.header === 'split'} onBasics={onBasics} />
  )
  const headerStyle = headerInSide ? 'sidebar' : d.header === 'sidebar' ? 'left' : d.header
  const header = <header className={`cv-header hdr-${headerStyle}`}>{identity}</header>

  const main: Block[] = []
  const side: Block[] = []
  let banner: ReactNode | null = null
  // Bandeau, ou deux colonnes sans aplat : l'en-tête occupe toute la largeur de la page.
  if (headerStyle === 'banner') banner = header
  else if (d.layout === 'split' && !headerInSide) banner = <div className="top-header">{header}</div>
  else if (headerInSide) side.push({ key: 'header', last: true, node: header })
  else main.push({ key: 'header', last: true, node: header })

  if (contactSide) {
    // La photo rejoint la colonne quand l'en-tête n'y est pas déjà.
    if (!headerInSide && d.showPhoto && cv.basics.photo && headerStyle !== 'banner')
      side.push({ key: 'photo', last: true, node: <div className="side-photo"><Photo basics={cv.basics} design={d} /></div> })
    side.push({
      key: 'contact',
      last: true,
      node: (
        <>
          <h2 className="sec-title">{T[cv.lang].contact}</h2>
          <ContactList basics={cv.basics} icons={d.showIcons} stacked />
        </>
      ),
    })
  }
  const mainIds = single ? [...cv.main, ...cv.side] : cv.main
  for (const s of secs(mainIds)) main.push(...sectionBlocks(s, d, false, edit, patch))
  if (!single) for (const s of secs(cv.side)) side.push(...sectionBlocks(s, d, true, edit, patch))
  return { banner, main, side }
}

type Pages = { main: string[]; side: string[] }[]

const sameLayout = (a: Pages, b: Pages) => JSON.stringify(a) === JSON.stringify(b)

export const CvDocument = ({ cv, edit = false, paginate = true, patch, onSelectSection, onPages }: Props) => {
  const d = cv.design
  const built = useMemo(() => build(cv, edit, patch), [cv, edit, patch])
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<Pages>([{ main: built.main.map((b) => b.key), side: built.side.map((b) => b.key) }])
  const [fontTick, setFontTick] = useState(0)
  const parent = useContext(Ctx)

  useEffect(() => {
    if (!paginate) return
    const bump = () => setFontTick((n) => n + 1)
    document.fonts?.addEventListener('loadingdone', bump)
    // L'aperçu peut être masqué (mobile) puis réaffiché : on remesure quand sa taille change.
    const ro = new ResizeObserver(bump)
    if (measureRef.current) ro.observe(measureRef.current)
    return () => {
      document.fonts?.removeEventListener('loadingdone', bump)
      ro.disconnect()
    }
  }, [paginate])

  useLayoutEffect(() => {
    if (!paginate) return
    const root = measureRef.current
    if (!root) return
    const page = root.querySelector<HTMLElement>('.cv-page')
    if (!page || !page.getBoundingClientRect().width) return
    const pageH = page.getBoundingClientRect().width * (pageHeightMm(d) / (d.pageFormat === 'Letter' ? 215.9 : 210))
    const mm = pageH / pageHeightMm(d)
    const bannerH = root.querySelector<HTMLElement>('[data-banner]')?.getBoundingClientRect().height ?? 0
    const h = new Map<string, number>()
    root.querySelectorAll<HTMLElement>('[data-bk]').forEach((el) => h.set(el.dataset.bk!, el.getBoundingClientRect().height))
    const flow = (blocks: Block[]): string[][] => {
      const out: string[][] = [[]]
      let used = 0
      for (const b of blocks) {
        const bh = h.get(b.key) ?? 0
        const pad = (b.last ? d.sectionGap : d.itemGap) * mm
        const cap = pageH - 2 * d.margin * mm - (out.length === 1 ? bannerH : 0)
        const cur = out[out.length - 1]
        if (cur.length && used + bh - pad > cap + 0.5) {
          out.push([b.key])
          used = bh
        } else {
          cur.push(b.key)
          used += bh
        }
      }
      return out
    }
    const m = flow(built.main)
    const s = flow(built.side)
    const n = Math.max(m.length, s.length)
    const next: Pages = Array.from({ length: n }, (_, i) => ({ main: m[i] ?? [], side: s[i] ?? [] }))
    setPages((prev) => (sameLayout(prev, next) ? prev : next))
  }, [built, d, paginate, fontTick])

  useEffect(() => {
    onPages?.(pages.length)
  }, [pages.length, onPages])

  const blockOf = new Map<string, Block>([...built.main, ...built.side].map((b) => [b.key, b]))
  const firstOfSection = new Set<string>()
  const seen = new Set<string>()
  for (const b of [...built.main, ...built.side])
    if (b.sectionId && !seen.has(b.sectionId)) {
      seen.add(b.sectionId)
      firstOfSection.add(b.key)
    }

  const renderBlock = (key: string, live: boolean) => {
    const b = blockOf.get(key)
    if (!b) return null
    return (
      <div
        key={key}
        data-bk={key}
        className={`blk ${b.last ? 'blk-last' : ''} ${b.sectionId ? 'blk-sec' : ''}`}
        onClick={live && b.sectionId && onSelectSection ? () => onSelectSection(b.sectionId!) : undefined}
      >
        {live && edit && patch && b.sectionId && firstOfSection.has(key) && <SectionTools id={b.sectionId} cv={cv} patch={patch} />}
        {b.node}
      </div>
    )
  }

  const pageNode = (p: { main: string[]; side: string[] }, i: number, live: boolean) => (
    <div className={`cv-page layout-${d.layout} hs-${d.headingStyle} ${paginate ? '' : 'clip'}`} style={designVars(d)} key={i}>
      {i === 0 && built.banner && <div data-banner="">{built.banner}</div>}
      <div className="cv-body">
        {d.layout !== 'single' && <div className="cv-col cv-side">{p.side.map((k) => renderBlock(k, live))}</div>}
        <div className="cv-col cv-main">{p.main.map((k) => renderBlock(k, live))}</div>
      </div>
    </div>
  )

  const all = { main: built.main.map((b) => b.key), side: built.side.map((b) => b.key) }
  if (!paginate)
    return (
      <Ctx.Provider value={{ edit: false, inert: true }}>
        <div className="cv-doc">{pageNode(all, 0, false)}</div>
      </Ctx.Provider>
    )

  return (
    <div className="cv-doc">
      <Ctx.Provider value={{ edit, inert: true }}>
        <div className="cv-measure" ref={measureRef} aria-hidden>
          {pageNode(all, 0, false)}
        </div>
      </Ctx.Provider>
      <Ctx.Provider value={{ edit, inert: parent.inert }}>{pages.map((p, i) => pageNode(p, i, true))}</Ctx.Provider>
    </div>
  )
}
