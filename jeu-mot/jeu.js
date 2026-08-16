/*
 * Jeu 2 — Mot mystère (FR)
 *
 * Un mot à deviner en 6 tentatives, identique pour tout le monde chaque jour.
 *  - le mot à trouver est tiré dans les formes de base (fr_lemmes_base_67k) ;
 *  - les propositions sont validées contre toutes les formes fléchies
 *    (fr_formes_completes_469k) : pluriels et conjugaisons acceptés ;
 *  - tout est comparé sans accents, le mot n'est réaffiché accentué qu'à la fin.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Réglages

  const LONGUEUR_PAR_DEFAUT = 5; // variante 6 lettres : ?lettres=6 dans l'URL
  const MAX_ESSAIS = 6;
  const DICO_PROPOSITIONS = 'fr_formes_completes_469k.txt';

  // Le mot à deviner est tiré d'une liste triée à la main (mots courants
  // seulement) quand elle existe pour cette longueur ; sinon on retombe sur
  // toutes les formes de base, obscurités comprises.
  const DICO_SOLUTIONS = (n) => `fr_solutions_${n}.txt`;
  const DICO_SOLUTIONS_SECOURS = 'fr_lemmes_base_67k.txt';

  // Mots à ne jamais tirer comme solution. Ajouter ici les cas gênants
  // repérés à l'usage.
  const MOTS_EXCLUS = [];

  // Les deux touches d'action ont leur propre rangée, en bas : coincées entre
  // les lettres elles étaient étroites et se touchaient par erreur.
  const CLAVIER = [
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n'],
    ['retour', 'entree'],
  ];

  const EMOJIS = {
    standard: { juste: '🟩', present: '🟨', absent: '⬜' },
    distincte: { juste: '🟦', present: '🟧', absent: '⬜' },
  };

  // ------------------------------------------------------------------- État

  const longueur = (function () {
    const demande = parseInt(new URLSearchParams(location.search).get('lettres'), 10);
    return demande >= 4 && demande <= 9 ? demande : LONGUEUR_PAR_DEFAUT;
  })();

  const CLE_PARTIE = `mot${longueur}.v1`;
  const CLE_STATS = `mot${longueur}.stats.v1`;

  const etat = {
    solution: '',
    graphieSolution: '',
    numeroJour: 0,
    essais: [], // mots normalisés déjà proposés
    saisie: '',
    termine: false,
    gagne: false,
    verrou: true, // bloque la saisie pendant les animations et le chargement
    propositions: null,
  };

  const el = {
    jeu: document.getElementById('jeu'),
    chargement: document.getElementById('chargement'),
    erreur: document.getElementById('erreur'),
    plateau: document.getElementById('plateau'),
    clavier: document.getElementById('clavier'),
    messages: document.getElementById('messages'),
    annonce: document.getElementById('annonce'),
    modaleAide: document.getElementById('modale-aide'),
    modaleStats: document.getElementById('modale-stats'),
  };

  const touches = new Map(); // lettre -> <button>

  // --------------------------------------------------------------- Démarrage

  JM.prefs.appliquer();

  const bornes = { min: longueur, max: longueur };

  Promise.all([
    JM.chargerDico(DICO_SOLUTIONS(longueur), bornes).catch(function () {
      return JM.chargerDico(DICO_SOLUTIONS_SECOURS, bornes);
    }),
    JM.chargerDico(DICO_PROPOSITIONS, bornes),
  ])
    .then(function (dicos) {
      const solutions = dicos[0];
      const propositions = dicos[1];
      etat.propositions = propositions;

      // Une solution doit aussi être une proposition valide.
      const exclus = new Set(MOTS_EXCLUS.map(JM.normaliser));
      const pool = solutions.liste.filter(function (mot) {
        return propositions.mots.has(mot) && !exclus.has(mot);
      });

      if (pool.length === 0) {
        throw new Error(`aucun mot de ${longueur} lettres dans le dictionnaire des solutions`);
      }

      etat.numeroJour = JM.numeroJour();
      etat.solution = JM.tirageSansRepetition(pool, etat.numeroJour, `jeu-mot:${longueur}`);
      etat.graphieSolution = JM.graphie(solutions, etat.solution);

      construirePlateau();
      construireClavier();
      suivreTaille();
      restaurerPartie();

      el.chargement.hidden = true;
      el.jeu.hidden = false;
      etat.verrou = etat.termine;
    })
    .catch(function (erreur) {
      el.chargement.hidden = true;
      el.erreur.hidden = false;
      el.erreur.textContent = JM.messageErreurDico(erreur);
    });

  // ------------------------------------------------------------- Construction

  function construirePlateau() {
    el.plateau.style.setProperty('--colonnes', longueur);
    for (let ligne = 0; ligne < MAX_ESSAIS; ligne++) {
      const divLigne = document.createElement('div');
      divLigne.className = 'ligne';
      divLigne.setAttribute('role', 'row');
      for (let colonne = 0; colonne < longueur; colonne++) {
        const divCase = document.createElement('div');
        divCase.className = 'case';
        divCase.setAttribute('role', 'gridcell');
        divCase.setAttribute('aria-label', `ligne ${ligne + 1}, lettre ${colonne + 1}, vide`);
        divLigne.appendChild(divCase);
      }
      el.plateau.appendChild(divLigne);
    }
  }

  /**
   * Le plateau doit tenir dans la place laissée par l'en-tête et le clavier.
   * On mesure cette place et on la transmet au CSS, plus fiable que les unités
   * de viewport sur mobile où la barre d'adresse fait varier la hauteur.
   */
  function suivreTaille() {
    const zone = document.querySelector('.plateau-zone');
    const ajuster = function () {
      const dispo = zone.clientHeight - 24; // moins le padding vertical
      el.plateau.style.setProperty('--hauteur-dispo', Math.max(dispo, 120) + 'px');
    };
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(ajuster).observe(zone);
    } else {
      window.addEventListener('resize', ajuster);
    }
    ajuster();
  }

  function construireClavier() {
    CLAVIER.forEach(function (rangee, index) {
      const divRangee = document.createElement('div');
      divRangee.className =
        'clavier-ligne' + (index === CLAVIER.length - 1 ? ' clavier-ligne--actions' : '');
      rangee.forEach(function (cle) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'touche';
        bouton.dataset.cle = cle;
        if (cle === 'entree') {
          bouton.textContent = 'Entrée';
          bouton.classList.add('touche--entree');
        } else if (cle === 'retour') {
          bouton.innerHTML = '⌫ <span class="touche-libelle">Effacer</span>';
          bouton.setAttribute('aria-label', 'Effacer la dernière lettre');
          bouton.classList.add('touche--retour');
        } else {
          bouton.textContent = cle;
          bouton.setAttribute('aria-label', 'lettre ' + cle);
          touches.set(cle, bouton);
        }
        divRangee.appendChild(bouton);
      });
      el.clavier.appendChild(divRangee);
    });

    el.clavier.addEventListener('click', function (evenement) {
      const bouton = evenement.target.closest('.touche');
      if (!bouton) return;
      bouton.blur(); // sinon la barre d'espace rejouerait la dernière touche
      appuyer(bouton.dataset.cle);
    });
  }

  // ----------------------------------------------------------------- Saisie

  document.addEventListener('keydown', function (evenement) {
    if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
    if (document.querySelector('dialog[open]')) return;

    const touche = evenement.key;
    if (touche === 'Enter') {
      appuyer('entree');
      evenement.preventDefault();
    } else if (touche === 'Backspace') {
      appuyer('retour');
      evenement.preventDefault();
    } else if (touche.length === 1) {
      const lettre = JM.normaliser(touche);
      if (/^[a-z]$/.test(lettre)) {
        appuyer(lettre);
        evenement.preventDefault();
      }
    }
  });

  function appuyer(cle) {
    if (etat.verrou || etat.termine) return;
    if (cle === 'entree') {
      valider();
    } else if (cle === 'retour') {
      if (etat.saisie.length > 0) {
        etat.saisie = etat.saisie.slice(0, -1);
        afficherSaisie();
      }
    } else if (etat.saisie.length < longueur) {
      etat.saisie += cle;
      afficherSaisie();
    }
  }

  function afficherSaisie() {
    const ligne = el.plateau.children[etat.essais.length];
    if (!ligne) return;
    for (let i = 0; i < longueur; i++) {
      const laCase = ligne.children[i];
      const lettre = etat.saisie[i] || '';
      if (laCase.textContent === lettre) continue;

      laCase.textContent = lettre;
      laCase.classList.remove('case--remplie');
      if (lettre) {
        void laCase.offsetWidth; // relance l'animation d'apparition
        laCase.classList.add('case--remplie');
      }
      laCase.setAttribute(
        'aria-label',
        `ligne ${etat.essais.length + 1}, lettre ${i + 1}, ${lettre || 'vide'}`
      );
    }
  }

  // -------------------------------------------------------------- Validation

  function valider() {
    if (etat.saisie.length < longueur) {
      refuser(`Il faut ${longueur} lettres`);
      return;
    }
    if (!etat.propositions.mots.has(etat.saisie)) {
      refuser('Ce mot n’est pas dans le dictionnaire');
      return;
    }
    if (etat.essais.indexOf(etat.saisie) !== -1) {
      refuser('Mot déjà proposé');
      return;
    }

    const mot = etat.saisie;
    etat.essais.push(mot);
    etat.saisie = '';
    etat.verrou = true;

    const etats = evaluer(mot, etat.solution);
    revelerLigne(etat.essais.length - 1, mot, etats, false, function () {
      const gagne = mot === etat.solution;
      const perdu = !gagne && etat.essais.length >= MAX_ESSAIS;
      if (gagne || perdu) terminer(gagne);
      else etat.verrou = false;
      sauvegarder();
    });

    annoncer(mot, etats);
  }

  function refuser(texte) {
    const ligne = el.plateau.children[etat.essais.length];
    if (ligne) {
      ligne.classList.remove('ligne--erreur');
      void ligne.offsetWidth; // relance l'animation
      ligne.classList.add('ligne--erreur');
    }
    message(texte);
  }

  /**
   * Compare une proposition au mot cible.
   * Deux passes pour gérer les lettres en double : les lettres bien placées
   * sont consommées en premier, une lettre du mot ne peut être signalée
   * « présente » qu'autant de fois qu'elle apparaît réellement.
   */
  function evaluer(proposition, cible) {
    const resultats = new Array(proposition.length).fill('absent');
    const restantes = new Map();

    for (let i = 0; i < cible.length; i++) {
      if (proposition[i] === cible[i]) {
        resultats[i] = 'juste';
      } else {
        restantes.set(cible[i], (restantes.get(cible[i]) || 0) + 1);
      }
    }

    for (let i = 0; i < proposition.length; i++) {
      if (resultats[i] === 'juste') continue;
      const lettre = proposition[i];
      const reste = restantes.get(lettre) || 0;
      if (reste > 0) {
        resultats[i] = 'present';
        restantes.set(lettre, reste - 1);
      }
    }

    return resultats;
  }

  function revelerLigne(indexLigne, mot, etats, instantane, apres) {
    const ligne = el.plateau.children[indexLigne];
    const pas = instantane ? 0 : 300;

    for (let i = 0; i < longueur; i++) {
      const laCase = ligne.children[i];
      laCase.textContent = mot[i];
      laCase.classList.add('case--remplie');
      laCase.setAttribute(
        'aria-label',
        `ligne ${indexLigne + 1}, lettre ${i + 1}, ${mot[i]}, ${libelleEtat(etats[i])}`
      );

      if (instantane) {
        laCase.classList.add('case--' + etats[i]);
      } else {
        laCase.style.animationDelay = i * pas + 'ms';
        laCase.classList.add('case--revele');
        setTimeout(function () {
          laCase.classList.add('case--' + etats[i]);
        }, i * pas + 250);
      }
    }

    colorerClavier(mot, etats);

    const total = instantane ? 0 : (longueur - 1) * pas + 500;
    if (apres) setTimeout(apres, total);
  }

  function libelleEtat(etatLettre) {
    if (etatLettre === 'juste') return 'bien placée';
    if (etatLettre === 'present') return 'mal placée';
    return 'absente';
  }

  const RANG = { absent: 1, present: 2, juste: 3 };

  function colorerClavier(mot, etats) {
    for (let i = 0; i < mot.length; i++) {
      const bouton = touches.get(mot[i]);
      if (!bouton) continue;
      const actuel = bouton.dataset.etat;
      if (actuel && RANG[actuel] >= RANG[etats[i]]) continue; // ne jamais rétrograder
      if (actuel) bouton.classList.remove('touche--' + actuel);
      bouton.dataset.etat = etats[i];
      bouton.classList.add('touche--' + etats[i]);
    }
  }

  function annoncer(mot, etats) {
    const details = mot
      .split('')
      .map(function (lettre, i) {
        return lettre.toUpperCase() + ' ' + libelleEtat(etats[i]);
      })
      .join(', ');
    el.annonce.textContent = `Tentative ${etat.essais.length} : ${details}.`;
  }

  function message(texte, duree) {
    JM.message(el.messages, texte, { genre: 'neutre', duree: duree || 1800 });
  }

  // ------------------------------------------------------------ Fin de partie

  function terminer(gagne) {
    etat.termine = true;
    etat.gagne = gagne;
    etat.verrou = true;

    if (gagne) {
      el.plateau.children[etat.essais.length - 1].classList.add('ligne--gagnee');
      const felicitations = ['Magistral !', 'Splendide', 'Bien vu', 'Joli', 'Ouf', 'De justesse…'];
      message(felicitations[etat.essais.length - 1]);
    } else {
      message('Le mot était ' + etat.graphieSolution.toUpperCase(), 4000);
    }

    majStats(gagne);
    setTimeout(function () {
      ouvrirStats();
    }, gagne ? 1600 : 2600);
  }

  // ------------------------------------------------------- Sauvegarde locale

  function sauvegarder() {
    JM.storage.ecrire(CLE_PARTIE, {
      jour: etat.numeroJour,
      longueur: longueur,
      essais: etat.essais,
      termine: etat.termine,
      gagne: etat.gagne,
    });
  }

  function restaurerPartie() {
    const partie = JM.storage.lire(CLE_PARTIE, null);
    if (!partie || partie.jour !== etat.numeroJour || partie.longueur !== longueur) {
      JM.storage.effacer(CLE_PARTIE); // partie d'un autre jour : on repart de zéro
      return;
    }

    partie.essais.forEach(function (mot, index) {
      etat.essais.push(mot);
      revelerLigne(index, mot, evaluer(mot, etat.solution), true, null);
    });

    if (partie.termine) {
      etat.termine = true;
      etat.gagne = partie.gagne;
      setTimeout(ouvrirStats, 350);
    }
  }

  function statsParDefaut() {
    return {
      parties: 0,
      victoires: 0,
      serie: 0,
      serieMax: 0,
      dernierJour: null,
      repartition: new Array(MAX_ESSAIS).fill(0),
    };
  }

  function lireStats() {
    const stats = JM.storage.lire(CLE_STATS, null) || statsParDefaut();
    if (!Array.isArray(stats.repartition) || stats.repartition.length !== MAX_ESSAIS) {
      stats.repartition = new Array(MAX_ESSAIS).fill(0);
    }
    return stats;
  }

  function majStats(gagne) {
    const stats = lireStats();
    if (stats.dernierJour === etat.numeroJour) return; // déjà comptabilisé

    stats.parties += 1;
    stats.dernierJour = etat.numeroJour;

    if (gagne) {
      stats.victoires += 1;
      stats.repartition[etat.essais.length - 1] += 1;
      stats.serie += 1;
      stats.serieMax = Math.max(stats.serieMax, stats.serie);
    } else {
      stats.serie = 0;
    }

    JM.storage.ecrire(CLE_STATS, stats);
  }

  // -------------------------------------------------------------- Modales

  function ouvrirStats() {
    const stats = lireStats();
    const titre = document.getElementById('stats-titre');
    const solution = document.getElementById('stats-solution');
    const finZone = document.getElementById('fin-zone');

    if (etat.termine) {
      titre.textContent = etat.gagne ? 'Trouvé !' : 'Perdu';
      solution.hidden = false;
      solution.innerHTML =
        'Le mot du jour était <strong>' + echapper(etat.graphieSolution) + '</strong>';
      finZone.hidden = false;
      lancerRebours();
    } else {
      titre.textContent = 'Statistiques';
      solution.hidden = true;
      finZone.hidden = true;
    }

    const pourcentage = stats.parties ? Math.round((stats.victoires / stats.parties) * 100) : 0;
    document.getElementById('stats-chiffres').innerHTML = [
      ['Parties', stats.parties],
      ['Réussite', pourcentage + '&#8239;%'],
      ['Série', stats.serie],
      ['Record', stats.serieMax],
    ]
      .map(function (paire) {
        return '<div><b>' + paire[1] + '</b><span>' + paire[0] + '</span></div>';
      })
      .join('');

    const maximum = Math.max.apply(null, stats.repartition.concat([1]));
    document.getElementById('stats-barres').innerHTML = stats.repartition
      .map(function (nombre, index) {
        const courante = etat.termine && etat.gagne && index === etat.essais.length - 1;
        const largeur = Math.max(8, Math.round((nombre / maximum) * 100));
        return (
          '<div class="barre' +
          (courante ? ' barre--courante' : '') +
          '"><span>' +
          (index + 1) +
          '</span><span style="width:' +
          largeur +
          '%">' +
          nombre +
          '</span></div>'
        );
      })
      .join('');

    el.modaleStats.showModal();
  }

  function echapper(texte) {
    const div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }

  let minuterieRebours = null;

  function lancerRebours() {
    const cible = document.getElementById('rebours');
    clearInterval(minuterieRebours);
    function tic() {
      const reste = JM.msAvantMinuit();
      const heures = Math.floor(reste / 3600000);
      const minutes = Math.floor((reste % 3600000) / 60000);
      const secondes = Math.floor((reste % 60000) / 1000);
      cible.textContent =
        String(heures).padStart(2, '0') +
        ':' +
        String(minutes).padStart(2, '0') +
        ':' +
        String(secondes).padStart(2, '0');
    }
    tic();
    minuterieRebours = setInterval(tic, 1000);
  }

  document.getElementById('btn-aide').addEventListener('click', function () {
    el.modaleAide.showModal();
  });

  document.getElementById('btn-stats').addEventListener('click', ouvrirStats);

  document.querySelectorAll('[data-fermer]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      bouton.closest('dialog').close();
    });
  });

  [el.modaleAide, el.modaleStats].forEach(function (modale) {
    // Clic sur le fond : le <dialog> lui-même occupe toute la zone hors contenu.
    modale.addEventListener('click', function (evenement) {
      if (evenement.target === modale) modale.close();
    });
    modale.addEventListener('close', function () {
      clearInterval(minuterieRebours);
    });
  });

  // ---------------------------------------------------------------- Partage

  document.getElementById('btn-partager').addEventListener('click', function () {
    const palette = EMOJIS[JM.prefs.lire().palette] || EMOJIS.standard;
    const entete =
      'Mot mystère n°' +
      (etat.numeroJour + 1) +
      ' — ' +
      (etat.gagne ? etat.essais.length : 'X') +
      '/' +
      MAX_ESSAIS +
      (longueur === LONGUEUR_PAR_DEFAUT ? '' : ' (' + longueur + ' lettres)');

    const grille = etat.essais
      .map(function (mot) {
        return evaluer(mot, etat.solution)
          .map(function (e) {
            return palette[e];
          })
          .join('');
      })
      .join('\n');

    copier(entete + '\n' + grille);
  });

  function copier(texte) {
    function secours() {
      const zone = document.createElement('textarea');
      zone.value = texte;
      zone.setAttribute('readonly', '');
      zone.style.position = 'fixed';
      zone.style.opacity = '0';
      document.body.appendChild(zone);
      zone.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      zone.remove();
      message(ok ? 'Résultat copié' : 'Copie impossible');
    }

    if (navigator.clipboard && location.protocol !== 'file:') {
      navigator.clipboard.writeText(texte).then(function () {
        message('Résultat copié');
      }, secours);
    } else {
      secours();
    }
  }
})();
