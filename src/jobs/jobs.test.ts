// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { extractJob, parseFeed, parseFranceTravail, parseListPage, splitTitle } from './parse'
import { scoreOffers, type Place } from './score'
import { bookmarklet, emptyQuery, fillUrl } from './search'
import { sampleProfile } from '../templates/sample'

const today = new Date().toUTCString()
const old = new Date(Date.now() - 90 * 86400000).toUTCString()

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Offres</title>
<item><title>Cheffe de projet digital (H/F) - Lyon (69)</title><link>https://exemple.fr/offre/1</link><description><![CDATA[<p>Refonte d'un site <b>Shopify</b> en méthode Scrum.</p>]]></description><pubDate>${today}</pubDate><dc:creator>Maison Lumière</dc:creator></item>
<item><title>Comptable confirmé - Lille</title><link>https://exemple.fr/offre/2</link><description>Tenue des comptes.</description><pubDate>${today}</pubDate></item>
<item><title>Chef de projet digital - Marseille</title><link>https://exemple.fr/offre/3</link><description>Stage de six mois.</description><pubDate>${old}</pubDate></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Chargé de mission SIG</title><link href="https://exemple.org/a/9"/><summary>QGIS et PostGIS.</summary><updated>2026-11-01T10:00:00Z</updated><author><name>Département</name></author></entry></feed>`

const LYON: Place = { label: 'Lyon (69)', kind: 'commune', insee: '69123', city: 'Lyon', deptCodes: ['69'], regionCode: '84', names: ['Lyon', 'Rhône'] }

describe('lecture des sources', () => {
  it('lit un flux RSS', () => {
    const o = parseFeed(RSS, 'Test')
    expect(o).toHaveLength(3)
    expect(o[0]).toMatchObject({ title: 'Cheffe de projet digital (H/F) - Lyon (69)', url: 'https://exemple.fr/offre/1', company: 'Maison Lumière', source: 'Test' })
    expect(o[0].text).toBe("Refonte d'un site Shopify en méthode Scrum.")
    expect(o[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
  it('lit un flux Atom', () => {
    expect(parseFeed(ATOM, 'Test')[0]).toMatchObject({ title: 'Chargé de mission SIG', url: 'https://exemple.org/a/9', company: 'Département' })
  })
  it('repère les liens d’offres dans une page quelconque', () => {
    const html = `<html><body><nav><a href="/">Accueil du site emploi</a></nav><ul>
      <li><a href="/offres/12">Technicien SIG à Nîmes</a><span>Mairie de Nîmes</span><time datetime="2026-11-02">2 nov.</time></li>
      <li><a href="offres/13">Voir plus</a></li><li><a href="/offres/12">Technicien SIG à Nîmes</a></li></ul></body></html>`
    const o = parseListPage(html, 'https://site.fr/emploi/', 'Site')
    expect(o).toHaveLength(1)
    expect(o[0].url).toBe('https://site.fr/offres/12')
    expect(o[0].text).toContain('Mairie de Nîmes')
    expect(o[0].date).toContain('2026-11-02')
  })
  it('lit les données structurées d’une annonce', () => {
    const html = `<html><head><title>x</title><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"JobPosting","title":"Géomaticien","hiringOrganization":{"name":"Gard Tourisme"},"jobLocation":{"address":{"addressLocality":"Nîmes","postalCode":"30000"}},"description":"<p>QGIS</p><p>PostGIS</p>","datePosted":"2026-11-03","employmentType":"FULL_TIME"}]}</script></head><body></body></html>`
    expect(extractJob(html, 'https://www.site.fr/o/1')).toMatchObject({ title: 'Géomaticien', company: 'Gard Tourisme', location: 'Nîmes 30000', text: 'QGIS\nPostGIS', source: 'site.fr' })
  })
  it('se rabat sur le titre et le texte de la page', () => {
    const o = extractJob('<html><head><title>Chargé de mission SIG - Département du Gard | Emploi</title></head><body><nav>menu</nav><main><h1>Chargé de mission SIG</h1><p>Vos missions : cartographie.</p></main></body></html>', 'https://site.fr/x')
    expect(o).toMatchObject({ title: 'Chargé de mission SIG', company: 'Département du Gard' })
    expect(o.text).toContain('cartographie')
    expect(o.text).not.toContain('menu')
    expect(splitTitle('Data analyst chez Acme')).toEqual({ role: 'Data analyst', company: 'Acme' })
  })
  it('convertit les offres France Travail', () => {
    const o = parseFranceTravail([{ id: '123ABC', intitule: 'Géomaticien', description: 'SIG', dateCreation: '2026-11-01T08:00:00.000Z', lieuTravail: { libelle: '30 - NIMES' }, entreprise: { nom: 'CD30' }, typeContratLibelle: 'CDI' }], 'France Travail')
    expect(o[0]).toMatchObject({ title: 'Géomaticien', company: 'CD30', location: '30 - NIMES', contract: 'CDI', url: 'https://candidat.francetravail.fr/offres/recherche/detail/123ABC' })
  })
})

describe('notation des offres', () => {
  const profile = sampleProfile()
  const raw = parseFeed(RSS, 'Test')
  const q = { ...emptyQuery(), keywords: 'chef de projet digital', place: 'Lyon' }
  const run = (query = q) => scoreOffers(raw, query, LYON, profile, () => true)

  it('classe la meilleure offre en tête et écarte le hors-sujet et le trop ancien', () => {
    const r = run()
    expect(r.map((o) => o.url)).toEqual(['https://exemple.fr/offre/1'])
    expect(r[0].score).toBeGreaterThan(45)
    expect(r[0].inPlace).toBe(true)
    expect(r[0].reasons.join(' ')).toContain('Shopify')
  })
  it('respecte les exclusions et la zone stricte', () => {
    const wide = { ...q, maxDays: 0 }
    expect(run(wide).map((o) => o.url)).toContain('https://exemple.fr/offre/3')
    expect(run({ ...wide, exclude: 'stage' }).map((o) => o.url)).not.toContain('https://exemple.fr/offre/3')
    expect(run({ ...wide, strictPlace: true }).map((o) => o.url)).toEqual(['https://exemple.fr/offre/1'])
  })
  it('dédoublonne une même annonce', () => {
    expect(scoreOffers([...raw, { ...raw[0], url: 'https://exemple.fr/offre/1?utm=x' }], q, LYON, profile, () => true)).toHaveLength(1)
  })
})

describe('liens et signet', () => {
  it('remplit les modèles d’adresse', () => {
    expect(fillUrl('https://s.fr/?q={q}&l={lieu}&d={dept}', { ...emptyQuery(), keywords: 'chef de projet' }, LYON)).toBe('https://s.fr/?q=chef%20de%20projet&l=Lyon&d=69')
  })
  it('produit un signet qui renvoie vers l’application', () => {
    const b = bookmarklet('https://exemple.github.io/ConceptCV/')
    expect(b.startsWith('javascript:')).toBe(true)
    expect(b).toContain('"https://exemple.github.io/ConceptCV/"+\'#/capture?u=\'')
  })
})
