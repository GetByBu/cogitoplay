/*
 * Jeu 3 — Fleur de lettres (français, partie de deux semaines).
 *
 * Sept lettres, celle du centre obligatoire, réutilisables à volonté, mots de 4
 * à 9 lettres, dictionnaire des formes de base (pas de conjugaisons).
 *
 * Le pangramme est garanti par construction : on ne tire pas sept lettres au
 * hasard en espérant qu'un mot les utilise toutes, on part d'un mot qui compte
 * exactement sept lettres distinctes et ce mot devient la fleur. Il ne reste
 * qu'à choisir la lettre centrale et à vérifier que la récolte est jouable.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Réglages

  const DICO = 'fr_lemmes_base_67k.txt';
  const LONGUEUR_MIN = 4;
  const LONGUEUR_MAX = 9;

  const JOURS_PAR_PERIODE = 14;
  // Le jour 0 des numéros de jour est le jeudi 1er janvier 2026 ; on décale de
  // 4 jours pour que chaque période commence un lundi.
  const DECALAGE_LUNDI = 4;

  const MOTS_MIN = 30; // en dessous, deux semaines seraient vite épuisées
  const MOTS_MAX = 250; // au dessus, la liste devient un inventaire

  const BONUS_PANGRAMME = 7;
  const CLE_STOCKAGE = 'fleur.v1';

  // Rangs, en pourcentage du score maximum de la fleur.
  const RANGS = [
    { seuil: 0, nom: 'Graine' },
    { seuil: 2, nom: 'Germe' },
    { seuil: 5, nom: 'Pousse' },
    { seuil: 10, nom: 'Tige' },
    { seuil: 20, nom: 'Bourgeon' },
    { seuil: 32, nom: 'Éclosion' },
    { seuil: 45, nom: 'Floraison' },
    { seuil: 60, nom: 'Bouquet' },
    { seuil: 75, nom: 'Jardin' },
    { seuil: 100, nom: 'Herbier' },
  ];

  const CODE_A = 'a'.charCodeAt(0);

  // ------------------------------------------------------------------- État

  const etat = {
    lettres: [], // les 7 lettres, centre en premier
    centre: '',
    affichage: [], // les 6 pétales dans leur ordre d'affichage
    solution: [],
    scoreMax: 0,
    dico: null,
    motsTrouves: [],
    score: 0,
    saisie: '',
    periode: 0,
  };

  const el = {
    jeu: document.getElementById('jeu'),
    chargement: document.getElementById('chargement'),
    erreur: document.getElementById('erreur'),
    fleur: document.getElementById('fleur'),
    saisie: document.getElementById('saisie'),
    liste: document.getElementById('liste-mots'),
    compteur: document.getElementById('compteur'),
    score: document.getElementById('score'),
    rangNom: document.getElementById('rang-nom'),
    rangJauge: document.getElementById('rang-jauge'),
    messages: document.getElementById('messages'),
    annonce: document.getElementById('annonce'),
    periodeInfo: document.getElementById('periode-info'),
    modaleAide: document.getElementById('modale-aide'),
    modaleProgres: document.getElementById('modale-progres'),
  };

  // --------------------------------------------------------------- Démarrage

  JM.prefs.appliquer();

  JM.chargerDico(DICO, { min: LONGUEUR_MIN, max: LONGUEUR_MAX })
    .then(function (dico) {
      etat.dico = dico;
      etat.periode = Math.floor((JM.numeroJour() - DECALAGE_LUNDI) / JOURS_PAR_PERIODE);

      const index = preparerIndex(dico);
      const fleur = genererFleur(`fleur-fr:P${etat.periode}`, index);
      if (!fleur) throw new Error('génération de la fleur impossible');

      etat.lettres = fleur.lettres;
      etat.centre = fleur.centre;
      etat.affichage = fleur.affichage;
      etat.solution = fleur.solution;
      etat.scoreMax = fleur.solution.reduce(function (somme, mot) {
        return somme + points(mot);
      }, 0);

      construireFleur();
      afficherPeriode();
      restaurer();
      majEntete();

      el.chargement.hidden = true;
      el.jeu.hidden = false;
    })
    .catch(function (erreur) {
      el.chargement.hidden = true;
      el.erreur.hidden = false;
      el.erreur.textContent = JM.messageErreurDico(erreur);
    });

  // ------------------------------------------------------------- Génération

  function masqueDe(mot) {
    let masque = 0;
    for (let i = 0; i < mot.length; i++) masque |= 1 << (mot.charCodeAt(i) - CODE_A);
    return masque >>> 0;
  }

  /** Liste des mots et masque binaire de leurs lettres distinctes. */
  function preparerIndex(dico) {
    const mots = dico.liste;
    const masques = new Uint32Array(mots.length);
    for (let i = 0; i < mots.length; i++) masques[i] = masqueDe(mots[i]);
    return { mots: mots, masques: masques };
  }

  /** Mots ne contenant que ces lettres, et contenant la lettre centrale. */
  function recolte(index, lettres, centre) {
    const masqueFleur = masqueDe(lettres.join(''));
    const bitCentre = 1 << (centre.charCodeAt(0) - CODE_A);
    const trouves = [];
    for (let i = 0; i < index.mots.length; i++) {
      const masque = index.masques[i];
      if ((masque & ~masqueFleur) !== 0) continue;
      if ((masque & bitCentre) === 0) continue;
      trouves.push(index.mots[i]);
    }
    return trouves;
  }

  function genererFleur(cle, index) {
    // Candidats : les mots à exactement 7 lettres distinctes. Chacun d'eux est
    // un pangramme pour la fleur formée de ses propres lettres.
    const pangrammes = index.mots.filter(function (mot, i) {
      return compterBits(index.masques[i]) === 7;
    });

    for (let essai = 1; essai <= 40; essai++) {
      const rng = JM.rng(essai === 1 ? cle : cle + '#' + essai);
      const graine = pangrammes[JM.entier(rng, pangrammes.length)];
      const lettres = Array.from(new Set(graine.split(''))).sort();
      const centre = lettres[JM.entier(rng, lettres.length)];

      const solution = recolte(index, lettres, centre);
      if (solution.length < MOTS_MIN || solution.length > MOTS_MAX) continue;

      const peripheriques = lettres.filter(function (l) {
        return l !== centre;
      });

      return {
        lettres: [centre].concat(peripheriques),
        centre: centre,
        affichage: JM.melange(peripheriques, rng),
        solution: solution,
      };
    }
    return null;
  }

  function compterBits(n) {
    let compte = 0;
    while (n) {
      n &= n - 1;
      compte++;
    }
    return compte;
  }

  // ------------------------------------------------------------------ Points

  function estPangramme(mot) {
    return new Set(mot.split('')).size === 7;
  }

  /** 4 lettres = 1 point, au delà 1 point par lettre, +7 pour un pangramme. */
  function points(mot) {
    const base = mot.length === 4 ? 1 : mot.length;
    return estPangramme(mot) ? base + BONUS_PANGRAMME : base;
  }

  // ------------------------------------------------------------ Construction

  function construireFleur() {
    el.fleur.innerHTML = '';
    ajouterPetale(etat.centre, 'centre');
    etat.affichage.forEach(function (lettre, i) {
      ajouterPetale(lettre, String(i));
    });
  }

  function ajouterPetale(lettre, place) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'petale' + (place === 'centre' ? ' petale--centre' : '');
    bouton.dataset.place = place;
    bouton.dataset.lettre = lettre;
    bouton.textContent = lettre;
    bouton.setAttribute(
      'aria-label',
      place === 'centre' ? lettre + ', lettre du centre, obligatoire' : lettre
    );
    el.fleur.appendChild(bouton);
  }

  function afficherPeriode() {
    const debut = jourEnDate(DECALAGE_LUNDI + etat.periode * JOURS_PAR_PERIODE);
    const fin = jourEnDate(DECALAGE_LUNDI + (etat.periode + 1) * JOURS_PAR_PERIODE - 1);
    const restant = DECALAGE_LUNDI + (etat.periode + 1) * JOURS_PAR_PERIODE - JM.numeroJour();
    const format = { day: 'numeric', month: 'long' };
    el.periodeInfo.textContent =
      `du ${debut.toLocaleDateString('fr-FR', format)} au ${fin.toLocaleDateString('fr-FR', format)}` +
      ` · ${restant} jour${restant > 1 ? 's' : ''}`;
  }

  function jourEnDate(numero) {
    return new Date(2026, 0, 1 + numero);
  }

  // ----------------------------------------------------------------- Saisie

  el.fleur.addEventListener('click', function (evenement) {
    const bouton = evenement.target.closest('.petale');
    if (!bouton) return;
    bouton.blur();
    ajouterLettre(bouton.dataset.lettre);
  });

  document.addEventListener('keydown', function (evenement) {
    if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
    if (document.querySelector('dialog[open]')) return;

    if (evenement.key === 'Enter') {
      valider();
      evenement.preventDefault();
    } else if (evenement.key === 'Backspace') {
      etat.saisie = etat.saisie.slice(0, -1);
      afficherSaisie();
      evenement.preventDefault();
    } else if (evenement.key === 'Escape') {
      etat.saisie = '';
      afficherSaisie();
    } else if (evenement.key.length === 1) {
      const lettre = JM.normaliser(evenement.key);
      if (/^[a-z]$/.test(lettre)) {
        ajouterLettre(lettre);
        evenement.preventDefault();
      }
    }
  });

  function ajouterLettre(lettre) {
    // Une frappe malheureuse n'efface pas le mot en cours : on signale, c'est
    // tout. Seul un mot proposé et refusé repart de zéro.
    if (etat.lettres.indexOf(lettre) === -1) {
      refuser('Cette lettre n’est pas dans la fleur', true);
      return;
    }
    if (etat.saisie.length >= LONGUEUR_MAX) {
      refuser(LONGUEUR_MAX + ' lettres maximum', true);
      return;
    }
    etat.saisie += lettre;
    clignoter(lettre);
    afficherSaisie();
  }

  function clignoter(lettre) {
    const bouton = el.fleur.querySelector('.petale[data-lettre="' + lettre + '"]');
    if (!bouton) return;
    bouton.classList.add('petale--enfoncee');
    setTimeout(function () {
      bouton.classList.remove('petale--enfoncee');
    }, 120);
  }

  function afficherSaisie() {
    el.saisie.classList.toggle('saisie--vide', etat.saisie.length === 0);
    // La lettre centrale est colorée dans la saisie : on voit d'un coup d'œil
    // si le mot en cours la contient.
    el.saisie.innerHTML = etat.saisie
      .split('')
      .map(function (lettre) {
        return lettre === etat.centre ? '<span class="centre">' + lettre + '</span>' : lettre;
      })
      .join('');
  }

  // ------------------------------------------------------------- Validation

  function valider() {
    const mot = etat.saisie;
    if (mot.length === 0) return;

    if (mot.length < LONGUEUR_MIN) {
      refuser(LONGUEUR_MIN + ' lettres minimum');
      return;
    }
    if (mot.indexOf(etat.centre) === -1) {
      refuser('Il manque le ' + etat.centre.toUpperCase() + ' du centre');
      return;
    }
    if (etat.motsTrouves.indexOf(mot) !== -1) {
      refuser('Déjà trouvé');
      return;
    }
    if (!etat.dico.mots.has(mot)) {
      refuser('Pas au dictionnaire');
      return;
    }

    const gain = points(mot);
    const pangramme = estPangramme(mot);
    etat.motsTrouves.push(mot);
    etat.score += gain;

    ajouterPuce(mot, gain, pangramme);
    message(pangramme ? 'Pangramme ! +' + gain : '+' + gain, pangramme ? 'pangramme' : 'succes');
    el.annonce.textContent =
      JM.graphie(etat.dico, mot) + ', ' + gain + ' points' + (pangramme ? ', pangramme' : '') + '.';

    etat.saisie = '';
    afficherSaisie();
    majEntete();
    sauvegarder();
  }

  function refuser(texte, garderSaisie) {
    el.saisie.classList.remove('saisie--refus');
    void el.saisie.offsetWidth; // relance l'animation
    el.saisie.classList.add('saisie--refus');
    setTimeout(function () {
      el.saisie.classList.remove('saisie--refus');
    }, 500);
    message(texte, 'refus');
    el.annonce.textContent = texte;
    if (!garderSaisie) etat.saisie = '';
    afficherSaisie();
  }

  function ajouterPuce(mot, gain, pangramme) {
    const puce = document.createElement('li');
    puce.className = 'mot-trouve' + (pangramme ? ' mot-trouve--pangramme' : '');
    puce.innerHTML = '<span>' + echapper(JM.graphie(etat.dico, mot)) + '</span><b>+' + gain + '</b>';
    el.liste.insertBefore(puce, el.liste.firstChild);
  }

  function message(texte, genre) {
    const p = document.createElement('p');
    p.className = 'message--' + genre;
    p.textContent = texte;
    el.messages.appendChild(p);
    setTimeout(function () {
      p.remove();
    }, genre === 'pangramme' ? 2400 : 1400);
  }

  // ------------------------------------------------------------- Progression

  function rangCourant() {
    const pourcentage = etat.scoreMax ? (etat.score / etat.scoreMax) * 100 : 0;
    let rang = RANGS[0];
    let suivant = null;
    for (let i = 0; i < RANGS.length; i++) {
      if (pourcentage >= RANGS[i].seuil) rang = RANGS[i];
      else {
        suivant = RANGS[i];
        break;
      }
    }
    return { rang: rang, suivant: suivant, pourcentage: pourcentage };
  }

  function pointsDuSeuil(seuil) {
    return Math.ceil((seuil / 100) * etat.scoreMax);
  }

  function majEntete() {
    const info = rangCourant();
    el.score.textContent = etat.score;
    el.compteur.textContent = etat.motsTrouves.length;
    el.rangNom.textContent = info.rang.nom;
    el.rangJauge.style.width = Math.min(100, info.pourcentage) + '%';
    document.getElementById('libelle-mots').textContent =
      etat.motsTrouves.length > 1 ? 'mots trouvés' : 'mot trouvé';
  }

  function ouvrirProgres() {
    const info = rangCourant();
    const pangrammesTrouves = etat.motsTrouves.filter(estPangramme).length;
    const pangrammesTotal = etat.solution.filter(estPangramme).length;

    document.getElementById('progres-resume').innerHTML =
      `Rang <strong>${echapper(info.rang.nom)}</strong> avec <strong>${etat.score}</strong> points sur ` +
      `${etat.scoreMax} possibles, ${etat.motsTrouves.length} mots trouvés sur ${etat.solution.length}. ` +
      `Pangrammes : ${pangrammesTrouves} sur ${pangrammesTotal}.` +
      (info.suivant
        ? ` Encore ${pointsDuSeuil(info.suivant.seuil) - etat.score} points pour atteindre ` +
          `<strong>${echapper(info.suivant.nom)}</strong>.`
        : ' Vous avez tout trouvé.');

    document.getElementById('liste-rangs').innerHTML = RANGS.map(function (r) {
      const atteint = etat.score >= pointsDuSeuil(r.seuil);
      const courant = r.nom === info.rang.nom;
      return (
        '<li class="' +
        (courant ? 'courant' : atteint ? 'atteint' : '') +
        '"><span>' +
        echapper(r.nom) +
        '</span><span>' +
        pointsDuSeuil(r.seuil) +
        ' pts</span></li>'
      );
    }).join('');

    el.modaleProgres.showModal();
  }

  // -------------------------------------------------------------- Sauvegarde

  function sauvegarder() {
    JM.storage.ecrire(CLE_STOCKAGE, {
      periode: etat.periode,
      lettres: etat.lettres.join(''),
      mots: etat.motsTrouves,
      score: etat.score,
    });
  }

  function restaurer() {
    const partie = JM.storage.lire(CLE_STOCKAGE, null);
    if (!partie || partie.periode !== etat.periode || partie.lettres !== etat.lettres.join('')) {
      JM.storage.effacer(CLE_STOCKAGE); // nouvelle quinzaine : on repart de zéro
      return;
    }
    etat.motsTrouves = partie.mots || [];
    etat.score = partie.score || 0;
    etat.motsTrouves.forEach(function (mot) {
      ajouterPuce(mot, points(mot), estPangramme(mot));
    });
  }

  // --------------------------------------------------------------- Commandes

  document.getElementById('btn-valider').addEventListener('click', valider);

  document.getElementById('btn-effacer').addEventListener('click', function () {
    etat.saisie = '';
    afficherSaisie();
  });

  document.getElementById('btn-melanger').addEventListener('click', function () {
    // Mélange d'affichage seulement : la fleur du jour ne change pas.
    etat.affichage = JM.melange(etat.affichage, Math.random);
    construireFleur();
  });

  document.getElementById('btn-aide').addEventListener('click', function () {
    el.modaleAide.showModal();
  });

  document.getElementById('btn-progres').addEventListener('click', ouvrirProgres);
  document.getElementById('rang-barre').addEventListener('click', ouvrirProgres);

  document.querySelectorAll('[data-fermer]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      bouton.closest('dialog').close();
    });
  });

  [el.modaleAide, el.modaleProgres].forEach(function (modale) {
    modale.addEventListener('click', function (evenement) {
      if (evenement.target === modale) modale.close();
    });
  });

  document.getElementById('btn-effacer-donnees').addEventListener('click', function () {
    if (!confirm('Effacer les mots trouvés et vos préférences sur cet appareil ?')) return;
    JM.storage.toutEffacer();
    location.reload();
  });

  document.getElementById('btn-partager').addEventListener('click', function () {
    const info = rangCourant();
    copier(
      `Fleur de lettres n°${etat.periode + 1} — ${etat.score} points, rang ${info.rang.nom}, ` +
        `${etat.motsTrouves.length} mots sur ${etat.solution.length}`
    );
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
      message(ok ? 'Résultat copié' : 'Copie impossible', ok ? 'succes' : 'refus');
    }
    if (navigator.clipboard && location.protocol !== 'file:') {
      navigator.clipboard.writeText(texte).then(function () {
        message('Résultat copié', 'succes');
      }, secours);
    } else {
      secours();
    }
  }

  function echapper(texte) {
    const div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }
})();
