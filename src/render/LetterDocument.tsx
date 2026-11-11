import { useEffect, useRef } from 'react'
import type { LetterDoc, Recipient } from '../types'
import { cityLine } from '../lib/util'
import { SignatureBox } from './SignatureBox'
import { ContactList, Ctx, E, Identity, T, designVars, pageHeightMm } from './shared'

export type LetterPatch = (fn: (l: LetterDoc) => void) => void

interface Props {
  letter: LetterDoc
  edit?: boolean
  patch?: LetterPatch
  onPages?: (n: number) => void
  onSelectParagraph?: (id: string) => void
}

export const LetterDocument = ({ letter, edit = false, patch, onPages, onSelectParagraph }: Props) => {
  const d = letter.design
  const l = letter
  const ref = useRef<HTMLDivElement>(null)
  const p = edit ? patch : undefined
  const set = <K extends keyof LetterDoc>(k: K) => (p ? (v: string) => p((x) => void ((x[k] as unknown as string) = v)) : undefined)
  const setR = (k: keyof Recipient) => (p ? (v: string) => p((x) => void (x.recipient[k] = v)) : undefined)
  const sidebar = d.layout === 'sidebar-left' || d.layout === 'sidebar-right'
  const banner = d.header === 'banner'
  const headerStyle = sidebar && !banner ? 'sidebar' : d.header === 'sidebar' ? 'left' : d.header
  const onBasics = p ? (b: Partial<LetterDoc['sender']>) => p((x) => void Object.assign(x.sender, b)) : undefined
  const identity = (
    <Identity basics={l.sender} design={d} lang={l.lang} withContacts={!sidebar} stackedContacts={d.header === 'split'} onBasics={onBasics} />
  )
  const header = <header className={`cv-header hdr-${headerStyle}`}>{identity}</header>

  useEffect(() => {
    const el = ref.current
    if (!el || !onPages) return
    const check = () => {
      const rect = el.getBoundingClientRect()
      const mm = rect.width / (d.pageFormat === 'Letter' ? 215.9 : 210)
      onPages(Math.max(1, Math.ceil((rect.height - 2) / (pageHeightMm(d) * mm))))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [d, onPages])

  const r = l.recipient
  return (
    <Ctx.Provider value={{ edit, inert: false }}>
      <div className="cv-doc">
        <div ref={ref} className={`cv-page letter layout-${sidebar ? d.layout : 'single'} hs-${d.headingStyle}`} style={designVars(d)}>
          {banner && <div data-banner="">{header}</div>}
          <div className="cv-body">
            {sidebar && (
              <div className="cv-col cv-side">
                {!banner && <div className="blk blk-last">{header}</div>}
                <div className="blk blk-last">
                  <h2 className="sec-title">{T[l.lang].contact}</h2>
                  <ContactList basics={l.sender} icons={d.showIcons} stacked />
                </div>
              </div>
            )}
            <div className="cv-col cv-main lt">
              {!sidebar && !banner && <div className="blk blk-last">{header}</div>}
              <div className={`lt-recipient ${l.lang === 'en' ? 'lt-left' : ''}`}>
                <E tag="div" className="lt-company" value={r.company} onCommit={setR('company')} placeholder="Entreprise" />
                <E tag="div" value={r.contact} onCommit={setR('contact')} placeholder="À l'attention de…" />
                <E tag="div" value={r.title} onCommit={setR('title')} placeholder="Fonction" optional />
                <E tag="div" value={r.address} onCommit={setR('address')} placeholder="Adresse" />
                {p ? (
                  <div>
                    <E value={r.postalCode} onCommit={setR('postalCode')} placeholder="Code postal" />{' '}
                    <E value={r.city} onCommit={setR('city')} placeholder="Ville" />
                  </div>
                ) : (
                  cityLine(r) && <div>{cityLine(r)}</div>
                )}
              </div>
              <div className={`lt-date ${l.lang === 'en' ? 'lt-left' : ''}`}>
                <E value={l.place} onCommit={set('place')} placeholder="Ville" />
                {l.place && (l.lang === 'fr' ? ', le ' : ', ')}
                <E value={l.date} onCommit={set('date')} placeholder="date" />
              </div>
              {(p || l.subject) && (
                <div className="lt-subject">
                  <span className="lt-label">{T[l.lang].subject} : </span>
                  <E value={l.subject} onCommit={set('subject')} placeholder="Candidature au poste de…" />
                </div>
              )}
              {l.reference && (
                <div className="lt-ref">
                  <span className="lt-label">{T[l.lang].ref} : </span>
                  <E value={l.reference} onCommit={set('reference')} />
                </div>
              )}
              <E tag="p" className="lt-greeting" value={l.greeting} onCommit={set('greeting')} placeholder="Madame, Monsieur," />
              {l.paragraphs.map((para) => (
                <div key={para.id} className="lt-para" onClick={onSelectParagraph ? () => onSelectParagraph(para.id) : undefined}>
                  <E
                    tag="p"
                    multiline
                    value={para.text}
                    placeholder="Écrivez ce paragraphe…"
                    onCommit={p ? (v) => p((x) => void (x.paragraphs.find((q) => q.id === para.id)!.text = v)) : undefined}
                  />
                </div>
              ))}
              <E tag="p" className="lt-closing" multiline value={l.closing} onCommit={set('closing')} placeholder="Formule de politesse" />
              {l.sig && <SignatureBox sig={l.sig} edit={edit} onChange={p ? (g) => p((x) => void (x.sig && Object.assign(x.sig, g))) : undefined} />}
              <E tag="p" className={`lt-signature ${l.sig ? 'has-sig' : ''}`} value={l.signature} onCommit={set('signature')} placeholder="Prénom Nom" />
            </div>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  )
}
