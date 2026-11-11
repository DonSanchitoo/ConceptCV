import type { Profile } from '../types'
import { emptyBasics, newItem, newSection } from '../lib/util'

/** Profil fictif : sert uniquement à illustrer les modèles tant que le vrai profil est vide. */
export const sampleProfile = (): Profile => ({
  signature: 'Camille Martin',
  basics: {
    ...emptyBasics(),
    firstName: 'Camille',
    lastName: 'Martin',
    headline: 'Cheffe de projet digital',
    email: 'camille.martin@exemple.fr',
    phone: '06 12 34 56 78',
    postalCode: '69003',
    city: 'Lyon',
    linkedin: 'linkedin.com/in/camille-martin',
    extra: 'Permis B',
  },
  sections: [
    newSection('summary', 'fr', {
      text: 'Cheffe de projet digital, six ans d’expérience en e-commerce. J’ai piloté la refonte d’un site à 2 M€ de chiffre d’affaires et fait progresser sa conversion de 18 %. Je cherche un poste où conduire des projets de bout en bout.',
    }),
    newSection('experience', 'fr', {
      items: [
        newItem({
          title: 'Cheffe de projet digital', subtitle: 'Maison Lumière', location: 'Lyon', start: 'mars 2022', end: "aujourd'hui",
          bullets: ['Refonte du site marchand livrée en 7 mois : +18 % de conversion, −30 % de temps de chargement.', 'Coordination de 9 personnes (design, développement, logistique) en méthode agile.', 'Budget annuel de 350 k€ tenu trois années de suite.'],
        }),
        newItem({
          title: 'Chargée de projet web', subtitle: 'Agence Trait d’Union', location: 'Paris', start: 'sept. 2019', end: 'févr. 2022',
          bullets: ['12 sites livrés pour des PME, de l’atelier de cadrage à la mise en ligne.', 'Mise en place d’un suivi qualité : retours clients divisés par deux.'],
        }),
      ],
    }),
    newSection('education', 'fr', {
      items: [newItem({ title: 'Master Management de projet digital', subtitle: 'IAE Lyon', start: '2017', end: '2019' }), newItem({ title: 'Licence Information-communication', subtitle: 'Université Lumière Lyon 2', start: '2014', end: '2017' })],
    }),
    newSection('skills', 'fr', {
      items: [
        newItem({ title: 'Gestion de projet', tags: ['Scrum', 'Kanban', 'Jira', 'Notion'], level: 5 }),
        newItem({ title: 'E-commerce', tags: ['Shopify', 'Prestashop', 'Google Analytics'], level: 4 }),
        newItem({ title: 'Design', tags: ['Figma', 'tests utilisateurs'], level: 3 }),
      ],
    }),
    newSection('languages', 'fr', { items: [newItem({ title: 'Anglais', subtitle: 'C1', level: 4 }), newItem({ title: 'Espagnol', subtitle: 'B1', level: 2 })] }),
    newSection('interests', 'fr', { items: [newItem({ title: 'Trail' }), newItem({ title: 'Photographie argentique' }), newItem({ title: 'Bénévolat' })] }),
  ],
})
