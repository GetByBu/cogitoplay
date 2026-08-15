/*
 * techniques.js — le raisonnement du sudoku, séparé de son interface.
 *
 * Ce fichier sait deux choses : reconnaître la prochaine déduction possible
 * dans une grille, et la nommer en français. Ces deux capacités servent aux
 * deux bouts du jeu :
 *
 *   - à la fabrication, pour ne retirer une case que si la grille reste
 *     déductible avec les techniques du niveau — sans quoi le joueur devrait
 *     parier au hasard, et l'indice n'aurait rien à expliquer ;
 *   - à l'indice, pour dire au joueur *quel raisonnement mener* plutôt que de
 *     remplir la case à sa place.
 *
 * Les deux usages partagent forcément le même répertoire : une technique que
 * le générateur autorise est une technique que l'indice sait formuler.
 *
 * Les quatre techniques, de la plus simple à la plus fine :
 *
 *   nu         Cette case n'accepte plus qu'un seul chiffre.
 *   cache      Dans cette région, ce chiffre n'a plus qu'une place.
 *   paireNue   Deux cases d'une région se partagent les deux mêmes chiffres :
 *              ces chiffres leur sont réservés, on les élimine ailleurs.
 *   pointante  Dans un bloc, un chiffre est confiné à une seule ligne (ou
 *              colonne) : on l'élimine du reste de cette ligne.
 *
 * Les deux dernières ne remplissent aucune case — elles retirent des
 * possibilités, ce qui débloque une case ailleurs. L'indice les présente donc
 * toujours avec la case qu'elles libèrent.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const COTE = 9;
  const CASES = 81;
  const TOUS = 0x3fe; // bits 1 à 9 allumés

  const LIGNES = [];
  const COLONNES = [];
  const BLOCS = [];
  for (let i = 0; i < COTE; i++) {
    const ligne = [];
    const colonne = [];
    for (let k = 0; k < COTE; k++) {
      ligne.push(i * COTE + k);
      colonne.push(k * COTE + i);
    }
    LIGNES.push(ligne);
    COLONNES.push(colonne);
  }
  for (let bl = 0; bl < COTE; bl += 3) {
    for (let bc = 0; bc < COTE; bc += 3) {
      const bloc = [];
      for (let l = 0; l < 3; l++) {
        for (let c = 0; c < 3; c++) bloc.push((bl + l) * COTE + bc + c);
      }
      BLOCS.push(bloc);
    }
  }
  const UNITES = LIGNES.concat(COLONNES, BLOCS);

  // Pour chaque case, les trois unités auxquelles elle appartient.
  const APPARTIENT = [];
  for (let i = 0; i < CASES; i++) {
    APPARTIENT.push(
      UNITES.filter(function (u) {
        return u.indexOf(i) !== -1;
      })
    );
  }

  // Les 20 cases qui contraignent chaque case : sa ligne, sa colonne et son
  // bloc, sans doublon. Le solveur rapide s'en sert pour mettre à jour les
  // candidats sans tout recalculer.
  const VOISINES = [];
  for (let i = 0; i < CASES; i++) {
    const vues = {};
    APPARTIENT[i].forEach(function (unite) {
      unite.forEach(function (k) {
        if (k !== i) vues[k] = true;
      });
    });
    VOISINES.push(Object.keys(vues).map(Number));
  }

  // Position du bit allumé, pour les masques à un seul candidat.
  const CHIFFRE_DU_BIT = {};
  for (let v = 1; v <= 9; v++) CHIFFRE_DU_BIT[1 << v] = v;

  function nomUnite(unite) {
    if (LIGNES.indexOf(unite) !== -1) return 'cette ligne';
    if (COLONNES.indexOf(unite) !== -1) return 'cette colonne';
    return 'ce bloc';
  }

  function blocDe(index) {
    return BLOCS[Math.floor(index / 27) * 3 + Math.floor((index % COTE) / 3)];
  }

  function compterBits(masque) {
    let n = 0;
    while (masque) {
      masque &= masque - 1;
      n++;
    }
    return n;
  }

  function premierChiffre(masque) {
    for (let v = 1; v <= 9; v++) if (masque >> v & 1) return v;
    return 0;
  }

  /** Chiffres encore possibles dans chaque case vide, en masque de bits. */
  function candidats(grille) {
    const liste = new Array(CASES).fill(0);
    for (let i = 0; i < CASES; i++) {
      if (grille[i]) continue;
      let masque = TOUS;
      const unites = APPARTIENT[i];
      for (let u = 0; u < unites.length; u++) {
        const unite = unites[u];
        for (let k = 0; k < unite.length; k++) {
          if (grille[unite[k]]) masque &= ~(1 << grille[unite[k]]);
        }
      }
      liste[i] = masque;
    }
    return liste;
  }

  // ---------------------------------------------------------- Les techniques

  function chercherNu(grille, cand) {
    for (let i = 0; i < CASES; i++) {
      if (grille[i] === 0 && compterBits(cand[i]) === 1) {
        return {
          technique: 'nu',
          unite: blocDe(i),
          cases: [i],
          cible: i,
          chiffre: premierChiffre(cand[i]),
        };
      }
    }
    return null;
  }

  function chercherCache(grille, cand) {
    for (let u = 0; u < UNITES.length; u++) {
      const unite = UNITES[u];
      for (let v = 1; v <= 9; v++) {
        const places = [];
        for (let k = 0; k < unite.length; k++) {
          const i = unite[k];
          if (grille[i] === 0 && cand[i] >> v & 1) places.push(i);
        }
        if (places.length === 1) {
          return { technique: 'cache', unite: unite, cases: places, cible: places[0], chiffre: v };
        }
      }
    }
    return null;
  }

  /**
   * Applique les éliminations des paires et renvoie celle qui a servi, ou null.
   * Les candidats sont modifiés sur place.
   */
  function eliminerParPaires(grille, cand) {
    for (let u = 0; u < UNITES.length; u++) {
      const unite = UNITES[u];
      const doubles = {};
      for (let k = 0; k < unite.length; k++) {
        const i = unite[k];
        if (grille[i] === 0 && compterBits(cand[i]) === 2) {
          (doubles[cand[i]] = doubles[cand[i]] || []).push(i);
        }
      }
      for (const masque in doubles) {
        const paire = doubles[masque];
        if (paire.length !== 2) continue;
        let aRetire = false;
        for (let k = 0; k < unite.length; k++) {
          const i = unite[k];
          if (grille[i] === 0 && paire.indexOf(i) === -1 && cand[i] & masque) {
            cand[i] &= ~masque;
            aRetire = true;
          }
        }
        if (aRetire) {
          return { technique: 'paireNue', unite: unite, cases: paire, chiffres: Number(masque) };
        }
      }
    }

    for (let b = 0; b < BLOCS.length; b++) {
      const bloc = BLOCS[b];
      for (let v = 1; v <= 9; v++) {
        const places = [];
        for (let k = 0; k < bloc.length; k++) {
          const i = bloc[k];
          if (grille[i] === 0 && cand[i] >> v & 1) places.push(i);
        }
        if (places.length < 2 || places.length > 3) continue;

        const candidatesUnites = [LIGNES[Math.floor(places[0] / COTE)], COLONNES[places[0] % COTE]];
        for (let c = 0; c < candidatesUnites.length; c++) {
          const unite = candidatesUnites[c];
          const toutesDedans = places.every(function (i) {
            return unite.indexOf(i) !== -1;
          });
          if (!toutesDedans) continue;

          let aRetire = false;
          for (let k = 0; k < unite.length; k++) {
            const i = unite[k];
            if (bloc.indexOf(i) === -1 && grille[i] === 0 && cand[i] >> v & 1) {
              cand[i] &= ~(1 << v);
              aRetire = true;
            }
          }
          if (aRetire) {
            return { technique: 'pointante', unite: unite, bloc: bloc, cases: places, chiffre: v };
          }
        }
      }
    }
    return null;
  }

  /**
   * La prochaine déduction possible, décrite. Renvoie null si aucune des
   * techniques autorisées ne s'applique.
   */
  function prochaineEtape(grille, techniques) {
    const cand = candidats(grille);

    const nu = chercherNu(grille, cand);
    if (nu && techniques.indexOf('nu') !== -1) return nu;

    if (techniques.indexOf('cache') !== -1) {
      const cache = chercherCache(grille, cand);
      if (cache) return cache;
    }

    if (techniques.indexOf('paires') !== -1) {
      // Une élimination ne remplit rien : elle rogne les candidats. Il en faut
      // parfois plusieurs avant qu'une case ne se libère, et elles se cumulent
      // — d'où la boucle. On annonce la dernière, celle qui a débloqué.
      const avecCache = techniques.indexOf('cache') !== -1;
      for (let garde = 0; garde < 40; garde++) {
        const elimination = eliminerParPaires(grille, cand);
        if (!elimination) break;
        const debloque = chercherNu(grille, cand) || (avecCache ? chercherCache(grille, cand) : null);
        if (debloque) {
          elimination.cible = debloque.cible;
          elimination.chiffreCible = debloque.chiffre;
          return elimination;
        }
      }
    }
    return null;
  }

  /**
   * La grille se termine-t-elle avec ces seules techniques ?
   *
   * Version rapide, sans description : la fabrication d'une grille appelle
   * cette fonction une fois par case retirée, soit des centaines de fois par
   * grille. Elle tient donc les candidats à jour au fil de l'eau et remplit
   * toutes les cases évidentes d'un seul passage, là où `prochaineEtape`, qui
   * doit savoir *raconter* ce qu'elle fait, repart de zéro à chaque case.
   */
  function resoudre(depart, techniques) {
    const avecCache = techniques.indexOf('cache') !== -1;
    const avecPaires = techniques.indexOf('paires') !== -1;

    const grille = depart.slice();
    const cand = new Int32Array(CASES);
    let vides = 0;

    for (let i = 0; i < CASES; i++) {
      if (grille[i]) continue;
      vides++;
      let masque = TOUS;
      const voisines = VOISINES[i];
      for (let k = 0; k < voisines.length; k++) {
        if (grille[voisines[k]]) masque &= ~(1 << grille[voisines[k]]);
      }
      cand[i] = masque;
    }

    function placer(i, v) {
      grille[i] = v;
      cand[i] = 0;
      vides--;
      const voisines = VOISINES[i];
      for (let k = 0; k < voisines.length; k++) cand[voisines[k]] &= ~(1 << v);
    }

    while (vides > 0) {
      let avance = false;

      for (let i = 0; i < CASES; i++) {
        if (grille[i] !== 0) continue;
        const masque = cand[i];
        if (masque === 0) return false; // case sans candidat : impasse
        if ((masque & (masque - 1)) === 0) {
          placer(i, CHIFFRE_DU_BIT[masque]);
          avance = true;
        }
      }
      if (avance) continue;

      if (avecCache) {
        for (let u = 0; u < UNITES.length && !avance; u++) {
          const unite = UNITES[u];
          for (let v = 1; v <= 9; v++) {
            let place = -1;
            let combien = 0;
            for (let k = 0; k < unite.length; k++) {
              const i = unite[k];
              if (grille[i] === 0 && cand[i] >> v & 1) {
                place = i;
                if (++combien > 1) break;
              }
            }
            if (combien === 1) {
              placer(place, v);
              avance = true;
              break;
            }
          }
        }
        if (avance) continue;
      }

      if (avecPaires && eliminerParPaires(grille, cand)) continue;

      return false;
    }
    return true;
  }

  // ------------------------------------------------------------- Formulation

  function chiffresDe(masque) {
    const liste = [];
    for (let v = 1; v <= 9; v++) if (masque >> v & 1) liste.push(v);
    return liste;
  }

  /**
   * Les trois paliers d'un indice : d'abord où chercher, puis quel
   * raisonnement mener, enfin la réponse.
   */
  function formuler(etape) {
    const ou = nomUnite(etape.unite);

    if (etape.technique === 'nu') {
      return [
        `Une case de ${ou} n’accepte plus qu’un seul chiffre.`,
        'Cette case : barrez tout ce qui figure déjà sur sa ligne, sa colonne et son bloc, ' +
          'il n’en restera qu’un.',
      ];
    }

    if (etape.technique === 'cache') {
      return [
        `Dans ${ou}, un chiffre n’a plus qu’une seule place possible.`,
        `Dans ${ou}, le ${etape.chiffre} ne peut aller qu’à un seul endroit. Cherchez lequel.`,
      ];
    }

    if (etape.technique === 'paireNue') {
      const paire = chiffresDe(etape.chiffres);
      return [
        `Dans ${ou}, deux cases se partagent les deux mêmes chiffres.`,
        `Ces deux cases ne peuvent être que ${paire[0]} ou ${paire[1]} : ces chiffres leur sont ` +
          `réservés. Éliminez-les des autres cases de ${ou}, une case se débloque.`,
      ];
    }

    return [
      `Dans un bloc, un chiffre est confiné à ${ou}.`,
      `Dans ce bloc, le ${etape.chiffre} ne peut se placer que sur ${ou}. Il occupe donc ` +
        `${ou} pour ce bloc : éliminez-le du reste de ${ou}, une case se débloque.`,
    ];
  }

  JM.sudoku = {
    LIGNES: LIGNES,
    COLONNES: COLONNES,
    BLOCS: BLOCS,
    UNITES: UNITES,
    candidats: candidats,
    prochaineEtape: prochaineEtape,
    resoudre: resoudre,
    formuler: formuler,
  };
})(window);
