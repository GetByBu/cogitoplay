/*
 * grille-ui.js — interface commune aux deux jeux de grille.
 *
 * Chaque jeu appelle JM.demarrerJeuGrille(config) ; tout le reste (chargement,
 * grille du jour, chrono, saisie clavier et tactile, sauvegarde, écran de fin)
 * est identique d'une langue à l'autre.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const RESTANTS_AFFICHES = 18; // les plus longs mots ratés montrés d'emblée

  JM.demarrerJeuGrille = function (config) {
    const el = {
      chargement: document.getElementById('chargement'),
      erreur: document.getElementById('erreur'),
      jeu: document.getElementById('jeu'),
      depart: document.getElementById('depart'),
      grille: document.getElementById('grille'),
      saisie: document.getElementById('saisie'),
      chrono: document.getElementById('chrono'),
      compteur: document.getElementById('compteur'),
      saisieMot: document.querySelector('.saisie-mot'),
      saisieCompte: document.querySelector('.saisie-compte'),
      progression: document.getElementById('progression'),
      liste: document.getElementById('liste-mots'),
      messages: document.getElementById('messages'),
      annonce: document.getElementById('annonce'),
      modaleAide: document.getElementById('modale-aide'),
      modaleFin: document.getElementById('modale-fin'),
      btnTerminer: document.getElementById('btn-terminer'),
    };

    // Langue de l'interface. Un jeu peut n'en proposer qu'une (les jeux
    // français) ou laisser le joueur basculer (le jeu anglais).
    const languesOffertes = config.languesOffertes || [config.langue];
    let langue = config.langue;
    const preferee = JM.prefs.lire().langueInterface;
    if (preferee && languesOffertes.indexOf(preferee) !== -1) langue = preferee;
    let T = config.textes[langue];

    const etat = {
      lettres: [],
      solution: null,
      dico: null,
      motsTrouves: [],
      score: 0,
      motCourant: '',
      chemin: null,
      demarre: false,
      termine: false,
      chrono: true,
      finPrevue: 0, // horodatage de fin, pour un décompte insensible à la dérive
      restant: config.duree,
      numeroJour: 0,
      minuterie: null,
      scoreMax: 0,
      pastilles: new Map(), // mot -> <li>, pour surligner un mot déjà trouvé
    };

    const progression = JM.progression.installer(el.progression, {
      partCible: config.partCible,
      paliers: JM.progression.PALIERS_FR,
      textes: {},
    });

    JM.prefs.appliquer();

    // ------------------------------------------------------------ Chargement

    JM.chargerDico(config.dico, { min: JM.grille.LONGUEUR_MIN, max: JM.grille.CASES })
      .then(function (dico) {
        etat.dico = dico;
        etat.numeroJour = JM.numeroJour();

        const grille = JM.grille.genererGrille(`${config.cleJeu}:${JM.dateISO()}`, {
          poids: config.poids,
          longueurPlantee: config.longueurPlantee,
          motsMin: config.motsMin,
          voyellesMin: config.voyellesMin,
          voyellesMax: config.voyellesMax,
          index: JM.grille.preparerIndex(dico),
        });

        if (!grille) throw new Error('génération de la grille impossible');

        etat.lettres = grille.lettres;
        etat.solution = grille.solution;
        etat.solution.forEach(function (mot) {
          etat.scoreMax += JM.grille.points(mot);
        });

        construireGrille();
        appliquerLangue(langue);
        el.chargement.hidden = true;
        el.jeu.hidden = false;
        suivreTaille();
        restaurer();
      })
      .catch(function (erreur) {
        el.chargement.hidden = true;
        el.erreur.hidden = false;
        el.erreur.textContent = JM.messageErreurDico(erreur);
      });

    // ----------------------------------------------------------- Traduction

    /**
     * Bascule l'interface. Les textes fixes portent un attribut data-en dans le
     * HTML (leur version française d'origine est mémorisée au premier passage) ;
     * les textes dynamiques viennent de config.textes[langue].
     */
    function appliquerLangue(nouvelle) {
      langue = nouvelle;
      T = config.textes[langue];
      document.documentElement.lang = langue;
      if (T.titre) document.title = T.titre;

      document.querySelectorAll('[data-en]').forEach(function (noeud) {
        if (noeud.dataset.fr === undefined) noeud.dataset.fr = noeud.innerHTML;
        noeud.innerHTML = langue === 'en' ? noeud.dataset.en : noeud.dataset.fr;
      });
      document.querySelectorAll('[data-en-aria]').forEach(function (noeud) {
        if (noeud.dataset.frAria === undefined) {
          noeud.dataset.frAria = noeud.getAttribute('aria-label') || '';
        }
        noeud.setAttribute(
          'aria-label',
          langue === 'en' ? noeud.dataset.enAria : noeud.dataset.frAria
        );
      });

      el.saisieMot.dataset.invite = T.invite;
      progression.configurer({
        paliers: langue === 'en' ? JM.progression.PALIERS_EN : JM.progression.PALIERS_FR,
        textes: T.progression,
      });
      majEntete();
      if (etat.lettres.length) afficherSaisie(); // le compteur de mots aussi est traduit
      cases.forEach(function (bouton, index) {
        bouton.setAttribute(
          'aria-label',
          T.caseAria(etat.lettres[index], Math.floor(index / JM.grille.COTE) + 1, (index % JM.grille.COTE) + 1)
        );
      });

      const bascule = document.getElementById('btn-langue');
      if (bascule) {
        const autre = languesOffertes.find(function (l) {
          return l !== langue;
        });
        bascule.textContent = autre.toUpperCase();
        bascule.setAttribute('aria-label', T.basculeLangue);
      }

      const prefs = JM.prefs.lire();
      prefs.langueInterface = langue;
      JM.prefs.ecrire(prefs);

      if (el.modaleFin.open) ouvrirFin(); // réaffiche l'écran de fin traduit
    }

    // ---------------------------------------------------------- Construction

    const cases = [];

    function construireGrille() {
      el.grille.innerHTML = '';
      etat.lettres.forEach(function (lettre, index) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'case-grille';
        bouton.textContent = lettre;
        bouton.dataset.index = index;
        bouton.setAttribute(
          'aria-label',
          T.caseAria(lettre, Math.floor(index / JM.grille.COTE) + 1, (index % JM.grille.COTE) + 1)
        );
        el.grille.appendChild(bouton);
        cases.push(bouton);
      });
    }

    /**
     * En écran étroit, la grille est empilée avec la zone de saisie et la liste
     * des mots : on lui donne la hauteur réellement disponible plutôt que de se
     * fier aux unités de viewport, qui bougent avec la barre d'adresse mobile.
     */
    function suivreTaille() {
      const zone = document.querySelector('.zone');
      const ajuster = function () {
        // Mesuré depuis la fenêtre : la hauteur de `.zone` suit son contenu et
        // ne dirait donc jamais à la grille de rétrécir.
        const haut = el.grille.getBoundingClientRect().top;
        const reserve = el.saisie.offsetHeight + 96; // saisie, boutons, un rang de mots
        el.grille.style.setProperty(
          '--hauteur-grille',
          Math.max(window.innerHeight - haut - reserve, 120) + 'px'
        );
      };
      if (typeof ResizeObserver === 'function') new ResizeObserver(ajuster).observe(zone);
      window.addEventListener('resize', ajuster);
      ajuster();
    }

    appliquerLangue(langue);

    // ------------------------------------------------------- Saisie tactile

    let pointeurEnfonce = false;

    el.grille.addEventListener('pointerdown', function (evenement) {
      const bouton = evenement.target.closest('.case-grille');
      if (!bouton || !etat.demarre || etat.termine) return;
      evenement.preventDefault();
      pointeurEnfonce = true;
      if (etat.chemin === null) reinitialiserSaisie();
      ajouterCase(parseInt(bouton.dataset.index, 10));
    });

    el.grille.addEventListener('pointerover', function (evenement) {
      if (!pointeurEnfonce) return;
      const bouton = evenement.target.closest('.case-grille');
      if (bouton) ajouterCase(parseInt(bouton.dataset.index, 10));
    });

    window.addEventListener('pointerup', function () {
      pointeurEnfonce = false;
    });

    /** Ajoute une case au chemin si elle touche la précédente et n'a pas servi. */
    function ajouterCase(index) {
      if (etat.chemin === null) etat.chemin = [];
      if (etat.chemin.indexOf(index) !== -1) return;
      const derniere = etat.chemin[etat.chemin.length - 1];
      if (etat.chemin.length > 0 && JM.grille.VOISINS[derniere].indexOf(index) === -1) return;
      etat.chemin.push(index);
      etat.motCourant += etat.lettres[index];
      afficherSaisie();
    }

    // ------------------------------------------------------- Saisie clavier

    document.addEventListener('keydown', function (evenement) {
      if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (!etat.demarre || etat.termine) return;

      if (evenement.key === 'Enter') {
        valider();
        evenement.preventDefault();
      } else if (evenement.key === 'Backspace') {
        effacerLettre();
        evenement.preventDefault();
      } else if (evenement.key === 'Escape') {
        reinitialiserSaisie();
        afficherSaisie();
      } else if (evenement.key.length === 1) {
        const lettre = JM.normaliser(evenement.key);
        if (/^[a-z]$/.test(lettre)) {
          etat.chemin = null; // saisie au clavier : le chemin sera cherché à la validation
          etat.motCourant += lettre;
          afficherSaisie();
          evenement.preventDefault();
        }
      }
    });

    function effacerLettre() {
      if (etat.motCourant.length === 0) return;
      etat.motCourant = etat.motCourant.slice(0, -1);
      if (etat.chemin !== null) etat.chemin.pop();
      afficherSaisie();
    }

    function reinitialiserSaisie() {
      etat.motCourant = '';
      etat.chemin = null;
    }

    function afficherSaisie() {
      const mot = etat.motCourant;
      el.saisieMot.textContent = mot;
      el.saisie.classList.toggle('saisie--vide', mot.length === 0);

      // Combien de mots restent à trouver derrière ce début de mot.
      el.saisieCompte.textContent = mot.length === 0 ? '' : T.motsPossibles(compterPossibles(mot));
      el.saisieCompte.classList.toggle('saisie-compte--vide', mot.length > 0 && compterPossibles(mot) === 0);

      const surbrillance = etat.chemin || JM.grille.cheminDuMot(etat.lettres, mot) || [];
      cases.forEach(function (bouton, index) {
        const rang = surbrillance.indexOf(index);
        bouton.classList.toggle('case-grille--active', rang !== -1);
        bouton.classList.toggle('case-grille--depart', rang === 0);
      });

      surlignerDejaTrouves(mot);
    }

    /** Mots encore à trouver qui commencent par ce début de mot. */
    function compterPossibles(debut) {
      let compte = 0;
      etat.solution.forEach(function (mot) {
        if (mot.indexOf(debut) === 0 && etat.motsTrouves.indexOf(mot) === -1) compte++;
      });
      return compte;
    }

    /**
     * Surligne dans la liste les mots déjà trouvés qui commencent comme la
     * saisie en cours : on voit tout de suite qu'on est en train de retaper un
     * mot déjà acquis, sans avoir à parcourir la liste des yeux.
     */
    function surlignerDejaTrouves(debut) {
      etat.pastilles.forEach(function (pastille, mot) {
        const correspond = debut.length > 0 && mot.indexOf(debut) === 0;
        pastille.classList.toggle('mot-trouve--rappel', correspond);
        const graphie = JM.graphie(etat.dico, mot);
        const span = pastille.firstElementChild;
        if (!correspond) {
          span.textContent = graphie;
          return;
        }
        const coupe = coupeGraphie(graphie, debut.length);
        span.innerHTML =
          '<mark>' + echapper(graphie.slice(0, coupe)) + '</mark>' + echapper(graphie.slice(coupe));
      });
    }

    /**
     * Où couper la graphie accentuée pour surligner `longueur` lettres de la
     * forme normalisée. Les deux ne font pas toujours la même longueur : « œuf »
     * s'écrit « oeuf » une fois normalisé.
     */
    function coupeGraphie(graphie, longueur) {
      for (let i = 1; i <= graphie.length; i++) {
        if (JM.normaliser(graphie.slice(0, i)).length >= longueur) return i;
      }
      return graphie.length;
    }

    // ------------------------------------------------------------ Validation

    function valider() {
      const mot = etat.motCourant;
      if (mot.length === 0) return;

      if (mot.length < JM.grille.LONGUEUR_MIN) {
        refuser(T.tropCourt);
        return;
      }
      if (etat.motsTrouves.indexOf(mot) !== -1) {
        refuser(T.dejaTrouve);
        return;
      }
      const chemin = etat.chemin || JM.grille.cheminDuMot(etat.lettres, mot);
      if (!chemin) {
        refuser(T.pasDansLaGrille);
        return;
      }
      if (!etat.dico.mots.has(mot)) {
        refuser(T.pasAuDictionnaire);
        return;
      }

      const gain = JM.grille.points(mot);
      etat.motsTrouves.push(mot);
      etat.score += gain;
      accepter(mot, gain);
      reinitialiserSaisie();
      afficherSaisie();
      majEntete();
      sauvegarder();
    }

    function accepter(mot, gain) {
      const puce = creerPastille(mot, gain);
      el.liste.insertBefore(puce, el.liste.firstChild);
      message('+' + gain, 'succes');
      el.annonce.textContent = T.annonceMot(JM.graphie(etat.dico, mot), gain);
    }

    function creerPastille(mot, gain) {
      const puce = document.createElement('li');
      puce.className = 'mot-trouve';
      puce.innerHTML =
        '<span>' + echapper(JM.graphie(etat.dico, mot)) + '</span><b>+' + gain + '</b>';
      etat.pastilles.set(mot, puce);
      return puce;
    }

    function refuser(texte) {
      el.saisie.classList.remove('saisie--refus');
      void el.saisie.offsetWidth; // relance l'animation
      el.saisie.classList.add('saisie--refus');
      setTimeout(function () {
        el.saisie.classList.remove('saisie--refus');
      }, 500);
      message(texte, 'refus');
      el.annonce.textContent = texte;
      reinitialiserSaisie();
      afficherSaisie();
    }

    function message(texte, genre) {
      const p = document.createElement('p');
      p.className = 'message--' + genre;
      p.textContent = texte;
      el.messages.appendChild(p);
      setTimeout(function () {
        p.remove();
      }, 1400);
    }

    function majEntete() {
      el.compteur.textContent = etat.motsTrouves.length;
      progression.maj(etat.score, etat.scoreMax);
    }

    // ---------------------------------------------------------------- Chrono

    function demarrer(avecChrono, restant) {
      etat.demarre = true;
      etat.chrono = avecChrono;
      el.depart.hidden = true;
      el.btnTerminer.hidden = false;

      if (avecChrono) {
        etat.restant = restant === undefined ? config.duree : restant;
        etat.finPrevue = Date.now() + etat.restant * 1000;
        etat.minuterie = setInterval(tic, 250);
        tic();
      } else {
        el.chrono.textContent = '∞';
        el.chrono.setAttribute('aria-label', T.sansChrono);
      }
      majEntete();
    }

    function tic() {
      const restant = Math.max(0, Math.round((etat.finPrevue - Date.now()) / 1000));
      etat.restant = restant;
      const minutes = Math.floor(restant / 60);
      const secondes = restant % 60;
      el.chrono.textContent = minutes + ':' + String(secondes).padStart(2, '0');
      el.chrono.classList.toggle('chrono--urgence', restant <= 30);
      if (restant === 0) terminer();
    }

    // ----------------------------------------------------------- Fin de partie

    function terminer() {
      if (etat.termine) return;
      etat.termine = true;
      el.btnTerminer.hidden = true;
      clearInterval(etat.minuterie);
      sauvegarder();
      majStats();
      ouvrirFin();
    }

    function ouvrirFin() {
      const restants = [];
      etat.solution.forEach(function (mot) {
        if (etat.motsTrouves.indexOf(mot) === -1) restants.push(mot);
      });

      let scoreMax = 0;
      etat.solution.forEach(function (mot) {
        scoreMax += JM.grille.points(mot);
      });

      document.getElementById('fin-score').textContent = etat.score;
      document.getElementById('fin-max').textContent = scoreMax;
      document.getElementById('fin-mots').textContent = etat.motsTrouves.length;
      document.getElementById('fin-total').textContent = etat.solution.size;

      const stats = lireStats();
      document.getElementById('fin-record').textContent = Math.max(stats.meilleur, etat.score);

      // Les listes de mots ne sont pas triées par fréquence : afficher les
      // dizaines de mots ratés d'un coup noierait les trouvailles intéressantes
      // sous des entrées que personne ne connaît. On montre donc les plus longs,
      // le reste est accessible d'un clic.
      restants.sort(function (a, b) {
        return b.length - a.length || a.localeCompare(b);
      });

      const puce = function (mot) {
        return '<li>' + echapper(JM.graphie(etat.dico, mot)) + '</li>';
      };
      const enVue = restants.slice(0, RESTANTS_AFFICHES);
      const caches = restants.slice(RESTANTS_AFFICHES);

      const liste = document.getElementById('fin-restants');
      liste.innerHTML = enVue.map(puce).join('');

      const voirTout = document.getElementById('btn-voir-tout');
      voirTout.hidden = caches.length === 0;
      voirTout.textContent = T.voirTout(caches.length);
      voirTout.onclick = function () {
        liste.innerHTML += caches.map(puce).join('');
        voirTout.hidden = true;
      };

      if (!el.modaleFin.open) el.modaleFin.showModal();
    }

    // ------------------------------------------------------------ Sauvegarde

    function sauvegarder() {
      JM.storage.ecrire(config.cleStockage, {
        jour: etat.numeroJour,
        lettres: etat.lettres.join(''),
        mots: etat.motsTrouves,
        score: etat.score,
        termine: etat.termine,
        chrono: etat.chrono,
        restant: etat.restant,
        demarre: etat.demarre,
      });
    }

    function restaurer() {
      const partie = JM.storage.lire(config.cleStockage, null);
      if (
        !partie ||
        partie.jour !== etat.numeroJour ||
        partie.lettres !== etat.lettres.join('')
      ) {
        JM.storage.effacer(config.cleStockage);
        el.depart.hidden = false;
        return;
      }

      etat.motsTrouves = partie.mots || [];
      etat.score = partie.score || 0;
      etat.motsTrouves.forEach(function (mot) {
        el.liste.insertBefore(creerPastille(mot, JM.grille.points(mot)), el.liste.firstChild);
      });
      majEntete();

      if (partie.termine) {
        etat.termine = true;
        etat.chrono = partie.chrono;
        el.depart.hidden = true;
        el.chrono.textContent = partie.chrono ? '0:00' : '∞';
        setTimeout(ouvrirFin, 300);
      } else if (partie.demarre) {
        demarrer(partie.chrono, partie.restant);
      } else {
        el.depart.hidden = false;
      }
    }

    function lireStats() {
      return JM.storage.lire(config.cleStockage + '.stats', { parties: 0, meilleur: 0, dernierJour: null });
    }

    function majStats() {
      const stats = lireStats();
      if (stats.dernierJour === etat.numeroJour) {
        stats.meilleur = Math.max(stats.meilleur, etat.score);
      } else {
        stats.parties += 1;
        stats.dernierJour = etat.numeroJour;
        stats.meilleur = Math.max(stats.meilleur, etat.score);
      }
      JM.storage.ecrire(config.cleStockage + '.stats', stats);
    }

    // La partie chronométrée continue de tourner si l'onglet passe en arrière-plan :
    // on enregistre le temps restant pour pouvoir reprendre au bon endroit.
    window.addEventListener('pagehide', function () {
      if (etat.demarre && !etat.termine) sauvegarder();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && etat.demarre && !etat.termine) sauvegarder();
    });

    // -------------------------------------------------------------- Commandes

    document.getElementById('btn-commencer').addEventListener('click', function () {
      // Mode libre par défaut : le chrono est une option à cocher.
      demarrer(document.getElementById('opt-chrono').checked);
    });

    document.getElementById('btn-valider').addEventListener('click', function () {
      valider();
    });

    document.getElementById('btn-effacer').addEventListener('click', function () {
      effacerLettre();
    });

    document.getElementById('btn-terminer').addEventListener('click', function () {
      if (!etat.termine && confirm(T.confirmerFin)) terminer();
    });

    const btnLangue = document.getElementById('btn-langue');
    if (btnLangue) {
      btnLangue.addEventListener('click', function () {
        appliquerLangue(
          languesOffertes.find(function (l) {
            return l !== langue;
          })
        );
      });
    }

    document.getElementById('btn-aide').addEventListener('click', function () {
      el.modaleAide.showModal();
    });

    document.getElementById('btn-resultats').addEventListener('click', function () {
      if (etat.termine) ouvrirFin();
      else el.modaleAide.showModal();
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

    document.getElementById('btn-partager').addEventListener('click', function () {
      const texte = T.partage(
        etat.numeroJour + 1,
        etat.score,
        etat.motsTrouves.length,
        etat.solution.size
      );
      copier(texte);
    });

    document.getElementById('btn-effacer-donnees').addEventListener('click', function () {
      if (!confirm(T.confirmerEffacement)) return;
      JM.storage.toutEffacer();
      location.reload();
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
        message(ok ? T.copie : T.copieRatee, ok ? 'succes' : 'refus');
      }
      if (navigator.clipboard && location.protocol !== 'file:') {
        navigator.clipboard.writeText(texte).then(function () {
          message(T.copie, 'succes');
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
  };
})(window);
