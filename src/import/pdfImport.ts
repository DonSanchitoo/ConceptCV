import { parseCv, type ParsedCv, type Seg } from './parseCv'

/** Lit un CV au format PDF dans le navigateur (rien n'est envoyé nulle part) et en déduit un profil. */
export const importPdf = async (file: File): Promise<ParsedCv> => {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const segs: Seg[] = []
  let width = 595
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    width = page.getViewport({ scale: 1 }).width
    const content = await page.getTextContent()
    for (const it of content.items) {
      if (!('str' in it) || (!it.str.trim() && !(it.str === '' && it.width > 0.5))) continue
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10
      segs.push({ text: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size, page: p })
    }
  }
  if (segs.length < 5) throw new Error('Ce PDF ne contient pas de texte lisible (document scanné ?).')
  return parseCv(segs, width)
}
