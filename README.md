# ConceptCV

Atelier privé de CV et de lettres de motivation. Une application web sans serveur ni compte : les données restent dans le navigateur et dans un dossier iCloud que vous choisissez.

## Ce que fait l'outil

- **Dossiers de candidature** : un dossier par entreprise (poste, lieu, annonce, contact, statut, journal, date de relance), en grille ou en tableau de suivi par glisser-déposer. Chaque dossier contient autant de CV, lettres, analyses et notes que nécessaire.
- **Profil commun** : coordonnées, expériences, formations, compétences. Un CV existant en PDF peut le pré-remplir (lecture locale). Chaque nouveau CV part du profil, puis s'adapte à l'offre sans le modifier.
- **Concepteur de CV** : 30 modèles, parcours guidé rubrique par rubrique avec conseils, édition directe dans l'aperçu, pagination A4 réelle, réglage des couleurs, polices, marges, colonnes, en-tête, style des titres, affichage des compétences. Les rubriques se réordonnent et changent de colonne par glisser-déposer.
- **Analyse ATS** : score, contrôle de la structure (colonnes, intitulés, dates, jauges), des coordonnées, de la rédaction (puces sans résultat, chiffres), et couverture des termes clés de l'offre. Aperçu du texte tel qu'un ATS le lit.
- **Lettres de motivation** : 30 modèles par situation (20 en français, 10 en anglais), design assorti aux CV, guide par paragraphe (objectif, conseils, amorces, longueur), coach de rédaction, correcteur orthographique LanguageTool à la demande.
- **Assistant « Adapter à l'offre »** : compare l'annonce, le CV et le profil, puis propose d'afficher un élément masqué, d'ajouter une réalisation ou une compétence présente dans le profil, de remonter la puce la plus proche de l'offre, de reprendre l'intitulé du poste. Chaque proposition se valide ou s'ignore, rien n'est appliqué d'office, et l'assistant se désactive dans les réglages. Il ne propose jamais un terme absent du profil.
- **Envoi** : contrôle croisé du CV et de la lettre (nom d'une autre entreprise resté dans le texte, date, crochets, identité et chiffres cohérents), mail d'accompagnement prêt à ouvrir dans la messagerie, puis « J'ai envoyé » qui fige une copie des documents. Chaque nouvel envoi crée une version (1, 2, 3) consultable en lecture seule.
- **Relance** : date de rappel exportable vers le calendrier (`.ics`), mail de relance pré-rempli, décompte des relances faites.
- **Entretien** : fiche par dossier avec questions probables tirées de l'annonce, exemples tirés du CV envoyé, questions à poser et notes, le tout modifiable.
- **Signature manuscrite** : image importée (PNG transparent conseillé), placée et redimensionnée directement sur la lettre à la souris ou au doigt, reprise dans le PDF et le Word.
- **Exports** : PDF (identique à l'aperçu, texte sélectionnable), Word `.docx` (une colonne, modifiable, pensé pour les ATS), texte brut.

## Recherche d'offres

La page **Offres** interroge à la demande plusieurs sources, note chaque offre sur 100 sans IA (mots-clés dans le titre et le texte, compétences du profil, date, lieu), dédoublonne, et crée le dossier de candidature en un clic.

- **Sources lues automatiquement** : l'API officielle France Travail, des flux RSS, et des pages de résultats quelconques dont l'outil extrait les liens d'offres. On ajoute ses propres sites, avec `{q}`, `{lieu}` et `{dept}` dans l'adresse.
- **Sites qui refusent la lecture automatique** (LinkedIn, Indeed, Welcome to the Jungle, APEC) : liens de recherche pré-remplis, ajout d'une annonce par son adresse, et signet « Envoyer vers ConceptCV » qui crée le dossier depuis la page ouverte.
- **Lieu** : ville, département ou région, résolus par le référentiel public `geo.api.gouv.fr`.

Un navigateur ne peut pas lire les pages d'un autre site. La recherche passe donc par un petit relais gratuit, dans `relay/`, à déployer sur Vercel :

1. Sur Vercel, importer ce dépôt en choisissant `relay` comme *Root Directory* (aucun framework, aucune commande de build).
2. Variables d'environnement facultatives : `FT_CLIENT_ID` et `FT_CLIENT_SECRET` (identifiants gratuits obtenus sur francetravail.io en s'abonnant à l'API « Offres d'emploi v2 »), `ALLOWED_ORIGINS` si le site n'est pas servi depuis `https://donsanchitoo.github.io`.
3. Coller l'adresse du relais dans la page Offres.

Le relais de ce dépôt est déjà déployé (`https://conceptcv-relay-sanchez-s-org.vercel.app`) et renseigné par défaut. Les étapes ci-dessus ne servent que pour en déployer un autre.

Le relais n'accepte que les appels venant du site, refuse les adresses internes, et ne reçoit que les critères de recherche et les adresses à lire : jamais les CV ni les dossiers.

## Données et synchronisation

Le dossier choisi contient :

```
ConceptCV.json            base complète (profil, réglages, tous les projets)
Projets/<Entreprise>_<id>.json   un fichier par projet (dossier de candidature)
Sauvegardes/              une copie de la base par jour
```

| Appareil | Fonctionnement |
| --- | --- |
| Ordinateur, Chrome ou Edge | On choisit le dossier (iCloud Drive) une fois. Chaque modification y est écrite aussitôt. Les fichiers modifiés depuis un autre appareil sont relus et fusionnés automatiquement : la version la plus récente de chaque projet l'emporte. |
| iPhone, Safari, Firefox | Ces navigateurs n'autorisent pas l'accès à un dossier. On importe **un projet à la fois** depuis `Projets/` (bouton « Importer »), on travaille dessus, puis « Enregistrer le projet » le redépose dans Fichiers au même endroit. L'ordinateur le récupère à la prochaine ouverture. On peut aussi ouvrir la base complète `ConceptCV.json`. |

Un fichier de projet embarque une copie du profil, pour pouvoir créer un CV sur un téléphone vierge.

Rien n'est envoyé en ligne, à une exception près : le correcteur orthographique transmet le texte vérifié à `api.languagetool.org`, uniquement au clic et après accord.

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires
npm run build      # typage + construction dans dist/
```

Pile : React, TypeScript, Vite, Zustand, dnd-kit, docx, pdf.js. Les polices des modèles sont embarquées, aucune ressource externe n'est chargée.

## Mise en production

Le dépôt se déploie sur GitHub Pages par GitHub Actions (réglage *Pages → Source : GitHub Actions*).

```bash
git tag 1.0.0
git push origin 1.0.0
```

Le workflow `deploy.yml` se déclenche sur tout tag `*.*.*` : typage, tests, construction, publication. Le workflow `ci.yml` vérifie chaque branche et chaque pull request.

## Limites connues

- L'import PDF repose sur des règles (colonnes, titres, dates) : le résultat est à relire.
- L'export Word ne reproduit pas la mise en page des modèles à colonnes, par choix : il produit une version une colonne lisible par les ATS.
- Le score ATS est une estimation fondée sur les pratiques documentées, pas le verdict d'un logiciel de recrutement précis.
- La recherche d'offres dépend de ce que chaque site laisse lire : une page construite en JavaScript ou protégée contre les robots ne renvoie rien, et l'outil l'indique source par source.
- La synchronisation est de type « dernière écriture gagnante », projet par projet : éviter de modifier le même projet sur deux appareils en même temps.
- Sur iPhone, l'enregistrement passe par la feuille de partage (« Enregistrer dans Fichiers ») : il faut choisir le sous-dossier `Projets` et accepter de remplacer le fichier.

Voir aussi [docs/ETAT_DE_L_ART.md](docs/ETAT_DE_L_ART.md).
