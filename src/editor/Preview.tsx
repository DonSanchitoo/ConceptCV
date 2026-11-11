import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

/** Zone d'aperçu : ajuste le document à la largeur disponible, avec zoom manuel. */
export const Preview = ({ children, pageWidthMm = 210, footer }: { children: ReactNode; pageWidthMm?: number; footer?: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const [manual, setManual] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const pagePx = (pageWidthMm * 96) / 25.4
      setFit(Math.min(1.25, Math.max(0.2, (el.clientWidth - 32) / pagePx)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageWidthMm])
  const zoom = manual ?? fit
  return (
    <div className="preview" ref={ref}>
      <div className="preview-scroll">
        <div className="preview-zoom" style={{ zoom }}>
          {children}
        </div>
      </div>
      <div className="preview-bar">
        <button className="icon-btn" onClick={() => setManual(Math.max(0.3, zoom - 0.1))} aria-label="Réduire">
          <Minus />
        </button>
        <button className="zoom-label" onClick={() => setManual(null)} title="Ajuster à la largeur">
          {Math.round(zoom * 100)} %
        </button>
        <button className="icon-btn" onClick={() => setManual(Math.min(2, zoom + 0.1))} aria-label="Agrandir">
          <Plus />
        </button>
        {footer}
      </div>
    </div>
  )
}
