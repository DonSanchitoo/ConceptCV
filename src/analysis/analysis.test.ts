import { describe, expect, it } from 'vitest'
import { extractKeywords, matchKeywords, stem, detectLang, cvPlainText } from './keywords'
import { analyzeCv } from './ats'
import { analyzeLetter } from './coach'
import { newCv, newLetter, newApplication } from '../lib/factory'
import { sampleProfile } from '../templates/sample'
import { CV_TEMPLATES } from '../templates/cvTemplates'
import { CLOSINGS, GREETINGS, LETTER_MODELS, ROLE_GUIDES } from '../templates/letterModels'

const JOB = `Nous recherchons un chef de projet digital pour piloter la refonte de notre site e-commerce Shopify.
Vous animez une équipe en méthode Scrum, suivez le budget et analysez la conversion avec Google Analytics.
Maîtrise de Shopify et de Scrum exigée. Anglais courant. Expérience en e-commerce indispensable. Connaissance de Salesforce appréciée.`

describe('mots-clés', () => {
  it('rapproche singulier et pluriel', () => {
    expect(stem('itinéraires')).toBe(stem('itinéraire'))
    expect(stem('Projects')).toBe(stem('project'))
  })
  it('extrait les termes saillants et ignore les mots vides', () => {
    const terms = extractKeywords(JOB).map((k) => k.term.toLowerCase())
    expect(terms).toContain('shopify')
    expect(terms).toContain('scrum')
    expect(terms).not.toContain('nous')
    expect(terms).not.toContain('recherchons')
  })
  it('mesure la couverture par un CV', () => {
    const cv = newCv(sampleProfile(), 'atlas', 'fr', 'CV')
    const { matches, coverage } = matchKeywords(extractKeywords(JOB), cvPlainText(cv))
    expect(matches.find((m) => m.keyword.term === 'Shopify')?.found).toBe(true)
    expect(matches.find((m) => m.keyword.term === 'Salesforce')?.found).toBe(false)
    expect(coverage).toBeGreaterThan(30)
    expect(coverage).toBeLessThan(100)
  })
  it('détecte la langue', () => {
    expect(detectLang(JOB)).toBe('fr')
    expect(detectLang('We are looking for a project manager who will lead the team and report to the board.')).toBe('en')
  })
})

describe('analyse ATS', () => {
  it('note bien un CV complet sur une colonne', () => {
    const r = analyzeCv(newCv(sampleProfile(), 'atlas', 'fr', 'CV'), '', 1)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.checks.find((c) => c.id === 'layout')?.level).toBe('ok')
  })
  it('signale les colonnes, les jauges et les champs manquants', () => {
    const cv = newCv(sampleProfile(), 'graphite', 'fr', 'CV')
    cv.basics.email = ''
    const r = analyzeCv(cv, '', 3)
    const level = (id: string) => r.checks.find((c) => c.id === id)?.level
    expect(level('layout')).toBe('warn')
    expect(level('levels')).toBe('warn')
    expect(level('email')).toBe('error')
    expect(level('pages')).toBe('error')
  })
  it("tient compte de l'offre dans le score", () => {
    const cv = newCv(sampleProfile(), 'atlas', 'fr', 'CV')
    const r = analyzeCv(cv, JOB, 1)
    expect(r.coverage).not.toBeNull()
    expect(r.matches.length).toBeGreaterThan(5)
  })
})

describe('coach de lettre', () => {
  const app = newApplication({ company: 'Maison Lumière', role: 'Cheffe de projet digital' })
  it('repère les crochets à compléter et les formules creuses', () => {
    const l = newLetter(sampleProfile(), app, 'atlas', 'fr-offre', 'fr', 'Lettre')
    const r = analyzeLetter(l, 1, app.company, app.role)
    expect(r.advices.some((a) => a.id === 'holes')).toBe(true)
    l.paragraphs[0].text = 'Je me permets de vous écrire car je suis dynamique et motivé.'
    const r2 = analyzeLetter(l, 1, app.company, app.role)
    expect(r2.byParagraph[l.paragraphs[0].id].some((a) => a.level === 'warn')).toBe(true)
  })
  it('accepte une lettre propre', () => {
    const l = newLetter(sampleProfile(), app, 'atlas', 'fr-offre', 'fr', 'Lettre')
    const texts = [
      'Votre annonce pour le poste de Cheffe de projet digital décrit la refonte de votre site marchand. C’est le travail que je mène depuis trois ans.',
      'Chez mon employeur actuel, j’ai livré la refonte du site en 7 mois, avec 18 % de conversion en plus. J’ai aussi coordonné 9 personnes et tenu un budget de 350 000 euros trois années de suite. Ces projets m’ont appris à arbitrer vite entre délais, coûts et qualité.',
      'Ce qui m’attire chez Maison Lumière, c’est votre choix de fabriquer en France et de vendre en direct. Votre équipe pourrait compter sur moi pour le lancement de la nouvelle boutique, puis pour l’ouverture à l’international que vous préparez.',
      'Votre calendrier me convient : nous pourrions en parler lors d’un entretien dès la semaine prochaine.',
    ]
    l.paragraphs.forEach((p, i) => (p.text = texts[i]))
    l.recipient.company = 'Maison Lumière'
    const r = analyzeLetter(l, 1, app.company, app.role)
    expect(r.advices.filter((a) => a.level === 'error')).toEqual([])
    expect(r.score).toBeGreaterThanOrEqual(80)
  })
})

describe('banques de modèles', () => {
  it('propose 30 modèles de CV aux identifiants uniques', () => {
    expect(CV_TEMPLATES).toHaveLength(30)
    expect(new Set(CV_TEMPLATES.map((t) => t.id)).size).toBe(30)
  })
  it('ne contient aucun tiret cadratin', () => {
    const texts = [
      ...LETTER_MODELS.flatMap((m) => [m.name, m.when, m.subject, ...m.paragraphs.map((p) => p.text)]),
      ...Object.values(GREETINGS).flat(),
      ...Object.values(CLOSINGS).flat(),
      ...Object.values(ROLE_GUIDES).flatMap((g) => Object.values(g).flatMap((r) => [r.label, r.goal, ...r.tips, ...r.starters])),
      ...CV_TEMPLATES.flatMap((t) => [t.name, t.tagline]),
      cvPlainText(newCv(sampleProfile(), 'atlas', 'fr', 'CV')),
    ]
    expect(texts.filter((t) => t.includes('\u2014'))).toEqual([])
  })
  it('propose 30 modèles de lettres, chacun en quatre temps', () => {
    expect(LETTER_MODELS).toHaveLength(30)
    expect(new Set(LETTER_MODELS.map((m) => m.id)).size).toBe(30)
    for (const m of LETTER_MODELS) expect(m.paragraphs.map((p) => p.role)).toEqual(['hook', 'me', 'you', 'closing'])
  })
})
