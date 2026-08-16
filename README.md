# CogitoPlay

Cinq jeux en HTML/CSS/JavaScript vanilla, sans framework, sans backend,
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

### Cache et numéro de version

Les feuilles de style et les scripts sont appelés avec un suffixe `?v=N` dans
les cinq pages HTML. **Il faut incrémenter ce numéro à chaque modification d'un
fichier de `shared/`** : sans lui, un joueur qui revient reçoit la page neuve
mais garde l'ancien JavaScript en cache, et la page casse. Une seule commande
suffit :

```bash
sed -i '' 's/?v=6/?v=7/g' index.html jeu-*/index.html
```

GitHub Pages sert les fichiers texte compressés en gzip : les 5,5 Mo du
dictionnaire des formes fléchies passent à environ 1,5 Mo sur le réseau.

## Vérification

Le site n'a pas d'étape de construction : rien ne relie une page à ses scripts.
Une référence à un identifiant disparu du HTML lève une exception qui interrompt
le script, et tout ce qui suit la ligne fautive n'est jamais exécuté — c'est
ainsi que la fleur avait perdu la fermeture de ses fenêtres. À lancer après
toute modification du balisage :

```bash
python3 outils/verifie-identifiants.py
```

## Contenu

| Dossier | Jeu | Langue | Rythme | Dictionnaire |
|---|---|---|---|---|
| `jeu-mot/` | Mot mystère | FR | quotidien | formes fléchies (469 k) pour les propositions, sélection de 1 629 mots courants pour le tirage |
| `jeu-grille/` | Grille de lettres | FR | quotidien | base + accords (152 k) |
| `jeu-grille-en/` | Letter Grid | EN | quotidien | ENABLE2K (173 k) |
| `jeu-fleur/` | Fleur de lettres | FR | 14 jours | base + accords (152 k) |
| `jeu-sudoku/` | Sudoku | — | quotidien, 3 niveaux | aucun |

Le sudoku suit la même règle que les jeux de mots : trois grilles par jour, une
par niveau, tirées de la date. La grille est bâtie en remplissant d'abord une
solution complète, puis en retirant des cases une à une — un retrait n'est gardé
que si la grille conserve **une seule** solution, vérifiée par dénombrement. Le
joueur n'a donc jamais à deviner. Comptez 2 ms de génération en facile, 14 ms en
moyen, 90 ms en difficile — ce dernier écarte en moyenne une quinzaine de
grilles trop tendres avant d'en retenir une.

Un niveau n'est pas un nombre de cases vides mais **un type de raisonnement**.
`jeu-sudoku/techniques.js` connaît quatre techniques — singleton nu, singleton
caché, paire nue, paire pointante — et sait les *nommer*. Ce même répertoire
sert aux deux bouts : la fabrication ne retire une case que si la grille reste
déductible avec les techniques du niveau, et l'indice s'en sert pour dire quel
raisonnement mener. Un plancher garantit en plus que la grille **exige** la
technique de son niveau, sans quoi « difficile » ne voudrait dire que « plus
long » : mesuré avant ce garde-fou, aucune grille difficile n'exigeait mieux
que la technique la plus élémentaire.

L'indice est **progressif** : première pression, où chercher ; deuxième, quel
raisonnement mener ; troisième seulement, la case se remplit. Trois pressions
par jour — trois coups de pouce, ou une réponse toute faite.

Le nombre d'erreurs permises dépend du niveau : illimité en facile, **cinq** en
moyen, **trois** en difficile. À la dernière, la partie est perdue et la grille
se reprend depuis le début — c'est ce qui donne du poids aux niveaux hauts, où
poser un chiffre au jugé devient coûteux.

La fleur garantit son pangramme de la même façon que les grilles garantissent
leur mot long : on ne tire pas sept lettres en espérant qu'un mot les utilise
toutes, on part d'un mot du dictionnaire qui compte exactement sept lettres
distinctes, et ses lettres deviennent la fleur. Reste à choisir la lettre
centrale et à vérifier que la récolte tient entre 40 et 350 mots. La lettre S est
exclue de la fleur : depuis que les pluriels comptent, elle rendrait la moitié
des trouvailles automatiques.

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
  Chaque page est écrite dans sa langue — la grille anglaise est en anglais de
  bout en bout — et le jeu ne pioche que ses textes dynamiques dans
  `config.textes[langue]`.
- `message.js` — un seul message transitoire à la fois (le suivant remplace le
  précédent dans le même nœud, empilés ils recouvraient le compteur et la barre
  de progression) et `JM.confirme()`, la confirmation en fenêtre modale maison.
  Le site n'utilise plus aucune boîte système `confirm()`.
- `progression.js` — barre de progression commune aux grilles et à la fleur :
  deux repères (une **cible** atteignable qui vaut victoire, le **maximum** que
  presque personne n'atteint) et douze paliers — huit jusqu'à la cible, quatre
  au delà — chacun avec son émoticône et son mot d'encouragement.
- `storage.js` — accès `localStorage` tolérant au mode privé.
- `style-commun.css` — les **24 jetons de couleur** dont tout le site est peint,
  puis l'en-tête, les boutons et les modales. Aucune couleur n'est écrite en dur
  ailleurs : c'est ce qui permettra d'ajouter un thème en redéfinissant
  seulement ces jetons. Deux d'entre eux existent précisément pour ça —
  `--sur-accent`, le texte posé sur un aplat d'accent, et `--alerte` — car un
  thème à accent clair rendrait illisible un blanc écrit en dur.

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
| `jm.sudoku.v1` | grille du jour : niveau, chiffres posés, notes, temps, erreurs |
| `jm.sudoku.stats.v1` | parties terminées et meilleur temps par niveau |
| `jm.sudoku.indices.v1` | indices utilisés dans la journée (trois maximum) |
| `jm.prefs.v1` | palette de couleurs et langue d'interface choisies |

Aucun identifiant, aucune donnée personnelle, rien ne sort de l'appareil. Le
bouton « effacer mes données » de chaque jeu supprime toutes les clés `jm.`.

## Dictionnaires

Voir `shared/dictionnaires/LICENCES_ET_SOURCES.md`. Les trois fichiers d'origine
sont utilisés tels quels ; s'y ajoutent deux fichiers dérivés, MPL 2.0 eux aussi :
`fr_solutions_5.txt` (sélection à la main des mots courants de 5 lettres) et
`fr_base_accords.txt` (formes de base + féminins et pluriels, sans les
conjugaisons), reconstruit par `outils/derive-accords.py`.

Le dictionnaire source ne distingue pas « féminin » de « conjugué » : ce sont
deux formes fléchies, et les marqueurs grammaticaux ont été retirés des fichiers.
Les accords sont donc reconstruits par règle depuis chaque lemme (`+e`, `+s`,
`-eux → -euse`, `-teur → -trice`, `-al → -aux`…), puis chaque candidat n'est
retenu que s'il existe dans la liste des 469 007 formes. Un garde-fou écarte les
dérivations en `-e` quand le verbe en `-er` correspondant existe : « chant » +
« e » donnerait « chante », qui est une conjugaison et non un féminin.

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

Sur les grilles, reprendre une partie et consulter les mots manqués s'excluent :
tant que la reprise reste possible, la liste est remplacée par un bouton qui
annonce ce qu'il coûte. L'ouvrir clôt la partie pour de bon, et le choix est
mémorisé — recharger la page ne rend pas la reprise.

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
