/*
 * Jeu 5 — Sudoku du jour.
 *
 * Une grille par jour et par niveau, identique pour tout le monde : le
 * générateur est le même que partout ailleurs sur le site, un tirage
 * déterministe dérivé de la date.
 *
 * La grille est construite en remplissant d'abord une solution complète par
 * retour sur trace, puis en retirant des cases une à une — en ne gardant un
 * retrait que si la grille conserve **une seule** solution. C'est ce contrôle
 * qui garantit qu'aucune partie ne demande de deviner.
 */
(function () {
  'use strict';

  const COTE = 9;
  const BLOC = 3;
  const CASES = 81;

  /*
   * Un niveau n'est pas un nombre de cases vides, c'est un type de
   * raisonnement. `techniques` dit ce que la grille a le droit d'exiger,
   * `plancher` ce qu'elle doit exiger de plus que le niveau inférieur — sans
   * lui, « difficile » ne voudrait dire que « plus long ».
   *
   * `erreursMax` à null : autant d'erreurs qu'on veut.
   */
  const NIVEAUX = {
    facile: { trous: 36, nom: 'Facile', erreursMax: null, techniques: ['nu'], plancher: null },
    moyen: {
      trous: 46,
      nom: 'Moyen',
      erreursMax: 5,
      techniques: ['nu', 'cache'],
      plancher: ['nu'],
    },
    difficile: {
      trous: 54,
      nom: 'Difficile',
      erreursMax: 3,
      techniques: ['nu', 'cache', 'paires'],
      plancher: ['nu', 'cache'],
    },
  };

  const CLE_PARTIE = 'sudoku.v1';
  const CLE_STATS = 'sudoku.stats.v1';
  const CLE_INDICES = 'sudoku.indices.v1';
  const INDICES_PAR_JOUR = 3;

  // ------------------------------------------------------------------- État

  const etat = {
    niveau: 'moyen',
    numeroJour: 0,
    depart: [], // 81 chiffres, 0 = case vide
    solution: [],
    saisie: [], // ce que le joueur a posé
    notes: [], // 81 ensembles de chiffres
    selection: null,
    modeNotes: false,
    erreurs: 0,
    secondes: 0,
    minuterie: null,
    termine: false,
    perdu: false,
    indice: null, // { etape, palier } : l'aide en cours, de plus en plus précise
    surbrillance: { unite: [], cases: [] },
  };

  const el = {
    jeu: document.getElementById('jeu'),
    chargement: document.getElementById('chargement'),
    grille: document.getElementById('grille'),
    pave: document.getElementById('pave'),
    chrono: document.getElementById('chrono'),
    restantes: document.getElementById('restantes'),
    erreurs: document.getElementById('erreurs'),
    niveaux: document.getElementById('niveaux'),
    messages: document.getElementById('messages'),
    annonce: document.getElementById('annonce'),
    btnNotes: document.getElementById('btn-notes'),
    modaleAide: document.getElementById('modale-aide'),
    modaleFin: document.getElementById('modale-fin'),
    bandeauIndice: document.getElementById('bandeau-indice'),
    indiceTexte: document.getElementById('indice-texte'),
    btnIndicePlus: document.getElementById('btn-indice-plus'),
  };

  // ------------------------------------------------- Générateur et solveur

  function grilleVide() {
    return new Array(CASES).fill(0);
  }

  function placementValide(grille, index, valeur) {
    const ligne = Math.floor(index / COTE);
    const colonne = index % COTE;
    for (let i = 0; i < COTE; i++) {
      if (grille[ligne * COTE + i] === valeur) return false;
      if (grille[i * COTE + colonne] === valeur) return false;
    }
    const bl = ligne - (ligne % BLOC);
    const bc = colonne - (colonne % BLOC);
    for (let l = bl; l < bl + BLOC; l++) {
      for (let c = bc; c < bc + BLOC; c++) {
        if (grille[l * COTE + c] === valeur) return false;
      }
    }
    return true;
  }

  function melange(tableau, rng) {
    const copie = tableau.slice();
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = copie[i];
      copie[i] = copie[j];
      copie[j] = t;
    }
    return copie;
  }

  /** Remplit une grille complète et valide, au hasard mais reproductible. */
  function remplir(grille, rng) {
    const index = grille.indexOf(0);
    if (index === -1) return true;
    const chiffres = melange([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (let i = 0; i < chiffres.length; i++) {
      if (placementValide(grille, index, chiffres[i])) {
        grille[index] = chiffres[i];
        if (remplir(grille, rng)) return true;
        grille[index] = 0;
      }
    }
    return false;
  }

  /**
   * Compte les solutions, en s'arrêtant à `limite` : deux suffisent à trancher.
   *
   * On explore toujours la case la plus contrainte plutôt que la première
   * venue. Chaque nœud coûte un peu plus cher à choisir, mais l'arbre exploré
   * est sans commune mesure : c'est la différence entre une grille fabriquée en
   * quelques millisecondes et une seconde d'attente.
   */
  function compterSolutions(grille, limite) {
    let compte = 0;
    const travail = grille.slice();

    function explorer() {
      if (compte >= limite) return;

      let meilleure = -1;
      let meilleurMasque = 0;
      let moins = 10;

      for (let i = 0; i < CASES; i++) {
        if (travail[i] !== 0) continue;
        let masque = 0;
        let combien = 0;
        for (let valeur = 1; valeur <= 9; valeur++) {
          if (placementValide(travail, i, valeur)) {
            masque |= 1 << valeur;
            combien++;
          }
        }
        if (combien === 0) return; // case sans candidat : cette branche est morte
        if (combien < moins) {
          moins = combien;
          meilleure = i;
          meilleurMasque = masque;
          if (combien === 1) break;
        }
      }

      if (meilleure === -1) {
        compte++;
        return;
      }

      for (let valeur = 1; valeur <= 9; valeur++) {
        if (!(meilleurMasque >> valeur & 1)) continue;
        travail[meilleure] = valeur;
        explorer();
        travail[meilleure] = 0;
        if (compte >= limite) return;
      }
    }

    explorer();
    return compte;
  }

  /**
   * La grille du jour pour ce niveau, avec deux garanties vérifiées à chaque
   * retrait : la solution reste unique, et la grille reste **déductible** avec
   * les seules techniques du niveau. La seconde est celle qui compte pour le
   * joueur — une grille à solution unique peut n'être finissable qu'en pariant
   * au hasard, ce qu'aucun indice ne saurait expliquer.
   *
   * Reste à vérifier qu'elle **exige** bien la technique de son niveau : si
   * celles du niveau inférieur suffisent, on retire et on recommence avec une
   * clé dérivée, déterministe donc identique pour tous les joueurs.
   */
  function genererGrille(cle, reglages) {
    let reserve = null;
    for (let essai = 1; essai <= 40; essai++) {
      const rng = JM.rng(essai === 1 ? cle : cle + '#' + essai);
      const solution = grilleVide();
      remplir(solution, rng);

      const depart = solution.slice();
      const ordre = melange(
        Array.from({ length: CASES }, function (_, i) {
          return i;
        }),
        rng
      );

      let retires = 0;
      for (let i = 0; i < ordre.length && retires < reglages.trous; i++) {
        const index = ordre[i];
        const memoire = depart[index];
        depart[index] = 0;
        if (compterSolutions(depart, 2) === 1 && JM.sudoku.resoudre(depart, reglages.techniques)) {
          retires++;
        } else {
          depart[index] = memoire;
        }
      }

      // Quelques cases de moins qu'espéré restent acceptables ; une grille trop
      // remplie, non.
      if (retires < reglages.trous - 4) continue;

      // Trop facile pour son niveau : les techniques d'en dessous suffisent.
      // On garde tout de même la première venue en réserve — mieux vaut une
      // grille un peu tendre qu'un écran d'erreur si le tirage s'acharne.
      if (reglages.plancher && JM.sudoku.resoudre(depart, reglages.plancher)) {
        if (!reserve) reserve = { depart: depart, solution: solution };
        continue;
      }

      return { depart: depart, solution: solution };
    }
    return reserve;
  }

  // --------------------------------------------------------------- Démarrage

  JM.prefs.appliquer();

  const niveauDemande = new URLSearchParams(location.search).get('niveau');
  const partieEnCours = JM.storage.lire(CLE_PARTIE, null);
  etat.numeroJour = JM.numeroJour();

  if (NIVEAUX[niveauDemande]) etat.niveau = niveauDemande;
  else if (partieEnCours && partieEnCours.jour === etat.numeroJour && NIVEAUX[partieEnCours.niveau]) {
    etat.niveau = partieEnCours.niveau;
  }

  // La génération prend quelques dizaines de millisecondes : on laisse le
  // navigateur peindre l'écran de chargement avant de la lancer.
  setTimeout(function () {
    demarrerNiveau(etat.niveau);
    el.chargement.hidden = true;
    el.jeu.hidden = false;
  }, 16);

  function demarrerNiveau(niveau) {
    etat.niveau = niveau;
    arreterChrono();

    const grille = genererGrille(`sudoku:${niveau}:${JM.dateISO()}`, NIVEAUX[niveau]);
    if (!grille) throw new Error('génération impossible au niveau ' + niveau);
    etat.depart = grille.depart;
    etat.solution = grille.solution;
    etat.saisie = grille.depart.slice();
    etat.notes = Array.from({ length: CASES }, function () {
      return [];
    });
    etat.selection = null;
    etat.erreurs = 0;
    etat.secondes = 0;
    etat.termine = false;
    etat.perdu = false;
    etat.indice = null;
    etat.surbrillance = { unite: [], cases: [] };
    cacherIndice();

    restaurer();
    construireGrille();
    construirePave();
    majNiveaux();
    majEntete();
    dessiner();
    if (!etat.termine) lancerChrono();
  }

  // ------------------------------------------------------------ Construction

  const cases = [];

  function construireGrille() {
    el.grille.innerHTML = '';
    cases.length = 0;
    for (let i = 0; i < CASES; i++) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'case-sudoku';
      bouton.dataset.index = i;
      const ligne = Math.floor(i / COTE);
      const colonne = i % COTE;
      if (colonne % BLOC === 0 && colonne > 0) bouton.classList.add('bord-gauche');
      if (ligne % BLOC === 0 && ligne > 0) bouton.classList.add('bord-haut');
      el.grille.appendChild(bouton);
      cases.push(bouton);
    }
  }

  function construirePave() {
    if (el.pave.children.length) return;
    for (let chiffre = 1; chiffre <= 9; chiffre++) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'touche-chiffre';
      bouton.dataset.chiffre = chiffre;
      bouton.innerHTML = chiffre + '<span class="reste"></span>';
      el.pave.appendChild(bouton);
    }
  }

  // ------------------------------------------------------------- Affichage

  function dessiner() {
    const selection = etat.selection;
    const valeurSelection = selection !== null ? etat.saisie[selection] : 0;

    for (let i = 0; i < CASES; i++) {
      const bouton = cases[i];
      const valeur = etat.saisie[i];
      const donnee = etat.depart[i] !== 0;

      bouton.className = 'case-sudoku';
      const ligne = Math.floor(i / COTE);
      const colonne = i % COTE;
      if (colonne % BLOC === 0 && colonne > 0) bouton.classList.add('bord-gauche');
      if (ligne % BLOC === 0 && ligne > 0) bouton.classList.add('bord-haut');

      if (donnee) bouton.classList.add('donnee');
      if (valeur !== 0 && !donnee && valeur !== etat.solution[i]) bouton.classList.add('fausse');

      if (etat.surbrillance.unite.indexOf(i) !== -1) bouton.classList.add('indice-region');
      if (etat.surbrillance.cases.indexOf(i) !== -1) bouton.classList.add('indice-case');

      if (selection !== null) {
        const ls = Math.floor(selection / COTE);
        const cs = selection % COTE;
        const memeBloc =
          Math.floor(ligne / BLOC) === Math.floor(ls / BLOC) &&
          Math.floor(colonne / BLOC) === Math.floor(cs / BLOC);
        if (ligne === ls || colonne === cs || memeBloc) bouton.classList.add('voisine');
        if (i === selection) bouton.classList.add('selectionnee');
        if (valeur !== 0 && valeur === valeurSelection) bouton.classList.add('meme-chiffre');
      }

      if (valeur !== 0) {
        bouton.textContent = valeur;
      } else if (etat.notes[i].length) {
        bouton.innerHTML = etat.notes[i]
          .slice()
          .sort()
          .map(function (n) {
            return '<span>' + n + '</span>';
          })
          .join('');
        bouton.classList.add('avec-notes');
      } else {
        bouton.textContent = '';
      }

      bouton.setAttribute(
        'aria-label',
        `ligne ${ligne + 1}, colonne ${colonne + 1}, ${valeur === 0 ? 'vide' : valeur}`
      );
    }

    // Chaque touche du pavé indique combien de fois son chiffre reste à poser.
    Array.prototype.forEach.call(el.pave.children, function (touche) {
      const chiffre = parseInt(touche.dataset.chiffre, 10);
      let poses = 0;
      for (let i = 0; i < CASES; i++) {
        if (etat.saisie[i] === chiffre && etat.saisie[i] === etat.solution[i]) poses++;
      }
      const reste = COTE - poses;
      touche.querySelector('.reste').textContent = reste > 0 ? reste : '';
      touche.classList.toggle('touche-chiffre--finie', reste === 0);
    });

    majEntete();
  }

  function majEntete() {
    // Cases restant à résoudre, et non cases vides : un chiffre faux laisse la
    // case à faire, et le compteur doit tomber à zéro en même temps que la
    // victoire, qui se juge elle aussi par rapport à la solution.
    let restantes = 0;
    for (let i = 0; i < CASES; i++) if (etat.saisie[i] !== etat.solution[i]) restantes++;
    el.restantes.textContent = restantes;

    const plafond = NIVEAUX[etat.niveau].erreursMax;
    el.erreurs.textContent = plafond ? etat.erreurs + ' / ' + plafond : etat.erreurs;
    // Rouge à la dernière erreur permise, pour prévenir avant la sanction.
    el.erreurs.classList.toggle('erreurs--critique', !!plafond && etat.erreurs >= plafond - 1);
  }

  function majNiveaux() {
    Array.prototype.forEach.call(el.niveaux.children, function (bouton) {
      bouton.classList.toggle('niveau--actif', bouton.dataset.niveau === etat.niveau);
      bouton.setAttribute('aria-pressed', bouton.dataset.niveau === etat.niveau);
    });
  }

  // ------------------------------------------------------------------ Jeu

  el.grille.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('.case-sudoku');
    if (!bouton) return;
    etat.selection = parseInt(bouton.dataset.index, 10);
    dessiner();
  });

  el.pave.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('.touche-chiffre');
    if (!bouton) return;
    poser(parseInt(bouton.dataset.chiffre, 10));
  });

  document.getElementById('btn-effacer').addEventListener('click', effacer);
  el.btnNotes.addEventListener('click', basculerNotes);
  document.getElementById('btn-indice').addEventListener('click', donnerIndice);
  el.btnIndicePlus.addEventListener('click', donnerIndice);

  document.getElementById('btn-indice-fermer').addEventListener('click', function () {
    // On garde l'indice en mémoire : le joueur l'a payé, la prochaine pression
    // poursuivra le même raisonnement au lieu d'en ouvrir un autre.
    cacherIndice();
    etat.surbrillance = { unite: [], cases: [] };
    dessiner();
  });

  document.addEventListener('keydown', function (evenement) {
    if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
    if (document.querySelector('dialog[open]')) return;

    const touche = evenement.key;
    if (touche >= '1' && touche <= '9') {
      poser(parseInt(touche, 10));
      evenement.preventDefault();
    } else if (touche === 'Backspace' || touche === 'Delete' || touche === '0') {
      effacer();
      evenement.preventDefault();
    } else if (touche === 'n' || touche === 'N') {
      basculerNotes();
    } else if (touche.indexOf('Arrow') === 0) {
      deplacer(touche);
      evenement.preventDefault();
    }
  });

  function deplacer(touche) {
    if (etat.selection === null) {
      etat.selection = 0;
      dessiner();
      return;
    }
    let ligne = Math.floor(etat.selection / COTE);
    let colonne = etat.selection % COTE;
    if (touche === 'ArrowUp') ligne = (ligne + COTE - 1) % COTE;
    if (touche === 'ArrowDown') ligne = (ligne + 1) % COTE;
    if (touche === 'ArrowLeft') colonne = (colonne + COTE - 1) % COTE;
    if (touche === 'ArrowRight') colonne = (colonne + 1) % COTE;
    etat.selection = ligne * COTE + colonne;
    dessiner();
  }

  function poser(chiffre) {
    if (etat.termine || etat.selection === null) return;
    const index = etat.selection;
    if (etat.depart[index] !== 0) {
      message('Cette case fait partie de la grille', 'refus');
      return;
    }

    if (etat.modeNotes) {
      const notes = etat.notes[index];
      const position = notes.indexOf(chiffre);
      if (position === -1) notes.push(chiffre);
      else notes.splice(position, 1);
      dessiner();
      sauvegarder();
      return;
    }

    etat.saisie[index] = chiffre;
    etat.notes[index] = [];
    // Le joueur a joué : l'indice affiché ne décrit plus la grille.
    if (etat.indice && etat.indice.etape.cible === index) {
      etat.indice = null;
      cacherIndice();
    }
    etat.surbrillance = { unite: [], cases: [] };
    if (chiffre !== etat.solution[index]) {
      etat.erreurs++;
      el.annonce.textContent = 'Chiffre incorrect.';
      const plafond = NIVEAUX[etat.niveau].erreursMax;
      if (plafond && etat.erreurs >= plafond) {
        dessiner();
        perdre();
        return;
      }
      const reste = plafond ? plafond - etat.erreurs : 0;
      if (plafond && reste <= 2) {
        message(reste === 1 ? 'Plus qu’une erreur permise' : reste + ' erreurs permises', 'refus');
      }
    } else {
      nettoyerNotes(index, chiffre);
    }

    dessiner();
    sauvegarder();
    verifierVictoire();
  }

  /** Retire le chiffre posé des notes de sa ligne, sa colonne et son bloc. */
  function nettoyerNotes(index, chiffre) {
    const ligne = Math.floor(index / COTE);
    const colonne = index % COTE;
    for (let i = 0; i < CASES; i++) {
      const l = Math.floor(i / COTE);
      const c = i % COTE;
      const memeBloc =
        Math.floor(l / BLOC) === Math.floor(ligne / BLOC) &&
        Math.floor(c / BLOC) === Math.floor(colonne / BLOC);
      if (l === ligne || c === colonne || memeBloc) {
        const position = etat.notes[i].indexOf(chiffre);
        if (position !== -1) etat.notes[i].splice(position, 1);
      }
    }
  }

  function effacer() {
    if (etat.termine || etat.selection === null) return;
    const index = etat.selection;
    if (etat.depart[index] !== 0) return;
    etat.saisie[index] = 0;
    etat.notes[index] = [];
    dessiner();
    sauvegarder();
  }

  function basculerNotes() {
    etat.modeNotes = !etat.modeNotes;
    el.btnNotes.classList.toggle('actif', etat.modeNotes);
    el.btnNotes.setAttribute('aria-pressed', etat.modeNotes);
  }

  // -------------------------------------------------------------- Indices

  function lireIndices() {
    const brut = JM.storage.lire(CLE_INDICES, null);
    if (!brut || brut.jour !== etat.numeroJour) return { jour: etat.numeroJour, utilises: 0 };
    return brut;
  }

  /**
   * L'indice reste à l'écran : c'est une consigne, pas une notification. Il ne
   * s'efface qu'une fois la case trouvée, ou si le joueur le renvoie.
   */
  function afficherIndice(texte, reste, libelleSuite) {
    el.indiceTexte.innerHTML =
      echapper(texte) +
      '<span class="indice-reste">' +
      (reste > 0
        ? reste + ' indice' + (reste > 1 ? 's' : '') + ' restant' + (reste > 1 ? 's' : '')
        : 'dernier indice du jour') +
      '</span>';
    el.btnIndicePlus.textContent = libelleSuite;
    el.btnIndicePlus.hidden = reste === 0;
    el.bandeauIndice.hidden = false;
    el.annonce.textContent = texte;
  }

  function cacherIndice() {
    el.bandeauIndice.hidden = true;
  }

  function echapper(texte) {
    const div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }

  /**
   * Trois paliers sur la même déduction : où chercher, quel raisonnement mener,
   * puis seulement la réponse. Chaque pression coûte un indice — trois coups de
   * pouce, ou une réponse toute faite : au joueur de choisir.
   */
  function donnerIndice() {
    if (etat.termine) return;
    const compteur = lireIndices();
    if (compteur.utilises >= INDICES_PAR_JOUR) {
      message('Plus d’indice avant demain', 'refus');
      return;
    }

    // Le raisonnement se mène sur la grille telle qu'elle devrait être : un
    // chiffre faux du joueur fausserait tous les candidats.
    const propre = etat.saisie.map(function (valeur, i) {
      return valeur === etat.solution[i] ? valeur : 0;
    });

    const enCoursValide =
      etat.indice && etat.saisie[etat.indice.etape.cible] !== etat.solution[etat.indice.etape.cible];

    if (!enCoursValide) {
      const etape = JM.sudoku.prochaineEtape(propre, NIVEAUX[etat.niveau].techniques);
      if (!etape) {
        // Ne devrait pas arriver : la grille est fabriquée pour rester
        // déductible. On le dit plutôt que de faire semblant.
        message('Aucun raisonnement simple ici', 'refus');
        return;
      }
      etat.indice = { etape: etape, palier: 0 };
    }

    etat.indice.palier += 1;
    compteur.utilises += 1;
    JM.storage.ecrire(CLE_INDICES, compteur);

    const etape = etat.indice.etape;
    const phrases = JM.sudoku.formuler(etape);
    const reste = INDICES_PAR_JOUR - compteur.utilises;
    const suffixe =
      reste > 0 ? ` · ${reste} indice${reste > 1 ? 's' : ''} restant${reste > 1 ? 's' : ''}` : '';

    if (etat.indice.palier === 1) {
      etat.surbrillance = { unite: etape.unite, cases: [] };
      afficherIndice(phrases[0], reste, 'Plus précis');
    } else if (etat.indice.palier === 2) {
      // Le singleton nu ne veut rien dire sans sa case : on la montre.
      etat.surbrillance = {
        unite: etape.unite,
        cases: etape.technique === 'nu' ? [etape.cible] : etape.cases,
      };
      afficherIndice(phrases[1], reste, 'Révéler la case');
    } else {
      const chiffre = etape.chiffreCible || etape.chiffre;
      etat.saisie[etape.cible] = chiffre;
      etat.notes[etape.cible] = [];
      nettoyerNotes(etape.cible, chiffre);
      etat.selection = etape.cible;
      etat.indice = null;
      etat.surbrillance = { unite: [], cases: [] };
      cacherIndice();
      message('Case révélée' + suffixe, 'succes');
      dessiner();
      sauvegarder();
      verifierVictoire();
      return;
    }

    dessiner();
  }

  // ---------------------------------------------------------------- Chrono

  function lancerChrono() {
    arreterChrono();
    etat.minuterie = setInterval(function () {
      etat.secondes++;
      afficherChrono();
      if (etat.secondes % 10 === 0) sauvegarder();
    }, 1000);
    afficherChrono();
  }

  function arreterChrono() {
    if (etat.minuterie) clearInterval(etat.minuterie);
    etat.minuterie = null;
  }

  function afficherChrono() {
    const minutes = Math.floor(etat.secondes / 60);
    const secondes = etat.secondes % 60;
    el.chrono.textContent = minutes + ':' + String(secondes).padStart(2, '0');
  }

  // ------------------------------------------------------------- Victoire

  function perdre() {
    etat.termine = true;
    etat.perdu = true;
    arreterChrono();
    sauvegarder();
    setTimeout(ouvrirFin, 400);
  }

  function verifierVictoire() {
    for (let i = 0; i < CASES; i++) {
      if (etat.saisie[i] !== etat.solution[i]) return;
    }
    etat.termine = true;
    arreterChrono();
    majStats();
    sauvegarder();
    setTimeout(ouvrirFin, 400);
  }

  function ouvrirFin() {
    const stats = lireStats();
    const plafond = NIVEAUX[etat.niveau].erreursMax;

    document.getElementById('fin-niveau').textContent = NIVEAUX[etat.niveau].nom;
    document.getElementById('fin-temps').textContent = formatDuree(etat.secondes);
    document.getElementById('fin-erreurs').textContent = plafond
      ? etat.erreurs + ' / ' + plafond
      : etat.erreurs;
    const record = stats.records[etat.niveau];
    document.getElementById('fin-record').textContent = record ? formatDuree(record) : '—';

    document.getElementById('fin-titre').textContent = etat.perdu
      ? 'Trop d’erreurs'
      : 'Grille terminée';
    document.getElementById('fin-mot').textContent = etat.perdu
      ? `💥 ${plafond} erreurs au niveau ${NIVEAUX[etat.niveau].nom.toLowerCase()}, la grille est perdue.`
      : etat.erreurs === 0
      ? '🏆 Sans faute, chapeau.'
      : '🎉 Grille résolue.';
    document.getElementById('btn-rejouer').hidden = !etat.perdu;
    // Rien à partager d'une grille perdue : on ne propose que la réussite.
    document.getElementById('btn-partager').hidden = etat.perdu;

    el.modaleFin.showModal();
  }

  function formatDuree(secondes) {
    const m = Math.floor(secondes / 60);
    const s = secondes % 60;
    return m + ' min ' + String(s).padStart(2, '0');
  }

  function lireStats() {
    const stats = JM.storage.lire(CLE_STATS, null) || { parties: 0, records: {} };
    if (!stats.records) stats.records = {};
    return stats;
  }

  function majStats() {
    const stats = lireStats();
    stats.parties += 1;
    const record = stats.records[etat.niveau];
    if (!record || etat.secondes < record) stats.records[etat.niveau] = etat.secondes;
    JM.storage.ecrire(CLE_STATS, stats);
  }

  // ------------------------------------------------------------ Sauvegarde

  function sauvegarder() {
    JM.storage.ecrire(CLE_PARTIE, {
      jour: etat.numeroJour,
      niveau: etat.niveau,
      // La grille de départ est enregistrée avec la partie : si le générateur
      // change, une sauvegarde de la veille ne doit pas se recoller sur une
      // grille différente.
      depart: etat.depart.join(''),
      saisie: etat.saisie.join(''),
      notes: etat.notes.map(function (n) {
        return n.join('');
      }),
      erreurs: etat.erreurs,
      secondes: etat.secondes,
      termine: etat.termine,
      perdu: etat.perdu,
    });
  }

  function restaurer() {
    const partie = JM.storage.lire(CLE_PARTIE, null);
    if (
      !partie ||
      partie.jour !== etat.numeroJour ||
      partie.niveau !== etat.niveau ||
      partie.depart !== etat.depart.join('') ||
      !partie.saisie ||
      partie.saisie.length !== CASES
    ) {
      JM.storage.effacer(CLE_PARTIE);
      return;
    }
    etat.saisie = partie.saisie.split('').map(Number);
    if (Array.isArray(partie.notes)) {
      etat.notes = partie.notes.map(function (n) {
        return String(n).split('').map(Number).filter(Boolean);
      });
    }
    etat.erreurs = partie.erreurs || 0;
    etat.secondes = partie.secondes || 0;
    etat.termine = !!partie.termine;
    etat.perdu = !!partie.perdu;
    if (etat.termine) setTimeout(ouvrirFin, 300);
  }

  // -------------------------------------------------------------- Commandes

  el.niveaux.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('[data-niveau]');
    if (!bouton || bouton.dataset.niveau === etat.niveau) return;
    demarrerNiveau(bouton.dataset.niveau);
  });

  document.getElementById('btn-rejouer').addEventListener('click', function () {
    el.modaleFin.close();
    JM.storage.effacer(CLE_PARTIE);
    demarrerNiveau(etat.niveau);
  });

  document.getElementById('btn-partager').addEventListener('click', function () {
    const texte = JM.partage.composer([
      `Sudoku n°${etat.numeroJour + 1} — ${NIVEAUX[etat.niveau].nom.toLowerCase()}`,
      etat.erreurs === 0
        ? `🏆 Résolu en ${formatDuree(etat.secondes)}, sans faute`
        : `Résolu en ${formatDuree(etat.secondes)}, ` +
          `${etat.erreurs} erreur${etat.erreurs > 1 ? 's' : ''}`,
    ]);
    JM.partage.copier(texte).then(function (ok) {
      message(ok ? 'Résultat copié' : 'Copie impossible', ok ? 'succes' : 'refus');
    });
  });

  document.getElementById('btn-aide').addEventListener('click', function () {
    el.modaleAide.showModal();
  });

  document.getElementById('btn-recommencer').addEventListener('click', function () {
    JM.confirme({
      titre: 'Recommencer cette grille ?',
      texte: 'Les chiffres posés, les notes et le chrono repartent de zéro.',
      annuler: 'Annuler',
      ok: 'Recommencer',
    }).then(function (accepte) {
      if (!accepte) return;
      JM.storage.effacer(CLE_PARTIE);
      demarrerNiveau(etat.niveau);
    });
  });

  document.querySelectorAll('[data-fermer]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      bouton.closest('dialog').close();
    });
  });

  [el.modaleAide, el.modaleFin].forEach(function (modale) {
    modale.addEventListener('click', function (evenement) {
      if (evenement.target === modale) modale.close();
    });
  });

  function message(texte, genre) {
    JM.message(el.messages, texte, { genre: genre, duree: 1600 });
  }

  window.addEventListener('pagehide', function () {
    if (!etat.termine) sauvegarder();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && !etat.termine) sauvegarder();
  });
})();
