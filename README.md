# CogitoPlay

Quatre jeux de mots en HTML/CSS/JavaScript vanilla, sans framework, sans backend,
sans appel réseau externe, sans cookie ni traceur. En ligne sur
<https://cogitoplay.com>.

## Lancer

Les dictionnaires sont chargés par `fetch()`, que les navigateurs bloquent en
`file://`. Il faut donc servir le dossier :

```bash
cd jeux-mots && python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000/>.

## Publication

Site statique servi tel quel par GitHub Pages depuis la racine de la branche
`main` — aucune étape de construction.

- `.nojekyll` désactive Jekyll : le site n'en a pas besoin, et Jekyll écarterait
  silencieusement certains fichiers.
- Pas de fichier `CNAME` pour l'instant : le site est servi à l'adresse
  `github.io` par défaut. Le jour où `cogitoplay.com` est enregistré, ajouter un
  fichier `CNAME` contenant `cogitoplay.com` à la racine, et faire pointer le
  domaine vers les quatre adresses de GitHub Pages (`185.199.108-111.153`) plus
  un `CNAME` pour `www`. **Attention à l'ordre** : un fichier `CNAME` présent
  avant que le domaine ne résolve rend le site injoignable, GitHub redirigeant
  vers un domaine qui n'existe pas encore.

GitHub Pages sert les fichiers texte compressés en gzip : les 5,5 Mo du
dictionnaire des formes fléchies passent à environ 1,5 Mo sur le réseau.

## Contenu

| Dossier | Jeu | Langue | Rythme | Dictionnaire |
|---|---|---|---|---|
| `jeu-mot/` | Mot mystère | FR | quotidien | formes fléchies (469 k) pour les propositions, sélection de 1 629 mots courants pour le tirage |
| `jeu-grille/` | Grille de lettres | FR | quotidien | formes de base (67 k) |
| `jeu-grille-en/` | Letter Grid | EN | quotidien | ENABLE2K (173 k) |
| `jeu-fleur/` | Fleur de lettres | FR | 14 jours | formes de base (67 k) |

La fleur garantit son pangramme de la même façon que les grilles garantissent
leur mot long : on ne tire pas sept lettres en espérant qu'un mot les utilise
toutes, on part d'un mot du dictionnaire qui compte exactement sept lettres
distinctes, et ses lettres deviennent la fleur. Reste à choisir la lettre
centrale et à vérifier que la récolte tient entre 30 et 250 mots.

## Code partagé (`shared/`)

- `seed.js` — hachage FNV-1a + générateur mulberry32. Une clé texte
  (`jeu-mot:2026-08-15`) donne une suite de nombres reproductible : la partie du
  jour est la même pour tout le monde, sans serveur. `tirageSansRepetition()`
  garantit en plus qu'un mot n'est pas retiré tant que la liste n'est pas
  épuisée.
- `dico.js` — chargement, filtrage par longueur et normalisation des accents
  (`hématome` → `hematome`, un tiers des mots français de la liste sont
  accentués alors que les grilles et claviers ne produisent que des lettres
  simples). Garde la graphie d'origine pour l'affichage.
- `grille.js` — moteur des deux jeux de grille : génération de la grille du
  jour, solveur (arbre préfixe + parcours en profondeur), barème. La grille est
  bâtie en posant d'abord un mot long sur un chemin serpentin puis en
  remplissant le reste selon les fréquences de lettres de la langue : la
  contrainte « au moins un mot de 7 (ou 8) lettres » est ainsi garantie par
  construction plutôt que par tirages successifs.
- `grille-ui.js` — interface commune aux deux grilles ; chaque jeu se réduit à
  un fichier de configuration (dictionnaire, fréquences, contraintes, textes).
  L'interface est traduisible : les textes fixes portent un attribut `data-en`
  dans le HTML, les textes dynamiques viennent de `config.textes[langue]`. Le
  jeu anglais offre les deux langues (bouton FR/EN dans l'en-tête, choix
  mémorisé) ; les jeux français ne déclarent que le français.
- `progression.js` — barre de progression commune aux grilles et à la fleur :
  deux repères (une **cible** atteignable qui vaut victoire, le **maximum** que
  presque personne n'atteint) et douze paliers — huit jusqu'à la cible, quatre
  au delà — chacun avec son émoticône et son mot d'encouragement.
- `storage.js` — accès `localStorage` tolérant au mode privé.
- `style-commun.css` — variables de thème (clair/sombre), en-tête, boutons,
  modales.

## Données stockées

Uniquement dans le `localStorage` du navigateur, sous le préfixe `jm.` :

| Clé | Contenu |
|---|---|
| `jm.mot5.v1` | partie du jour : numéro du jour, mots proposés, partie terminée ou non |
| `jm.mot5.stats.v1` | parties jouées, victoires, série en cours, record, répartition |
| `jm.grille-fr.v1`, `jm.grille-en.v1` | grille du jour : mots trouvés, score, temps restant, partie terminée ou non |
| `jm.grille-fr.v1.stats`, `jm.grille-en.v1.stats` | parties jouées, meilleur score |
| `jm.fleur.v1` | quinzaine en cours : mots trouvés et score |
| `jm.fleur.indices.v1` | indices utilisés dans la journée (trois maximum) |
| `jm.prefs.v1` | palette de couleurs et langue d'interface choisies |

Aucun identifiant, aucune donnée personnelle, rien ne sort de l'appareil. Le
bouton « effacer mes données » de chaque jeu supprime toutes les clés `jm.`.

## Dictionnaires

Voir `shared/dictionnaires/LICENCES_ET_SOURCES.md`. Les trois fichiers d'origine
sont utilisés tels quels ; s'y ajoute `fr_solutions_5.txt`, extrait sélectionné à
la main de la liste française (et donc MPL 2.0 lui aussi).

- Français : Dicollecte / Grammalecte (Olivier R.), **MPL 2.0**.
- Anglais : ENABLE2K (Alan Beale), **domaine public**.

Ces listes ne sont pas filtrées : elles peuvent contenir des mots vulgaires ou
des résidus de noms propres. Deux garde-fous côté jeu :

- `fr_solutions_5.txt` (fichier dérivé, MPL 2.0 lui aussi) restreint le tirage
  du mot mystère à 1 629 mots courants sur les 3 293 formes de 5 lettres
  disponibles. Sans fichier `fr_solutions_<n>.txt` pour une longueur donnée —
  c'est le cas de la variante 6 lettres — le jeu retombe automatiquement sur la
  liste complète des formes de base.
- Chaque jeu expose une constante `MOTS_EXCLUS` pour écarter au cas par cas un
  mot repéré à l'usage.

Les grilles démarrent en **mode libre** ; le chrono de trois minutes est une
case à cocher sur l'écran de départ. La zone de saisie, posée au dessus de la
grille, annonce au fil de la frappe combien de mots restent à trouver derrière
ce début de mot, et surligne dans la liste un mot déjà trouvé qui commencerait
pareil. La fleur, elle, offre trois indices par jour : longueur et deux
premières lettres d'un mot manquant.

Les grilles acceptent tout ce qui est au dictionnaire : restreindre la
liste reviendrait à refuser des mots corrects tapés par le joueur. En revanche
l'écran de fin n'affiche d'emblée que les 18 mots ratés les plus longs, le reste
derrière un bouton — faute de liste de fréquences, c'est la longueur qui sert de
filtre, pas la notoriété.
