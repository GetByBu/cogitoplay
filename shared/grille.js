/*
 * grille.js — moteur commun aux deux jeux de grille 4×4 (français et anglais).
 *
 * Les deux jeux partagent tout : génération de la grille du jour, solveur,
 * barème, interface. Ils ne diffèrent que par leur configuration (dictionnaire,
 * fréquences de lettres, contraintes de génération, textes).
 *
 * Génération : plutôt que de tirer 16 lettres au hasard en espérant qu'un long
 * mot s'y cache, on pose d'abord un mot long sur un chemin serpentin de la
 * grille, puis on remplit les cases restantes selon les fréquences de lettres
 * de la langue. Le mot long est donc garanti par construction, et il ne reste
 * qu'à vérifier l'équilibre voyelles/consonnes et le nombre de mots trouvables.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const COTE = 4;
  const CASES = COTE * COTE;
  const LONGUEUR_MIN = 4;
  const VOYELLES = 'aeiou';
  const FIN = '$'; // marque de fin de mot dans l'arbre préfixe

  /** Voisins de chaque case : horizontal, vertical et diagonal. */
  const VOISINS = (function () {
    const table = [];
    for (let i = 0; i < CASES; i++) {
      const ligne = Math.floor(i / COTE);
      const colonne = i % COTE;
      const liste = [];
      for (let dl = -1; dl <= 1; dl++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dl === 0 && dc === 0) continue;
          const l = ligne + dl;
          const c = colonne + dc;
          if (l >= 0 && l < COTE && c >= 0 && c < COTE) liste.push(l * COTE + c);
        }
      }
      table.push(liste);
    }
    return table;
  })();

  const CODE_A = 'a'.charCodeAt(0);

  function masqueDe(mot) {
    let masque = 0;
    for (let i = 0; i < mot.length; i++) {
      masque |= 1 << (mot.charCodeAt(i) - CODE_A);
    }
    return masque >>> 0;
  }

  /** Barème : 4 lettres = 1 point, 5 = 2, 6 = 3, 7 = 5, 8 et plus = 11. */
  function points(mot) {
    const n = mot.length;
    if (n <= 4) return 1;
    if (n === 5) return 2;
    if (n === 6) return 3;
    if (n === 7) return 5;
    return 11;
  }

  /**
   * Index de recherche : la liste des mots utilisables et, pour chacun, le
   * masque binaire de ses lettres distinctes. Le masque permet d'éliminer d'un
   * seul ET binaire l'immense majorité des mots quand on cherche ceux qu'une
   * grille donnée peut former.
   */
  function preparerIndex(dico) {
    const mots = dico.liste.filter(function (mot) {
      return mot.length >= LONGUEUR_MIN && mot.length <= CASES;
    });
    const masques = new Uint32Array(mots.length);
    for (let i = 0; i < mots.length; i++) masques[i] = masqueDe(mots[i]);
    return { mots: mots, masques: masques };
  }

  /** Mots dont les lettres sont toutes disponibles dans la grille, en quantité suffisante. */
  function candidats(index, lettres) {
    const masqueGrille = masqueDe(lettres.join(''));
    const stock = new Uint8Array(26);
    for (let i = 0; i < lettres.length; i++) stock[lettres[i].charCodeAt(0) - CODE_A]++;

    const retenus = [];
    const restant = new Uint8Array(26);

    for (let i = 0; i < index.mots.length; i++) {
      if ((index.masques[i] & ~masqueGrille) !== 0) continue; // une lettre manque
      const mot = index.mots[i];
      restant.set(stock);
      let ok = true;
      for (let j = 0; j < mot.length; j++) {
        const code = mot.charCodeAt(j) - CODE_A;
        if (restant[code] === 0) {
          ok = false;
          break;
        }
        restant[code]--;
      }
      if (ok) retenus.push(mot);
    }
    return retenus;
  }

  function construireArbre(mots) {
    const racine = Object.create(null);
    for (let i = 0; i < mots.length; i++) {
      const mot = mots[i];
      let noeud = racine;
      for (let j = 0; j < mot.length; j++) {
        const lettre = mot[j];
        let suivant = noeud[lettre];
        if (!suivant) {
          suivant = Object.create(null);
          noeud[lettre] = suivant;
        }
        noeud = suivant;
      }
      noeud[FIN] = true;
    }
    return racine;
  }

  /** Tous les mots de l'arbre réellement traçables sur la grille. */
  function resoudre(lettres, arbre) {
    const trouves = new Set();
    const utilisees = new Array(CASES).fill(false);

    function explorer(caseCourante, noeud, mot) {
      const voisins = VOISINS[caseCourante];
      for (let i = 0; i < voisins.length; i++) {
        const suivante = voisins[i];
        if (utilisees[suivante]) continue;
        const branche = noeud[lettres[suivante]];
        if (!branche) continue;
        const motSuivant = mot + lettres[suivante];
        if (branche[FIN] && motSuivant.length >= LONGUEUR_MIN) trouves.add(motSuivant);
        utilisees[suivante] = true;
        explorer(suivante, branche, motSuivant);
        utilisees[suivante] = false;
      }
    }

    for (let depart = 0; depart < CASES; depart++) {
      const branche = arbre[lettres[depart]];
      if (!branche) continue;
      utilisees[depart] = true;
      explorer(depart, branche, lettres[depart]);
      utilisees[depart] = false;
    }
    return trouves;
  }

  /** Un chemin possible pour ce mot dans la grille, ou null s'il n'y en a aucun. */
  function cheminDuMot(lettres, mot) {
    const utilisees = new Array(CASES).fill(false);
    const chemin = [];

    function avancer(position) {
      if (position === mot.length) return true;
      const precedente = chemin[chemin.length - 1];
      const suivantes = position === 0 ? toutesLesCases() : VOISINS[precedente];
      for (let i = 0; i < suivantes.length; i++) {
        const c = suivantes[i];
        if (utilisees[c] || lettres[c] !== mot[position]) continue;
        utilisees[c] = true;
        chemin.push(c);
        if (avancer(position + 1)) return true;
        chemin.pop();
        utilisees[c] = false;
      }
      return false;
    }

    return avancer(0) ? chemin.slice() : null;
  }

  function toutesLesCases() {
    const liste = [];
    for (let i = 0; i < CASES; i++) liste.push(i);
    return liste;
  }

  /** Chemin serpentin de `longueur` cases distinctes, cases voisines deux à deux. */
  function cheminAleatoire(rng, longueur) {
    for (let tentative = 0; tentative < 200; tentative++) {
      const chemin = [JM.entier(rng, CASES)];
      while (chemin.length < longueur) {
        const libres = VOISINS[chemin[chemin.length - 1]].filter(function (c) {
          return chemin.indexOf(c) === -1;
        });
        if (libres.length === 0) break;
        chemin.push(libres[JM.entier(rng, libres.length)]);
      }
      if (chemin.length === longueur) return chemin;
    }
    return null;
  }

  function tirerLettre(rng, poids, alphabet, total) {
    let cible = rng() * total;
    for (let i = 0; i < alphabet.length; i++) {
      cible -= poids[alphabet[i]];
      if (cible <= 0) return alphabet[i];
    }
    return alphabet[alphabet.length - 1];
  }

  /**
   * Grille du jour.
   * @param {string} cle         clé de tirage (ex. « grille-fr:2026-08-15 »)
   * @param {object} config      poids des lettres, contraintes, index du dictionnaire
   */
  function genererGrille(cle, config) {
    const alphabet = Object.keys(config.poids);
    const total = alphabet.reduce(function (somme, lettre) {
      return somme + config.poids[lettre];
    }, 0);
    const longs = config.index.mots.filter(function (mot) {
      return mot.length === config.longueurPlantee;
    });

    for (let essai = 1; essai <= 40; essai++) {
      // Le suffixe rend chaque nouvelle tentative déterministe elle aussi :
      // tous les joueurs rejettent et retirent exactement les mêmes grilles.
      const rng = JM.rng(essai === 1 ? cle : cle + '#' + essai);

      const motPlante = longs[JM.entier(rng, longs.length)];
      const chemin = cheminAleatoire(rng, config.longueurPlantee);
      if (!chemin) continue;

      const lettres = new Array(CASES).fill(null);
      for (let i = 0; i < chemin.length; i++) lettres[chemin[i]] = motPlante[i];
      for (let i = 0; i < CASES; i++) {
        if (lettres[i] === null) lettres[i] = tirerLettre(rng, config.poids, alphabet, total);
      }

      const voyelles = lettres.filter(function (l) {
        return VOYELLES.indexOf(l) !== -1;
      }).length;
      if (voyelles < config.voyellesMin || voyelles > config.voyellesMax) continue;

      const solution = resoudre(lettres, construireArbre(candidats(config.index, lettres)));
      if (solution.size < config.motsMin) continue;

      return { lettres: lettres, solution: solution, essais: essai, motPlante: motPlante };
    }
    return null;
  }

  JM.grille = {
    COTE: COTE,
    CASES: CASES,
    LONGUEUR_MIN: LONGUEUR_MIN,
    VOISINS: VOISINS,
    points: points,
    preparerIndex: preparerIndex,
    candidats: candidats,
    construireArbre: construireArbre,
    resoudre: resoudre,
    cheminDuMot: cheminDuMot,
    genererGrille: genererGrille,
  };
})(window);
