/*
 * Jeu 1 — Grille de lettres quotidienne (français).
 *
 * Toute la mécanique est dans /shared/grille.js et /shared/grille-ui.js ; ce
 * fichier ne contient que ce qui distingue la version française de la version
 * anglaise.
 *
 * Dictionnaire : formes de base uniquement (fr_lemmes_base_67k). Les
 * conjugaisons sont donc refusées, conformément aux règles du jeu.
 */
JM.demarrerJeuGrille({
  cleJeu: 'grille-fr',
  cleStockage: 'grille-fr.v1',
  dico: 'fr_lemmes_base_67k.txt',
  duree: 180, // 3 minutes

  // Fréquence de chaque lettre dans les mots du dictionnaire français, pour
  // mille. Une lettre rare dans la langue est rare dans la grille.
  poids: {
    a: 80, b: 21, c: 46, d: 27, e: 117, f: 13, g: 25, h: 22, i: 87, j: 2,
    k: 2, l: 52, m: 40, n: 66, o: 69, p: 34, q: 11, r: 84, s: 48, t: 72,
    u: 50, v: 11, w: 1, x: 5, y: 10, z: 2,
  },

  // Contraintes de génération : un mot de 7 lettres posé d'avance, un équilibre
  // voyelles/consonnes jouable, et de quoi chercher pendant trois minutes.
  longueurPlantee: 7,
  motsMin: 40,
  voyellesMin: 5,
  voyellesMax: 7,

  // Cible de victoire : 30 % du score maximum de la grille. Le maximum suppose
  // d'avoir trouvé les 70 mots ou plus que cache une grille, ce que personne ne
  // fait ; la cible, elle, se joue.
  partCible: 0.3,

  langue: 'fr',
  textes: {
    fr: {
      tropCourt: '4 lettres minimum',
      dejaTrouve: 'Déjà trouvé',
      pasDansLaGrille: 'Ces lettres ne se touchent pas',
      pasAuDictionnaire: 'Pas au dictionnaire',
      confirmerFin: 'Terminer la partie maintenant ?',
      confirmerEffacement: 'Effacer la partie en cours et vos scores sur cet appareil ?',
      copie: 'Résultat copié',
      copieRatee: 'Copie impossible',
      invite: 'Formez un mot',
      sansChrono: 'sans chrono',
      caseAria: function (lettre, ligne, colonne) {
        return `${lettre}, ligne ${ligne}, colonne ${colonne}`;
      },
      annonceMot: function (mot, points) {
        return `${mot}, ${points} point${points > 1 ? 's' : ''}.`;
      },
      voirTout: function (nombre) {
        return `Voir les ${nombre} autres`;
      },
      motsPossibles: function (nombre) {
        if (nombre === 0) return 'aucun mot à trouver ainsi';
        return nombre === 1 ? '1 mot possible' : `${nombre} mots possibles`;
      },
      progression: { cible: 'cible', max: 'max', points: 'pts' },
      partage: function (numero, score, mots, total) {
        return `Grille de lettres n°${numero} — ${score} points, ${mots} mots sur ${total}`;
      },
    },
  },
});
