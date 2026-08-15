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

  const NIVEAUX = {
    facile: { trous: 36, nom: 'Facile' },
    moyen: { trous: 46, nom: 'Moyen' },
    difficile: { trous: 54, nom: 'Difficile' },
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

  /** Compte les solutions, en s'arrêtant à `limite` : deux suffisent à trancher. */
  function compterSolutions(grille, limite) {
    let compte = 0;
    const travail = grille.slice();

    function explorer() {
      if (compte >= limite) return;
      const index = travail.indexOf(0);
      if (index === -1) {
        compte++;
        return;
      }
      for (let valeur = 1; valeur <= 9; valeur++) {
        if (placementValide(travail, index, valeur)) {
          travail[index] = valeur;
          explorer();
          travail[index] = 0;
          if (compte >= limite) return;
        }
      }
    }

    explorer();
    return compte;
  }

  function genererGrille(cle, trous) {
    const rng = JM.rng(cle);
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
    for (let i = 0; i < ordre.length && retires < trous; i++) {
      const index = ordre[i];
      const memoire = depart[index];
      depart[index] = 0;
      // Un retrait n'est gardé que si la grille garde une solution unique.
      if (compterSolutions(depart, 2) !== 1) depart[index] = memoire;
      else retires++;
    }

    return { depart: depart, solution: solution };
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

    const grille = genererGrille(`sudoku:${niveau}:${JM.dateISO()}`, NIVEAUX[niveau].trous);
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
    el.erreurs.textContent = etat.erreurs;
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
    if (chiffre !== etat.solution[index]) {
      etat.erreurs++;
      el.annonce.textContent = 'Chiffre incorrect.';
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

  function donnerIndice() {
    if (etat.termine) return;
    const compteur = lireIndices();
    if (compteur.utilises >= INDICES_PAR_JOUR) {
      message('Plus d’indice avant demain', 'refus');
      return;
    }

    // La case sélectionnée si elle est vide ou fausse, sinon une case au hasard.
    let cible = null;
    if (etat.selection !== null && etat.saisie[etat.selection] !== etat.solution[etat.selection]) {
      cible = etat.selection;
    } else {
      const candidates = [];
      for (let i = 0; i < CASES; i++) {
        if (etat.saisie[i] !== etat.solution[i]) candidates.push(i);
      }
      if (candidates.length === 0) return;
      cible = candidates[Math.floor(Math.random() * candidates.length)];
    }

    etat.saisie[cible] = etat.solution[cible];
    etat.notes[cible] = [];
    nettoyerNotes(cible, etat.solution[cible]);
    etat.selection = cible;

    compteur.utilises += 1;
    JM.storage.ecrire(CLE_INDICES, compteur);
    const reste = INDICES_PAR_JOUR - compteur.utilises;
    message(
      `Case révélée · ${reste} indice${reste > 1 ? 's' : ''} restant${reste > 1 ? 's' : ''}`,
      'succes'
    );

    dessiner();
    sauvegarder();
    verifierVictoire();
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
    document.getElementById('fin-niveau').textContent = NIVEAUX[etat.niveau].nom;
    document.getElementById('fin-temps').textContent = formatDuree(etat.secondes);
    document.getElementById('fin-erreurs').textContent = etat.erreurs;
    const record = stats.records[etat.niveau];
    document.getElementById('fin-record').textContent = record ? formatDuree(record) : '—';
    document.getElementById('fin-mot').textContent =
      etat.erreurs === 0 ? '🏆 Sans faute, chapeau.' : '🎉 Grille résolue.';
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
      saisie: etat.saisie.join(''),
      notes: etat.notes.map(function (n) {
        return n.join('');
      }),
      erreurs: etat.erreurs,
      secondes: etat.secondes,
      termine: etat.termine,
    });
  }

  function restaurer() {
    const partie = JM.storage.lire(CLE_PARTIE, null);
    if (
      !partie ||
      partie.jour !== etat.numeroJour ||
      partie.niveau !== etat.niveau ||
      !partie.saisie ||
      partie.saisie.length !== CASES
    ) {
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
    if (etat.termine) setTimeout(ouvrirFin, 300);
  }

  // -------------------------------------------------------------- Commandes

  el.niveaux.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('[data-niveau]');
    if (!bouton || bouton.dataset.niveau === etat.niveau) return;
    demarrerNiveau(bouton.dataset.niveau);
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
