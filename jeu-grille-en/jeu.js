/*
 * Jeu 4 — Grille de lettres quotidienne (anglais).
 *
 * Même moteur et même interface que la grille française ; changent seulement la
 * langue du dictionnaire, les fréquences de lettres, la contrainte de
 * génération — et le fait que l'interface elle-même se met en anglais si le
 * joueur le demande (bouton FR/EN dans l'en-tête).
 *
 * Dictionnaire : ENABLE2K, qui contient nativement toutes les formes fléchies.
 * Aucune restriction grammaticale ici, contrairement à la version française.
 */
JM.demarrerJeuGrille({
  cleJeu: 'grille-en',
  cleStockage: 'grille-en.v1',
  dico: 'en_enable2k_173k.txt',
  duree: 180, // 3 minutes

  // Fréquence de chaque lettre dans les mots du dictionnaire anglais, pour
  // mille. Le s y est bien plus fréquent qu'en français : les pluriels et les
  // troisièmes personnes sont des entrées à part entière.
  poids: {
    a: 75, b: 21, c: 44, d: 38, e: 97, f: 14, g: 31, h: 27, i: 82, j: 2,
    k: 10, l: 55, m: 32, n: 67, o: 63, p: 32, q: 2, r: 73, s: 83, t: 66,
    u: 37, v: 12, w: 9, x: 4, y: 19, z: 6,
  },

  // Un mot de 8 lettres est posé sur la grille avant le remplissage : la
  // contrainte « au moins un mot de 8 lettres » est donc garantie par
  // construction, sans avoir à retirer des grilles jusqu'à tomber juste.
  longueurPlantee: 8,
  motsMin: 60,
  voyellesMin: 5,
  voyellesMax: 7,

  partCible: 0.3,

  langue: 'fr',
  languesOffertes: ['fr', 'en'],

  textes: {
    fr: {
      titre: 'Grille anglaise — CogitoPlay',
      tropCourt: '4 lettres minimum',
      dejaTrouve: 'Déjà trouvé',
      pasDansLaGrille: 'Ces lettres ne se touchent pas',
      pasAuDictionnaire: 'Pas au dictionnaire anglais',
      confirmerFin: 'Terminer la partie maintenant ?',
      confirmerEffacement: 'Effacer la partie en cours et vos scores sur cet appareil ?',
      copie: 'Résultat copié',
      copieRatee: 'Copie impossible',
      invite: 'Formez un mot',
      sansChrono: 'sans chrono',
      basculeLangue: 'Switch to English',
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
        return `Grille anglaise n°${numero} — ${score} points, ${mots} mots sur ${total}`;
      },
    },

    en: {
      titre: 'Letter Grid — CogitoPlay',
      tropCourt: 'Four letters minimum',
      dejaTrouve: 'Already found',
      pasDansLaGrille: 'Those letters aren’t connected',
      pasAuDictionnaire: 'Not in the dictionary',
      confirmerFin: 'End the game now?',
      confirmerEffacement: 'Erase the current game and your scores on this device?',
      copie: 'Result copied',
      copieRatee: 'Copying failed',
      invite: 'Build a word',
      sansChrono: 'no timer',
      basculeLangue: 'Passer en français',
      caseAria: function (lettre, ligne, colonne) {
        return `${lettre}, row ${ligne}, column ${colonne}`;
      },
      annonceMot: function (mot, points) {
        return `${mot}, ${points} point${points > 1 ? 's' : ''}.`;
      },
      voirTout: function (nombre) {
        return `Show the other ${nombre}`;
      },
      motsPossibles: function (nombre) {
        if (nombre === 0) return 'no word starts like that';
        return nombre === 1 ? '1 word possible' : `${nombre} words possible`;
      },
      progression: { cible: 'target', max: 'max', points: 'pts' },
      partage: function (numero, score, mots, total) {
        return `Letter Grid #${numero} — ${score} points, ${mots} words out of ${total}`;
      },
    },
  },
});
