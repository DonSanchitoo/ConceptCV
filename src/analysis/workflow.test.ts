import { describe, expect, it } from 'vitest'
import { tailor } from './tailor'
import { preflight } from './preflight'
import { applicationMail, followUpIcs, followUpMail, interviewDraft } from '../lib/kit'
import { newApplication, newCv, newLetter } from '../lib/factory'
import { sampleProfile } from '../templates/sample'
import { clone, formatDate, nowIso } from '../lib/util'

const JOB = `Nous recherchons un chef de projet digital pour piloter la refonte de notre site Shopify.
Vous animez une équipe en méthode Scrum et suivez le budget. Maîtrise de Shopify, de Scrum et de Figma exigée.
Expérience des tests utilisateurs et de Salesforce appréciée. Shopify, Scrum, Figma, budget.`

describe('assistant « Adapter à l’offre »', () => {
  const profile = sampleProfile()
  const base = () => newCv(profile, 'atlas', 'fr', 'CV')

  it('propose de reprendre le poste en titre et ne modifie rien tout seul', () => {
    const cv = base()
    const before = JSON.stringify(cv)
    const r = tailor(cv, profile, JOB, 'Chef de projet e-commerce')
    expect(r.proposals.some((p) => p.kind === 'headline')).toBe(true)
    expect(JSON.stringify(cv)).toBe(before)
    r.proposals.find((p) => p.kind === 'headline')!.apply(cv)
    expect(cv.basics.headline).toBe('Chef de projet e-commerce')
  })

  it('retrouve dans le profil ce que le CV a perdu', () => {
    const cv = base()
    const skills = cv.sections.find((s) => s.type === 'skills')!
    skills.items.find((i) => i.title === 'Design')!.tags = []
    const exp = cv.sections.find((s) => s.type === 'experience')!
    exp.items[0].bullets = exp.items[0].bullets.filter((b) => !b.includes('Budget'))
    exp.items[1].visible = false
    const r = tailor(cv, profile, JOB, '')
    const figma = r.proposals.find((p) => p.kind === 'add-skill' && p.title.includes('Figma'))
    const budget = r.proposals.find((p) => p.kind === 'add-bullet' && p.detail?.includes('Budget'))
    expect(figma).toBeTruthy()
    expect(budget).toBeTruthy()
    figma!.apply(cv)
    budget!.apply(cv)
    expect(skills.items.find((i) => i.title === 'Design')!.tags).toContain('Figma')
    expect(exp.items[0].bullets.some((b) => b.includes('Budget'))).toBe(true)
    expect(tailor(cv, profile, JOB, '').coverage).toBeGreaterThan(r.coverage)
  })

  it('signale ce que le profil ne contient pas, sans rien inventer', () => {
    const r = tailor(base(), profile, JOB, '')
    expect(r.unsourced.map((k) => k.term)).toContain('Salesforce')
    expect(r.proposals.some((p) => p.title.includes('Salesforce'))).toBe(false)
  })

  it('respecte les propositions ignorées', () => {
    const cv = base()
    const first = tailor(cv, profile, JOB, 'Autre poste').proposals
    cv.ignored = [first[0].id]
    expect(tailor(cv, profile, JOB, 'Autre poste').proposals.map((p) => p.id)).not.toContain(first[0].id)
  })
})

describe('contrôle avant envoi', () => {
  const profile = sampleProfile()
  const app = newApplication({ company: 'Maison Lumière', role: 'Cheffe de projet digital' })
  const other = newApplication({ company: 'Atelier Durand', role: 'Cheffe de projet' })
  const cv = newCv(profile, 'atlas', 'fr', 'CV')
  const clean = () => {
    const l = newLetter(profile, app, 'atlas', 'fr-offre', 'fr', 'Lettre')
    l.paragraphs.forEach((p, i) => (p.text = ['Votre annonce chez Maison Lumière m’intéresse.', 'J’ai obtenu 18 % de conversion en plus.', 'Votre projet me parle.', 'Parlons-en.'][i]))
    l.date = formatDate(nowIso(), 'fr')
    return l
  }
  const ids = (l = clean(), c = cv) => preflight(app, [other], c, l).map((x) => x.id)

  it('laisse passer un dossier cohérent', () => {
    expect(preflight(app, [other], cv, clean()).filter((c) => c.level === 'error' || c.level === 'warn')).toEqual([])
  })
  it('repère le nom d’un autre dossier resté dans la lettre', () => {
    const l = clean()
    l.paragraphs[2].text = 'Ce qui m’attire chez Atelier Durand, c’est votre atelier.'
    expect(ids(l)).toContain(`other-${other.id}`)
  })
  it('repère une date ancienne et sait la corriger', () => {
    const l = clean()
    l.date = '3 janvier 2020'
    const c = preflight(app, [other], cv, l).find((x) => x.id === 'date')!
    c.fix!.apply(cv, l)
    expect(l.date).toBe(formatDate(nowIso(), 'fr'))
  })
  it('compare l’identité et les chiffres entre CV et lettre', () => {
    const l = clean()
    l.sender.phone = '07 00 00 00 00'
    l.paragraphs[1].text = 'J’ai obtenu 42 % de conversion en plus.'
    const r = preflight(app, [other], cv, l)
    expect(r.find((x) => x.id === 'identity')?.title).toContain('téléphone')
    expect(r.find((x) => x.id === 'numbers')?.detail).toContain('42')
    r.find((x) => x.id === 'identity')!.fix!.apply(cv, l)
    expect(l.sender.phone).toBe(cv.basics.phone)
  })
  it('bloque sur les crochets restants', () => {
    const l = clone(clean())
    l.paragraphs[0].text = 'Je postule chez Maison Lumière depuis [durée].'
    expect(preflight(app, [other], cv, l).some((c) => c.level === 'error')).toBe(true)
  })
})

describe('kit d’envoi', () => {
  const profile = sampleProfile()
  const app = newApplication({ company: 'Maison Lumière', role: 'Cheffe de projet digital', appliedAt: '2026-11-02', followUpAt: '2026-11-14', contactName: 'Mme Roux' })
  it('rédige les mails sans tiret cadratin', () => {
    const m = [applicationMail(app, profile.basics, 'fr', true), followUpMail(app, profile.basics, 'fr'), applicationMail(app, profile.basics, 'en', false)]
    expect(m[0].body).toContain('Bonjour Mme Roux,')
    expect(m[0].body).toContain('lettre de motivation')
    expect(m[1].body).toContain('2 nov. 2026')
    expect(m.map((x) => x.subject + x.body).join('').includes(String.fromCharCode(0x2014))).toBe(false)
  })
  it('produit un rappel de calendrier valide', () => {
    const ics = followUpIcs(app)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261114')
    expect(ics).toContain('DTEND;VALUE=DATE:20261115')
    expect(ics).toContain('SUMMARY:Relancer Maison Lumière (Cheffe de projet digital)')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  })
  it('prépare un canevas d’entretien depuis l’offre et le CV', () => {
    const iv = interviewDraft({ ...app, jobText: JOB }, newCv(profile, 'atlas', 'fr', 'CV'))
    expect(iv.questions.some((q) => q.q.includes('Shopify'))).toBe(true)
    expect(iv.stories.length).toBeGreaterThan(0)
    expect(iv.people).toBe('Mme Roux')
  })
})
