import { describe, expect, it } from 'vitest'
import { parseCv, type Seg } from './parseCv'

/* CV fictif sur deux colonnes : colonne latérale à gauche (x = 30), contenu à droite (x = 220). */
const line = (text: string, x: number, y: number, size = 10): Seg => ({ text, x, y, w: text.length * size * 0.5, size, page: 1 })
const two = (left: string, right: string, y: number): Seg[] => [line(left, 220, y), { ...line(right, 470, y), w: right.length * 4.2 }]

const SEGS: Seg[] = [
  line('Cheffe de projet digital', 220, 790, 20),
  line('MARTIN Camille', 220, 770, 11),
  line('Six ans d’expérience en e-commerce, spécialiste des refontes de sites marchands.', 220, 750),
  line('CONTACT', 30, 750),
  line('Lyon (69)', 30, 735),
  line('06 12 34 56 78', 30, 722),
  line('camille.martin@exemple.fr', 30, 709),
  line('COMPÉTENCES', 30, 680),
  line('Gestion de projet', 30, 665),
  line('Scrum, Kanban,', 30, 652),
  line('Jira', 30, 639),
  line('E-commerce', 30, 620),
  line('Shopify, Prestashop', 30, 607),
  line('LANGUES', 30, 580),
  line('Anglais C1', 30, 565),
  line('Espagnol B1', 30, 552),
  line('EXPÉRIENCE PROFESSIONNELLE', 220, 720),
  ...two('Cheffe de projet digital', 'mars 2022 – aujourd’hui', 705),
  line('Maison Lumière · Lyon', 220, 692),
  line('Refonte du site livrée en 7 mois :', 232, 676),
  line('+18 % de conversion.', 232, 664),
  line('Coordination de 9 personnes.', 232, 646),
  ...two('Chargée de projet web', 'sept. 2019 – févr. 2022', 620),
  line('Agence Trait d’Union · Paris', 220, 607),
  line('12 sites livrés pour des PME.', 232, 591),
  line('FORMATION', 220, 560),
  ...two('Master Management de projet digital', '2017 – 2019', 545),
  line('IAE Lyon', 220, 532),
]

describe('import de CV', () => {
  const r = parseCv(SEGS, 595)
  const sec = (t: string) => r.sections.find((s) => s.type === t)!

  it('retrouve les coordonnées', () => {
    expect(r.basics.firstName).toBe('Camille')
    expect(r.basics.lastName).toBe('Martin')
    expect(r.basics.headline).toBe('Cheffe de projet digital')
    expect(r.basics.email).toBe('camille.martin@exemple.fr')
    expect(r.basics.phone).toBe('06 12 34 56 78')
    expect(r.basics.city).toBe('Lyon (69)')
  })
  it('sépare les deux colonnes et reconnaît les rubriques', () => {
    expect(r.sections.map((s) => s.type)).toEqual(['summary', 'experience', 'education', 'skills', 'languages'])
    expect(sec('summary').text).toContain('Six ans')
  })
  it('découpe les expériences, leurs dates et leurs puces', () => {
    const [a, b] = sec('experience').items
    expect(a).toMatchObject({ title: 'Cheffe de projet digital', subtitle: 'Maison Lumière', location: 'Lyon', start: 'mars 2022' })
    expect(a.bullets).toEqual(['Refonte du site livrée en 7 mois : +18 % de conversion.', 'Coordination de 9 personnes.'])
    expect(b).toMatchObject({ title: 'Chargée de projet web', start: 'sept. 2019', end: 'févr. 2022' })
    expect(sec('education').items[0]).toMatchObject({ title: 'Master Management de projet digital', subtitle: 'IAE Lyon', start: '2017', end: '2019' })
  })
  it('regroupe les compétences par famille et lit les niveaux de langue', () => {
    expect(sec('skills').items.map((i) => [i.title, i.tags])).toEqual([
      ['Gestion de projet', ['Scrum', 'Kanban', 'Jira']],
      ['E-commerce', ['Shopify', 'Prestashop']],
    ])
    expect(sec('languages').items.map((i) => [i.title, i.subtitle])).toEqual([['Anglais', 'C1'], ['Espagnol', 'B1']])
  })
  it('rétablit les signes que le PDF ne déclare pas', () => {
    const odd = parseCv([...SEGS.filter((s) => s.text !== 'Lyon (69)'), line('Lyon ' + '69', 30, 735)], 595)
    expect(odd.basics.city).toBe('Lyon (69)')
  })
})
