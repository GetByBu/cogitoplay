# Sources et licences des dictionnaires

## Français

**Source** : Dicollecte (Olivier R.), le dictionnaire orthographique derrière
Grammalecte. Version 7.7, récupérée depuis le dépôt officiel de LibreOffice
(`github.com/LibreOffice/dictionaries`, dossier `fr_FR/dictionaries/`), qui
distribue ce même dictionnaire pour LibreOffice/OpenOffice/Firefox/Thunderbird.

**Licence** : MPL 2.0 (Mozilla Public License version 2.0).
- Utilisation, modification et redistribution autorisées, y compris dans un
  projet fermé/commercial.
- Si tu modifies le fichier de mots lui-même (le contenu, pas ton code), la
  version modifiée de CE fichier doit rester sous MPL 2.0 et être partageable.
  Ton propre code (le jeu, l'interface) n'est pas concerné par cette
  obligation — seul le fichier de mots l'est.
- Garde ce fichier de licence à côté des listes de mots dans ton projet.

**Deux fichiers fournis** :
- `fr_lemmes_base_67k.txt` — 67 216 mots, formes de base uniquement
  (infinitifs, singuliers, pas de conjugaisons). À utiliser pour les jeux qui
  excluent les formes conjuguées (grille de lettres type Boggle, fleur de
  lettres type Spelling Bee).
- `fr_formes_completes_469k.txt` — 469 007 formes, toutes les variantes
  fléchies générées à partir du dictionnaire (pluriels, conjugaisons à tous
  les temps, féminins, etc.), via l'outil `unmunch` d'Hunspell. À utiliser
  pour le jeu type Wordle qui accepte les formes conjuguées.

Traitement appliqué : extraction des mots depuis le format Hunspell
(`.dic`/`.aff`), suppression des marqueurs grammaticaux internes, filtrage
des entrées non alphabétiques (résidus techniques de la génération), mise en
minuscules, déduplication, tri.

## Anglais

**Source** : ENABLE2K (Enhanced North American Benchmark Lexicon), compilé
par Alan Beale. Récupéré depuis le dépôt `danvk/hybrid-boggle` sur GitHub, un
projet de recherche sur les grilles Boggle qui l'utilise comme liste de
référence.

**Licence** : domaine public, explicitement déclaré par son auteur — aucune
restriction d'usage, de redistribution ou de modification.

**Fichier fourni** :
- `en_enable2k_173k.txt` — 173 528 mots. Contient nativement toutes les
  formes fléchies (pluriels, conjugaisons) comme entrées séparées — pas de
  traitement supplémentaire nécessaire.

## Format des 3 fichiers

Texte brut, encodage UTF-8, un mot par ligne, tout en minuscules, trié et
dédupliqué. Aucun format spécial (pas de JSON, pas de flags) — directement
utilisable par un `fetch()` + `.split('\n')` en JavaScript, ou par n'importe
quel langage.

## Ce que je n'ai PAS fait

Je n'ai pas filtré les noms propres, ni les mots vulgaires/injurieux, ni
vérifié l'exhaustivité de la couverture dialectale. Ces listes sont brutes,
telles qu'issues des dictionnaires sources — à toi de voir si tu veux filtrer
davantage selon l'usage (ex. retirer les mots de moins de 4 lettres si tu
veux, ou une liste de mots interdits).

## Fichier dérivé ajouté par ce projet

- `fr_solutions_5.txt` — 1 629 mots de 5 lettres, sélectionnés à la main parmi
  les 3 293 formes de base de 5 lettres de `fr_lemmes_base_67k.txt` en ne
  gardant que les mots qu'un francophone reconnaît (les entrées trop
  spécialisées, dialectales ou techniques ont été écartées, ainsi que le
  registre injurieux et les noms déposés). Sert uniquement à tirer le mot du
  jour du jeu « mot mystère » ; la validation des propositions du joueur, elle,
  continue d'utiliser le dictionnaire complet.

Ce fichier est un extrait modifié du dictionnaire Dicollecte : il reste donc
sous **MPL 2.0**, comme le fichier dont il est issu. Le code des jeux n'est pas
concerné par cette obligation.
