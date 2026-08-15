#!/usr/bin/env python3
"""
Vérifie que chaque identifiant cherché par le JavaScript existe bien dans le
HTML de la page correspondante.

Le site n'a pas d'étape de construction : rien ne relie les pages à leurs
scripts, et une référence oubliée ne se voit pas à la lecture. Or
`document.getElementById('absent').addEventListener(...)` lève une exception
qui interrompt le script — tout ce qui suit cette ligne n'est jamais exécuté.
C'est ainsi que la fleur avait perdu la fermeture de ses fenêtres : une ligne
visant la barre de rang, supprimée du HTML, survivait dans le JS.

Usage : python3 outils/verifie-identifiants.py
Sort en erreur (code 1) si une référence est orpheline.
"""

import os
import re
import sys

RACINE = os.path.join(os.path.dirname(__file__), '..')

# Chaque page, avec les scripts qu'elle charge.
PAGES = {
    'jeu-mot': ['jeu-mot/jeu.js'],
    'jeu-grille': ['jeu-grille/jeu.js', 'shared/grille-ui.js'],
    'jeu-grille-en': ['jeu-grille-en/jeu.js', 'shared/grille-ui.js'],
    'jeu-fleur': ['jeu-fleur/jeu.js'],
    'jeu-sudoku': ['jeu-sudoku/jeu.js'],
}

# Identifiants créés à la volée par le JavaScript, donc absents du HTML.
TOLERES = set()


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding='utf-8') as f:
        return f.read()


def main():
    fautes = []

    for page, scripts in PAGES.items():
        html = lire(os.path.join(page, 'index.html'))
        presents = set(re.findall(r'id="([^"]+)"', html)) | TOLERES

        for script in scripts:
            code = lire(script)
            for cherche in sorted(set(re.findall(r"getElementById\('([^']+)'\)", code))):
                if cherche not in presents:
                    fautes.append(f'{page} : #{cherche} cherché par {script}, absent du HTML')

        print(f'{page:<16}{len(presents) - len(TOLERES)} identifiants')

    print()
    if fautes:
        print('Références orphelines :')
        for faute in fautes:
            print('  ' + faute)
        return 1

    print('Aucune référence orpheline.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
