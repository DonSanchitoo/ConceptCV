# ConceptCV

Atelier privé de CV et de lettres de motivation. Une application web sans serveur ni compte : les données restent dans le navigateur et dans un dossier iCloud que vous choisissez.

## Ce que fait l'outil

- **Dossiers de candidature** : un dossier par entreprise (poste, lieu, annonce, contact, statut, journal, date de relance), en grille ou en tableau de suivi par glisser-déposer. Chaque dossier contient autant de CV, lettres, analyses et notes que nécessaire.
- **Profil commun** : coordonnées, expériences, formations, compétences. Un CV existant en PDF peut le pré-remplir (lecture locale). Chaque nouveau CV part du profil, puis s'adapte à l'offre sans le modifier.
- **Concepteur de CV** : 30 modèles, parcours guidé rubrique par rubrique avec conseils, édition directe dans l'aperçu, pagination A4 réelle, réglage des couleurs, polices, marges, colonnes, en-tête, style des titres, affichage des compétences. Les rubriques se réordonnent et changent de colonne par glisser-déposer.
- **Analyse ATS** : score, contrôle de la structure (colonnes, intitulés, dates, jauges), des coordonnées, de la rédaction (puces sans résultat, chiffres), et couverture des termes clés de l'offre. Aperçu du texte tel qu'un ATS le lit.
- **Lettres de motivation** : 30 modèles par situation (20 en français, 10 en anglais), design assorti aux CV, guide par paragraphe (objectif, conseils, amorces, longueur), coach de rédaction, correcteur orthographique LanguageTool à la demande.
- **Exports** : PDF (identique à l'aperçu, texte sélectionnable), Word `.docx` (une colonne, modifiable, pensé pour les ATS), texte brut.

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
- La synchronisation est de type « dernière écriture gagnante », projet par projet : éviter de modifier le même projet sur deux appareils en même temps.
- Sur iPhone, l'enregistrement passe par la feuille de partage (« Enregistrer dans Fichiers ») : il faut choisir le sous-dossier `Projets` et accepter de remplacer le fichier.

Voir aussi [docs/ETAT_DE_L_ART.md](docs/ETAT_DE_L_ART.md).
