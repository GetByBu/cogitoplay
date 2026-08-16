/*
 * theme.js — le thème du site, et la fenêtre de réglages qui va avec.
 *
 * Le choix du joueur peut valoir « automatique », mais la page, elle, porte
 * toujours un thème concret : c'est le script d'amorce, en tête de chaque page,
 * qui résout « automatique » en clair ou sombre selon le système. La feuille de
 * style n'a donc qu'un seul cas à traiter par thème, sans règle média qui
 * dupliquerait les mêmes couleurs.
 *
 * Les réglages sont rassemblés en un seul endroit — thème, contraste renforcé,
 * effacement des données — et cette fenêtre s'ouvre depuis l'accueil comme
 * depuis l'aide de n'importe quel jeu.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const THEMES = [
    { cle: 'auto', nom: 'Automatique', note: 'suit le réglage de votre appareil' },
    { cle: 'clair', nom: 'Clair', note: 'papier et terracotta' },
    { cle: 'sombre', nom: 'Sombre', note: 'pour jouer le soir' },
    { cle: 'arc', nom: 'Arc-en-ciel', note: 'toutes les couleurs, sans exception' },
  ];

  // Couleur de la barre du navigateur sur mobile, par thème concret.
  const COULEUR_BARRE = { clair: '#fbfaf7', sombre: '#16150f', arc: '#fdfbff' };

  function lire() {
    const prefs = JM.prefs.lire();
    return prefs.theme || 'auto';
  }

  /** « auto » devient clair ou sombre ; les autres se retournent tels quels. */
  function resoudre(choix) {
    if (choix !== 'auto') return choix;
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'sombre'
      : 'clair';
  }

  function appliquer(choix) {
    const concret = resoudre(choix || lire());
    document.documentElement.dataset.theme = concret;
    const barre = document.querySelector('meta[name="theme-color"]');
    if (barre && COULEUR_BARRE[concret]) barre.setAttribute('content', COULEUR_BARRE[concret]);
  }

  function choisir(choix) {
    const prefs = JM.prefs.lire();
    prefs.theme = choix;
    JM.prefs.ecrire(prefs);
    appliquer(choix);
  }

  // Le système peut changer d'avis pendant qu'on joue — la nuit tombe, le
  // téléphone bascule. En mode automatique, la page suit sans rechargement.
  if (global.matchMedia) {
    const veille = global.matchMedia('(prefers-color-scheme: dark)');
    const suivre = function () {
      if (lire() === 'auto') appliquer('auto');
    };
    if (veille.addEventListener) veille.addEventListener('change', suivre);
    else if (veille.addListener) veille.addListener(suivre);
  }

  // ------------------------------------------------------------- Réglages

  function ouvrirReglages() {
    const dialogue = document.createElement('dialog');
    dialogue.className = 'jm-modale';
    dialogue.innerHTML =
      '<div class="jm-modale-contenu">' +
      '<button class="jm-bouton jm-bouton--icone jm-modale-fermer" data-fermer aria-label="Fermer">✕</button>' +
      '<h2>Réglages</h2>' +
      '<h3>Thème</h3>' +
      '<div class="choix-theme" role="radiogroup" aria-label="Thème"></div>' +
      '<h3>Lisibilité</h3>' +
      '<label class="option">' +
      '<input type="checkbox" id="reglage-palette" />' +
      '<span>Couleurs à fort contraste (bleu et orange)</span>' +
      '</label>' +
      '<p class="jm-note">' +
      'Remplace le vert et le jaune des jeux de mots par un bleu et un orange, ' +
      'plus faciles à distinguer.' +
      '</p>' +
      '<h3>Vos données</h3>' +
      '<p class="jm-note">' +
      'Parties en cours, scores et records sont conservés sur cet appareil seul, ' +
      'et ne sont jamais envoyés sur Internet.' +
      '</p>' +
      '<p class="ligne-boutons">' +
      '<button class="jm-bouton jm-bouton--discret" id="reglage-effacer">Effacer mes données</button>' +
      '</p>' +
      '</div>';

    const groupe = dialogue.querySelector('.choix-theme');
    const actuel = lire();
    THEMES.forEach(function (theme) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'theme-choix' + (theme.cle === actuel ? ' theme-choix--actif' : '');
      bouton.dataset.theme = theme.cle;
      bouton.setAttribute('role', 'radio');
      bouton.setAttribute('aria-checked', theme.cle === actuel);
      bouton.innerHTML =
        '<b>' + theme.nom + '</b><span>' + theme.note + '</span>';
      groupe.appendChild(bouton);
    });

    groupe.addEventListener('click', function (evenement) {
      const bouton = evenement.target.closest('.theme-choix');
      if (!bouton) return;
      choisir(bouton.dataset.theme);
      groupe.querySelectorAll('.theme-choix').forEach(function (autre) {
        const actif = autre === bouton;
        autre.classList.toggle('theme-choix--actif', actif);
        autre.setAttribute('aria-checked', actif);
      });
    });

    const palette = dialogue.querySelector('#reglage-palette');
    palette.checked = JM.prefs.lire().palette === 'distincte';
    palette.addEventListener('change', function () {
      const prefs = JM.prefs.lire();
      prefs.palette = palette.checked ? 'distincte' : 'standard';
      JM.prefs.ecrire(prefs);
      JM.prefs.appliquer();
    });

    dialogue.querySelector('#reglage-effacer').addEventListener('click', function () {
      JM.confirme({
        titre: 'Effacer vos données ?',
        texte:
          'Toutes vos parties en cours, scores et records seront supprimés de cet appareil, ' +
          'sur tous les jeux.',
        annuler: 'Annuler',
        ok: 'Effacer',
      }).then(function (accepte) {
        if (!accepte) return;
        JM.storage.toutEffacer();
        location.reload();
      });
    });

    dialogue.addEventListener('click', function (evenement) {
      if (evenement.target === dialogue || evenement.target.closest('[data-fermer]')) {
        dialogue.close();
      }
    });
    dialogue.addEventListener('close', function () {
      dialogue.remove();
    });

    document.body.appendChild(dialogue);
    dialogue.showModal();
  }

  /** Branche tout bouton portant l'attribut data-reglages. */
  function brancher() {
    document.querySelectorAll('[data-reglages]').forEach(function (bouton) {
      bouton.addEventListener('click', function () {
        const modale = bouton.closest('dialog');
        if (modale) modale.close(); // on vient de l'aide d'un jeu
        ouvrirReglages();
      });
    });
  }

  JM.theme = {
    THEMES: THEMES,
    lire: lire,
    resoudre: resoudre,
    appliquer: appliquer,
    choisir: choisir,
    ouvrirReglages: ouvrirReglages,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', brancher);
  } else {
    brancher();
  }
})(window);
