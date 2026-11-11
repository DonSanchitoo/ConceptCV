import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let root: Root | null = null

/**
 * Export PDF par le moteur d'impression du navigateur : texte réel et sélectionnable, polices intégrées,
 * rendu identique à l'aperçu. Dans la boîte de dialogue, choisir « Enregistrer au format PDF ».
 */
export const printNode = async (node: ReactNode, title: string, format: 'A4' | 'Letter') => {
  const host = document.getElementById('print-root')!
  root?.unmount()
  root = createRoot(host)
  root.render(node)
  let style = document.getElementById('print-page') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'print-page'
    document.head.appendChild(style)
  }
  style.textContent = `@media print { @page { size: ${format === 'Letter' ? 'letter' : 'A4'}; margin: 0; } }`
  // Laisse le temps à la pagination et aux polices de se stabiliser.
  await document.fonts?.ready
  await new Promise((r) => setTimeout(r, 350))
  await document.fonts?.ready
  const previous = document.title
  document.title = title
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  setTimeout(restore, 60000)
  window.print()
}
