import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
  half?: boolean
  autoFocus?: boolean
}

export const Field = ({ label, value, onChange, placeholder, type = 'text', hint, half, autoFocus }: FieldProps) => (
  <label className={cx('field', half && 'half')}>
    <span className="field-label">{label}</span>
    <input className="input" type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    {hint && <span className="field-hint">{hint}</span>}
  </label>
)

interface AreaProps {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: ReactNode
  className?: string
  onFocus?: () => void
}

/** Zone de texte qui grandit avec son contenu. */
export const Area = ({ label, value, onChange, placeholder, rows = 2, hint, className, onFocus }: AreaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 2 + 'px'
  }, [value])
  return (
    <label className={cx('field', className)}>
      {label && <span className="field-label">{label}</span>}
      <textarea ref={ref} className="input area" rows={rows} value={value} placeholder={placeholder} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export const Select = <T extends string>({ label, value, onChange, options, half }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; half?: boolean }) => (
  <label className={cx('field', half && 'half')}>
    {label && <span className="field-label">{label}</span>}
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
)

export const Segmented = <T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; label?: string }) => (
  <div className="field">
    {label && <span className="field-label">{label}</span>}
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title} className={cx(value === o.value && 'on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  </div>
)

export const Range = ({ label, value, onChange, min, max, step = 1, unit = '' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) => (
  <label className="field half">
    <span className="field-label">
      {label} <b>{Number.isInteger(value) ? value : value.toFixed(step < 0.1 ? 2 : 1)}{unit}</b>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

export const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="toggle-track" />
    <span>{label}</span>
  </label>
)

export const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="field half color-field">
    <span className="field-label">{label}</span>
    <span className="color-wrap">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </span>
  </label>
)

export const Modal = ({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', wide && 'wide')}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export const ScoreRing = ({ score, size = 76, label }: { score: number; size?: number; label?: string }) => {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const tone = score >= 80 ? 'good' : score >= 55 ? 'mid' : 'bad'
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-text">
        <b>{score}</b>
        {label && <span>{label}</span>}
      </div>
    </div>
  )
}

export const Menu = ({ trigger, children, align = 'right' }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && <div className={`menu menu-${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export const Empty = ({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>
)
