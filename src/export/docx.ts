import type { CvDoc, Item, LetterDoc, Section } from '../types'
import { fontDocx } from '../templates/cvTemplates'
import { COMPACT_TYPES, cityLine, dateRange, fullName } from '../lib/util'
import { contactEntries } from '../render/shared'

const hex = (c: string) => c.replace('#', '').toUpperCase()

/**
 * Export Word : toujours sur une colonne, sans tableau ni zone de texte, avec de vrais styles de titre.
 * C'est le format que les ATS lisent le mieux, et il reste entièrement modifiable dans Word.
 */
export const cvToDocx = async (cv: CvDoc): Promise<Blob> => {
  const { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TabStopType, TextRun, convertMillimetersToTwip } = await import('docx')
  const d = cv.design
  const body = fontDocx(d.fontBody)
  const head = fontDocx(d.fontHeading)
  const size = Math.round(d.fontSize * 2 + 1)
  const accent = hex(d.accent)
  const muted = hex(d.muted)
  const margin = convertMillimetersToTwip(18)
  const contentWidth = convertMillimetersToTwip(210 - 36)
  const run = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: body, size, ...o })
  const center = d.header === 'center'
  const out: InstanceType<typeof Paragraph>[] = []

  out.push(
    new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: d.uppercaseName ? fullName(cv.basics).toUpperCase() : fullName(cv.basics), font: head, size: Math.round(d.nameSize * 2 * 0.85), bold: true })],
    }),
  )
  if (cv.basics.headline)
    out.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 60 }, children: [run(cv.basics.headline, { color: accent, bold: true, size: size + 4 })] }))
  const contacts = contactEntries(cv.basics).map((c) => c.text)
  if (contacts.length)
    out.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 120 }, children: [run(contacts.join('  |  '), { color: muted, size: size - 1 })] }))

  const heading = (s: Section) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
      children: [new TextRun({ text: s.title.toUpperCase(), font: head, size: size + 2, bold: true, color: accent })],
    })

  const entry = (i: Item) => {
    const dates = dateRange(i)
    out.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 100 },
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
        children: [run(i.title, { bold: true, size: size + 1 }), ...(dates ? [run(`\t${dates}`, { color: muted })] : [])],
      }),
    )
    if (i.subtitle || i.location) out.push(new Paragraph({ keepNext: true, children: [run([i.subtitle, i.location].filter(Boolean).join(' · '), { color: accent })] }))
    if (i.description) out.push(new Paragraph({ spacing: { before: 40 }, children: [run(i.description)] }))
    for (const b of i.bullets) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { before: 30 }, children: [run(b)] }))
    if (i.tags.length) out.push(new Paragraph({ spacing: { before: 30 }, children: [run(i.tags.join(', '), { color: muted })] }))
  }

  for (const id of [...cv.main, ...cv.side]) {
    const s = cv.sections.find((x) => x.id === id)
    if (!s || !s.visible) continue
    const items = s.items.filter((i) => i.visible)
    if (s.type === 'summary') {
      if (!s.text) continue
      out.push(heading(s), new Paragraph({ children: [run(s.text)] }))
      continue
    }
    if (!items.length) continue
    out.push(heading(s))
    if (COMPACT_TYPES.includes(s.type)) {
      const simple = items.every((i) => !i.tags.length && !i.subtitle)
      if (simple) out.push(new Paragraph({ children: [run(items.map((i) => i.title).join(' · '))] }))
      else
        for (const i of items) {
          const detail = i.tags.length ? i.tags.join(', ') : i.subtitle
          out.push(new Paragraph({ spacing: { before: 30 }, children: [run(i.title, { bold: true }), ...(detail ? [run(` : ${detail}`)] : [])] }))
        }
    } else items.forEach(entry)
  }

  const doc = new Document({
    creator: fullName(cv.basics),
    title: `CV ${fullName(cv.basics)}`,
    styles: { default: { document: { run: { font: body, size, color: hex(d.text) }, paragraph: { spacing: { line: Math.round(d.lineHeight * 240 * 0.9) } } } } },
    sections: [{ properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children: out }],
  })
  return Packer.toBlob(doc)
}

export const letterToDocx = async (l: LetterDoc): Promise<Blob> => {
  const { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun, convertMillimetersToTwip } = await import('docx')
  const d = l.design
  const body = fontDocx(d.fontBody)
  const size = Math.round(d.fontSize * 2 + 2)
  const accent = hex(d.accent)
  const run = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: body, size, ...o })
  const p = (text: string, o: Record<string, unknown> = {}, ro: Record<string, unknown> = {}) => new Paragraph({ ...o, children: [run(text, ro)] })
  const indent = { left: convertMillimetersToTwip(l.lang === 'fr' ? 95 : 0) }
  const right = l.lang === 'fr' ? AlignmentType.RIGHT : AlignmentType.LEFT
  const r = l.recipient
  const out = [
    p(fullName(l.sender), {}, { bold: true, size: size + 6, font: fontDocx(d.fontHeading), color: accent }),
    ...contactEntries(l.sender).map((c) => p(c.text, {}, { color: hex(d.muted), size: size - 2 })),
    p('', { spacing: { after: 200 } }),
    ...[r.company, r.contact, r.title, r.address, cityLine(r)].filter(Boolean).map((t, i) => p(t, { indent }, { bold: i === 0 })),
    p([l.place, l.date].filter(Boolean).join(l.lang === 'fr' ? ', le ' : ', '), { alignment: right, spacing: { before: 360, after: 360 } }),
    ...(l.subject ? [new Paragraph({ spacing: { after: 80 }, children: [run(`${l.lang === 'fr' ? 'Objet' : 'Subject'} : `, { bold: true, color: accent }), run(l.subject, { bold: true })] })] : []),
    ...(l.reference ? [p(`${l.lang === 'fr' ? 'Réf.' : 'Ref.'} : ${l.reference}`)] : []),
    p(l.greeting, { spacing: { before: 320, after: 200 } }),
    ...l.paragraphs.filter((x) => x.text.trim()).map((x) => p(x.text, { alignment: AlignmentType.JUSTIFIED, spacing: { after: 180 } })),
    p(l.closing, { spacing: { before: 80, after: l.sig ? 160 : 480 } }),
    ...(l.sig && l.sig.src.startsWith('data:image/png')
      ? [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                type: 'png',
                data: Uint8Array.from(atob(l.sig.src.split(',')[1]), (c) => c.charCodeAt(0)),
                transformation: { width: Math.round(l.sig.w * 3.78), height: Math.round(l.sig.w * l.sig.ratio * 3.78) },
              }),
            ],
          }),
        ]
      : []),
    p(l.signature, { alignment: AlignmentType.RIGHT }, { bold: true }),
  ]
  const margin = convertMillimetersToTwip(22)
  const doc = new Document({
    creator: fullName(l.sender),
    title: l.subject || 'Lettre de motivation',
    styles: { default: { document: { run: { font: body, size, color: hex(d.text) }, paragraph: { spacing: { line: 300 } } } } },
    sections: [{ properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children: out }],
  })
  return Packer.toBlob(doc)
}
