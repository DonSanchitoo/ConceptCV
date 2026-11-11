import type { Lang, SectionType } from '../types'

export interface Guide {
  intro: string
  tips: string[]
  example?: string
}

/* Conseils affichés à chaque étape de la conception du CV. */
export const BASICS_GUIDE: Guide = {
  intro: 'Le recruteur doit pouvoir vous joindre en dix secondes, et un ATS doit retrouver ces champs sans se tromper.',
  tips: [
    'Titre du CV : reprenez l’intitulé exact du poste visé.',
    'Ville et code postal suffisent, l’adresse complète n’est plus attendue.',
    'Une adresse e-mail du type prenom.nom@…',
    'Âge, situation familiale et nationalité ne sont pas à indiquer.',
    'La photo est facultative en France, déconseillée pour le Royaume-Uni et l’Amérique du Nord.',
  ],
}

export const SECTION_GUIDES: Record<SectionType, Guide> = {
  summary: {
    intro: 'Deux ou trois phrases lues avant tout le reste : elles disent qui vous êtes et ce que vous apportez.',
    tips: ['Métier + années d’expérience ou spécialité.', 'Votre meilleur résultat, chiffré si possible.', 'Ce que vous cherchez, en lien avec le poste.', '30 à 60 mots. Pas de liste de qualités.'],
    example: 'Géomaticien, trois ans d’expérience en développement d’outils SIG. J’ai divisé par deux les temps de traitement de mon équipe grâce à des flux Python/SQL. Je cherche un poste où mettre ces compétences au service de l’aménagement du territoire.',
  },
  experience: {
    intro: 'La rubrique la plus lue. De la plus récente à la plus ancienne, avec des résultats plutôt que des tâches.',
    tips: [
      'Une puce = une action + un résultat. « Automatisé le tracé de 3 000 itinéraires par an : 30 min au lieu d’une journée. »',
      'Commencez par le fait ou par un verbe d’action, jamais par « Responsable de ».',
      'Un chiffre sur une puce sur trois, au minimum : volume, délai, budget, taille d’équipe.',
      '3 à 6 puces pour le poste actuel, 1 à 3 pour les plus anciens.',
      'Reprenez les mots de l’offre quand ils décrivent vraiment ce que vous avez fait.',
    ],
  },
  education: {
    intro: 'Du diplôme le plus élevé au plus ancien. Après quelques années d’expérience, une ligne par diplôme suffit.',
    tips: ['Intitulé exact du diplôme, établissement, année.', 'Mention, classement ou spécialité s’ils vous servent.', 'Le baccalauréat disparaît dès que vous avez un bac+3.'],
  },
  skills: {
    intro: 'C’est ici que les ATS cherchent leurs mots-clés. Soyez précis et regroupez par famille.',
    tips: ['Des noms d’outils et de méthodes, pas des généralités : « PostgreSQL/PostGIS » plutôt que « bases de données ».', '8 à 15 compétences, celles de l’offre en premier.', 'Les jauges de niveau sont jolies mais illisibles pour un ATS : préférez la liste.'],
  },
  languages: {
    intro: 'Un niveau vérifiable vaut mieux qu’un adjectif.',
    tips: ['Utilisez l’échelle européenne (A2 à C2) ou un score (TOEIC 900).', 'Précisez le contexte si la langue est utilisée au travail.'],
  },
  interests: {
    intro: 'Facultatif. Utile si cela dit quelque chose de vous ou ouvre la conversation en entretien.',
    tips: ['Soyez précis : « randonnée itinérante, GR20 » plutôt que « sport ».', 'Trois ou quatre éléments au maximum.'],
  },
  projects: {
    intro: 'Projets personnels, associatifs ou d’études qui prouvent une compétence absente de vos postes.',
    tips: ['Nom du projet, votre rôle, le résultat.', 'Un lien si le projet est consultable.'],
  },
  certifications: { intro: 'Certifications reconnues dans votre métier.', tips: ['Intitulé exact, organisme, année.', 'Retirez celles qui ont expiré.'] },
  awards: { intro: 'Prix, concours, classements.', tips: ['Précisez le contexte : nombre de candidats, niveau.'] },
  volunteering: { intro: 'Engagements associatifs : à traiter comme une expérience.', tips: ['Rôle, association, durée, résultat.'] },
  publications: { intro: 'Articles, communications, brevets.', tips: ['Titre, support, année.'] },
  references: { intro: 'En France, « Références sur demande » suffit, ou rien du tout.', tips: ['Ne donnez un nom qu’avec l’accord de la personne.'] },
  strengths: {
    intro: 'Les qualités humaines comptent, à condition d’être crédibles.',
    tips: ['Quatre au maximum.', 'Gardez celles que vos expériences illustrent déjà.'],
  },
  custom: { intro: 'Une rubrique à vous : donnez-lui un titre clair.', tips: ['Si un ATS doit la lire, évitez les intitulés trop originaux.'] },
}

export const ACTION_VERBS: Record<Lang, string[]> = {
  fr: ['Conçu', 'Développé', 'Automatisé', 'Piloté', 'Déployé', 'Réduit', 'Augmenté', 'Négocié', 'Formé', 'Encadré', 'Analysé', 'Structuré', 'Lancé', 'Optimisé', 'Fiabilisé', 'Livré', 'Coordonné', 'Créé', 'Géré', 'Animé'],
  en: ['Built', 'Designed', 'Automated', 'Led', 'Delivered', 'Reduced', 'Increased', 'Negotiated', 'Trained', 'Managed', 'Analysed', 'Launched', 'Improved', 'Streamlined', 'Shipped', 'Coordinated', 'Created', 'Drove', 'Scaled', 'Secured'],
}

export const ITEM_LABELS: Partial<Record<SectionType, { title: string; subtitle: string }>> = {
  experience: { title: 'Poste', subtitle: 'Employeur' },
  education: { title: 'Diplôme', subtitle: 'Établissement' },
  projects: { title: 'Projet', subtitle: 'Contexte ou rôle' },
  certifications: { title: 'Certification', subtitle: 'Organisme' },
  awards: { title: 'Distinction', subtitle: 'Organisme' },
  volunteering: { title: 'Rôle', subtitle: 'Association' },
  publications: { title: 'Titre', subtitle: 'Support' },
  references: { title: 'Nom', subtitle: 'Fonction, entreprise' },
  custom: { title: 'Intitulé', subtitle: 'Précision' },
}
