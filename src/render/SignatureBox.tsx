import { useRef, useState } from 'react'
import type { SignatureImage } from '../types'

type Geo = Pick<SignatureImage, 'w' | 'x' | 'y'>

/**
 * Signature manuscrite posée sur la lettre. En édition : on la déplace en la faisant glisser,
 * on la redimensionne par la poignée ou en pinçant à deux doigts. Les mesures sont en millimètres,
 * donc identiques à l'écran, quel que soit le zoom, et dans le PDF.
 */
export const SignatureBox = ({ sig, edit, onChange }: { sig: SignatureImage; edit: boolean; onChange?: (g: Geo) => void }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState<Geo | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ geo: Geo; x: number; y: number; dist: number; mode: 'move' | 'resize' | 'pinch'; mm: number } | null>(null)
  const g = live ?? sig
  const active = edit && !!onChange

  const down = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    ref.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const page = ref.current?.closest('.cv-page')?.getBoundingClientRect()
    const mm = page ? page.width / (page.width / page.height > 0.74 ? 215.9 : 210) : 3.78
    const pts = [...pointers.current.values()]
    const pinch = pts.length >= 2
    start.current = {
      geo: { w: g.w, x: g.x, y: g.y },
      x: e.clientX,
      y: e.clientY,
      dist: pinch ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      mode: pinch ? 'pinch' : mode,
      mm,
    }
  }
  const move = (e: React.PointerEvent) => {
    const s = start.current
    if (!s || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const clamp = (w: number) => Math.max(12, Math.min(110, w))
    if (s.mode === 'pinch') {
      const pts = [...pointers.current.values()]
      if (pts.length < 2 || !s.dist) return
      setLive({ ...s.geo, w: clamp(s.geo.w * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / s.dist)) })
    } else if (s.mode === 'resize') setLive({ ...s.geo, w: clamp(s.geo.w + (e.clientX - s.x) / s.mm) })
    else setLive({ ...s.geo, x: s.geo.x + (e.clientX - s.x) / s.mm, y: s.geo.y + (e.clientY - s.y) / s.mm })
  }
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size) return
    start.current = null
    if (live) {
      const r = (n: number) => Math.round(n * 10) / 10
      onChange?.({ w: r(live.w), x: r(live.x), y: r(live.y) })
      setLive(null)
    }
  }
  return (
    <div className="lt-sigwrap">
      <div
        ref={ref}
        className={`lt-sig ${active ? 'edit' : ''}`}
        style={{ width: `${g.w}mm`, transform: `translate(${g.x}mm, ${g.y}mm)` }}
        onPointerDown={down('move')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <img src={sig.src} alt="Signature" draggable={false} />
        {active && <span className="sig-handle" onPointerDown={down('resize')} />}
      </div>
    </div>
  )
}
