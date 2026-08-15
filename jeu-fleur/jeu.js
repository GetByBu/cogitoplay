/*
 * Jeu 3 — Fleur de lettres (français, partie de deux semaines).
 *
 * Sept lettres, celle du centre obligatoire, réutilisables à volonté, mots de 4
 * à 9 lettres, formes de base plus féminins et pluriels (pas de conjugaisons).
 *
 * Le pangramme est garanti par construction : on ne tire pas sept lettres au
 * hasard en espérant qu'un mot les utilise toutes, on part d'un mot qui compte
 * exactement sept lettres distinctes et ce mot devient la fleur. Il ne reste
 * qu'à choisir la lettre centrale et à vérifier que la récolte est jouable.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Réglages

  const DICO = 'fr_base_accords.txt';
  const LONGUEUR_MIN = 4;
  const LONGUEUR_MAX = 9;

  const JOURS_PAR_PERIODE = 14;
  // Le jour 0 des numéros de jour est le jeudi 1er janvier 2026 ; on décale de
  // 4 jours pour que chaque période commence un lundi.
  const DECALAGE_LUNDI = 4;

  const MOTS_MIN = 40; // en dessous, deux semaines seraient vite épuisées
  const MOTS_MAX = 350; // au dessus, la liste devient un inventaire

  const BONUS_PANGRAMME = 7;
  const CLE_STOCKAGE = 'fleur.v1';
  const CLE_INDICES = 'fleur.indices.v1';

  // Cible de victoire : 45 % du score maximum. La fleur dure deux semaines,
  // l'objectif peut donc être plus ambitieux que sur une grille quotidienne.
  const PART_CIBLE = 0.45;

  const INDICES_PAR_JOUR = 3;

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

  const progression = JM.progression.installer(document.getElementById('progression'), {
    partCible: PART_CIBLE,
    paliers: JM.progression.PALIERS_FR,
    textes: { cible: 'cible', max: 'max', points: 'pts' },
  });

  const el = {
    jeu: document.getElementById('jeu'),
    chargement: document.getElementById('chargement'),
    erreur: document.getElementById('erreur'),
    fleur: document.getElementById('fleur'),
    saisie: document.getElementById('saisie'),
    liste: document.getElementById('liste-mots'),
    compteur: document.getElementById('compteur'),
    score: document.getElementById('score'),
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
    // Candidats : les mots à exactement 7 lettres distinctes, aucune n'étant un
    // S. Depuis que les pluriels comptent, une fleur contenant un S se jouerait
    // en ajoutant un S à tout ce qu'on trouve — et si le S était au centre,
    // le jeu se réduirait à ça.
    const bitS = 1 << ('s'.charCodeAt(0) - CODE_A);
    const pangrammes = index.mots.filter(function (mot, i) {
      return compterBits(index.masques[i]) === 7 && (index.masques[i] & bitS) === 0;
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

    // « du 3 au 16 août » quand le mois ne change pas, sinon les deux mois.
    const memeMois = debut.getMonth() === fin.getMonth();
    const jourSeul = { day: 'numeric' };
    const jourEtMois = { day: 'numeric', month: 'long' };
    const periode =
      'du ' +
      debut.toLocaleDateString('fr-FR', memeMois ? jourSeul : jourEtMois) +
      ' au ' +
      fin.toLocaleDateString('fr-FR', jourEtMois);

    el.periodeInfo.textContent =
      `${periode} · ${restant} jour${restant > 1 ? 's' : ''} restant${restant > 1 ? 's' : ''}`;
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
    // Chaque lettre dans son propre span, y compris celle du centre qui est
    // colorée : mélanger spans et texte brut dans une boîte flex faisait passer
    // la lettre centrale à la ligne et poussait tout le reste vers le bas.
    el.saisie.innerHTML = etat.saisie
      .split('')
      .map(function (lettre) {
        return (
          '<span class="saisie-lettre' +
          (lettre === etat.centre ? ' centre' : '') +
          '">' +
          lettre +
          '</span>'
        );
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
    const duree = genre === 'indice' ? 6000 : genre === 'pangramme' ? 2400 : 1400;
    setTimeout(function () {
      p.remove();
    }, duree);
  }

  // ------------------------------------------------------------- Progression

  function majEntete() {
    el.compteur.textContent = etat.motsTrouves.length;
    progression.maj(etat.score, etat.scoreMax);
    document.getElementById('libelle-mots').textContent =
      etat.motsTrouves.length > 1 ? 'mots trouvés' : 'mot trouvé';
  }

  function ouvrirProgres() {
    const infos = progression.etat(etat.score, etat.scoreMax);
    const pangrammesTrouves = etat.motsTrouves.filter(estPangramme).length;
    const pangrammesTotal = etat.solution.filter(estPangramme).length;
    const paliers = JM.progression.PALIERS_FR;

    document.getElementById('progres-resume').innerHTML =
      `<strong>${etat.score}</strong> points sur ${etat.scoreMax} possibles, ` +
      `${etat.motsTrouves.length} mots trouvés sur ${etat.solution.length}. ` +
      `Pangrammes : ${pangrammesTrouves} sur ${pangrammesTotal}. ` +
      (infos.gagne
        ? 'Cible atteinte.'
        : `Encore <strong>${infos.cible - etat.score}</strong> points pour atteindre la cible.`);

    const seuils = JM.progression.seuils(etat.scoreMax, PART_CIBLE);
    document.getElementById('liste-rangs').innerHTML = seuils
      .map(function (seuil, i) {
        const palier = paliers[i + 1];
        const atteint = etat.score >= seuil;
        const courant = infos.palier === i + 1;
        return (
          '<li class="' +
          (courant ? 'courant' : atteint ? 'atteint' : '') +
          '"><span>' +
          palier.emoji +
          ' ' +
          echapper(palier.mot) +
          (i === 7 ? ' <em>(cible)</em>' : '') +
          '</span><span>' +
          seuil +
          ' pts</span></li>'
        );
      })
      .join('');

    el.modaleProgres.showModal();
  }

  // ----------------------------------------------------------------- Indices

  /**
   * Un indice donne la longueur et les deux premières lettres d'un mot qui
   * manque — de quoi débloquer une piste sans livrer la réponse. Trois par
   * jour, le compteur repart à minuit.
   */
  function lireIndices() {
    const brut = JM.storage.lire(CLE_INDICES, null);
    const jour = JM.numeroJour();
    if (!brut || brut.jour !== jour) return { jour: jour, utilises: 0 };
    return brut;
  }

  function demanderIndice() {
    const compteur = lireIndices();
    if (compteur.utilises >= INDICES_PAR_JOUR) {
      message('Plus d’indice avant demain', 'refus');
      return;
    }

    const manquants = etat.solution.filter(function (mot) {
      return etat.motsTrouves.indexOf(mot) === -1;
    });
    if (manquants.length === 0) {
      message('Vous avez déjà tout trouvé', 'succes');
      return;
    }

    // Tirage reproductible : le même indice tant qu'on ne l'a pas consommé.
    const rng = JM.rng(`indice:P${etat.periode}:${compteur.utilises}:${etat.motsTrouves.length}`);
    const mot = manquants[JM.entier(rng, manquants.length)];
    const debut = JM.graphie(etat.dico, mot).slice(0, 2).toUpperCase();

    compteur.utilises += 1;
    JM.storage.ecrire(CLE_INDICES, compteur);

    const reste = INDICES_PAR_JOUR - compteur.utilises;
    message(
      `Il vous manque un mot de ${mot.length} lettres qui commence par ${debut}` +
        ` · ${reste} indice${reste > 1 ? 's' : ''} restant${reste > 1 ? 's' : ''}`,
      'indice'
    );
    el.annonce.textContent = `Indice : un mot de ${mot.length} lettres commençant par ${debut}.`;
  }

  document.getElementById('btn-indice').addEventListener('click', demanderIndice);

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
    etat.saisie = etat.saisie.slice(0, -1);
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
    const infos = progression.etat(etat.score, etat.scoreMax);
    copier(
      `Fleur de lettres n°${etat.periode + 1} — ${etat.score} points ` +
        `(cible ${infos.cible}, max ${etat.scoreMax}), ` +
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
