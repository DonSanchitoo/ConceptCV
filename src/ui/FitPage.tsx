import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const PAGE_PX = (210 * 96) / 25.4

/** Réduit une page A4 à la largeur de son cadre, quelle que soit la taille de l'écran. */
export const FitPage = ({ className, children }: { className: string; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.2394)
  useLayoutEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    const update = () => host.clientWidth && setZoom(host.clientWidth / PAGE_PX)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ zoom }}>
      {children}
    </div>
  )
}
