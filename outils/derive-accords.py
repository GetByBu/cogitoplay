#!/usr/bin/env python3
"""
Construit fr_base_accords.txt : les formes de base françaises, augmentées des
féminins et des pluriels, mais **sans les conjugaisons**.

Le dictionnaire source ne distingue pas « féminin » de « conjugué » : les deux
sont des formes fléchies, et les marqueurs grammaticaux ont été retirés des
fichiers. On reconstruit donc les accords par règle depuis chaque lemme, et on
ne garde une forme dérivée que si elle existe réellement dans la liste des
469 007 formes fléchies — la règle propose, le dictionnaire dispose.

Un garde-fou évite de réintroduire des conjugaisons par la bande : « chant » +
« e » donnerait « chante », qui n'est pas le féminin de chant mais une forme de
chanter. Toute dérivation en -e/-es est donc écartée quand le verbe en -er
correspondant existe. Les vrais noms féminins ne sont pas perdus pour autant :
ils sont des lemmes à part entière (« porte », « danse ») et figurent déjà dans
la liste de base.

Usage : python3 outils/derive-accords.py
"""

import os

DOSSIER = os.path.join(os.path.dirname(__file__), '..', 'shared', 'dictionnaires')
BASE = os.path.join(DOSSIER, 'fr_lemmes_base_67k.txt')
COMPLET = os.path.join(DOSSIER, 'fr_formes_completes_469k.txt')
SORTIE = os.path.join(DOSSIER, 'fr_base_accords.txt')

# Terminaison du lemme -> terminaison de la forme accordée.
REGLES = [
    ('', 'e'), ('', 's'), ('', 'es'),
    ('eux', 'euse'), ('eux', 'euses'),
    ('teur', 'trice'), ('teur', 'trices'),
    ('eur', 'euse'), ('eur', 'euses'),
    ('er', 'ère'), ('er', 'ères'),
    ('f', 've'), ('f', 'ves'),
    ('el', 'elle'), ('el', 'elles'),
    ('eil', 'eille'), ('eil', 'eilles'),
    ('ien', 'ienne'), ('ien', 'iennes'),
    ('on', 'onne'), ('on', 'onnes'),
    ('en', 'enne'), ('en', 'ennes'),
    ('et', 'ette'), ('et', 'ettes'),
    ('ot', 'otte'), ('ot', 'ottes'),
    ('al', 'aux'), ('ail', 'aux'), ('au', 'aux'), ('eau', 'eaux'), ('eu', 'eux'),
    ('tre', 'tresse'), ('tre', 'tresses'),
    ('eur', 'eresse'), ('eur', 'eresses'),
    ('c', 'que'), ('c', 'ques'),
    ('g', 'gue'), ('g', 'gues'),
    ('s', 'se'), ('s', 'ses'),
    ('x', 'sse'), ('x', 'sses'),
]

# Les dérivations qui ajoutent un simple -e sont les seules ambiguës avec une
# conjugaison du premier groupe.
SUFFIXES_AMBIGUS = {'e', 'es'}


def lire(chemin):
    with open(chemin, encoding='utf-8') as f:
        return [ligne.strip() for ligne in f if ligne.strip()]


def main():
    lemmes = lire(BASE)
    ensemble_lemmes = set(lemmes)
    formes = set(lire(COMPLET))

    accords = set()
    ecartes_verbes = 0

    for lemme in lemmes:
        for fin_lemme, fin_forme in REGLES:
            if fin_lemme:
                if not lemme.endswith(fin_lemme):
                    continue
                candidat = lemme[: -len(fin_lemme)] + fin_forme
            else:
                candidat = lemme + fin_forme

            if candidat in ensemble_lemmes or candidat not in formes:
                continue

            # « chant » + « e » = « chante » : conjugaison, pas féminin.
            if fin_forme in SUFFIXES_AMBIGUS and (lemme + 'er') in ensemble_lemmes:
                ecartes_verbes += 1
                continue

            accords.add(candidat)

    total = sorted(ensemble_lemmes | accords)
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(total) + '\n')

    print(f'lemmes de départ      : {len(lemmes):>7}')
    print(f'accords ajoutés       : {len(accords):>7}')
    print(f'écartés (conjugaisons): {ecartes_verbes:>7}')
    print(f'total écrit           : {len(total):>7}  -> {os.path.relpath(SORTIE)}')


if __name__ == '__main__':
    main()
