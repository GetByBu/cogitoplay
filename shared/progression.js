/*
 * progression.js — barre de progression commune aux jeux à score libre
 * (les deux grilles et la fleur).
 *
 * Deux repères plutôt qu'un : la **cible**, un score d'objectif atteignable qui
 * marque la victoire, et le **maximum**, la somme de tous les mots trouvables,
 * que presque personne n'atteindra. La jauge est graduée sur le maximum, un
 * trait marque la cible.
 *
 * Douze paliers : huit pour aller de zéro à la cible, quatre au delà pour ceux
 * qui continuent. Chaque palier a son émoticône et son mot d'encouragement.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  // 13 entrées : le palier 0 (rien trouvé) puis les 12 paliers.
  const PALIERS_FR = [
    { emoji: '🌱', mot: 'C’est parti, trouvez un premier mot.' },
    { emoji: '🌿', mot: 'Ça démarre.' },
    { emoji: '🍀', mot: 'Vous êtes lancé.' },
    { emoji: '⭐', mot: 'Joli rythme.' },
    { emoji: '✨', mot: 'À mi-chemin de la cible.' },
    { emoji: '🔥', mot: 'Ça chauffe.' },
    { emoji: '💪', mot: 'La cible se rapproche.' },
    { emoji: '🎯', mot: 'Plus qu’un petit effort.' },
    { emoji: '🏆', mot: 'Cible atteinte, bravo !' },
    { emoji: '🚀', mot: 'Au delà de la cible, joli.' },
    { emoji: '🌟', mot: 'Impressionnant.' },
    { emoji: '👑', mot: 'Il ne reste presque rien.' },
    { emoji: '🎉', mot: 'Tout trouvé. Chapeau.' },
  ];

  const PALIERS_EN = [
    { emoji: '🌱', mot: 'Off you go — find a first word.' },
    { emoji: '🌿', mot: 'You’re started.' },
    { emoji: '🍀', mot: 'Rolling now.' },
    { emoji: '⭐', mot: 'Nice pace.' },
    { emoji: '✨', mot: 'Halfway to the target.' },
    { emoji: '🔥', mot: 'Heating up.' },
    { emoji: '💪', mot: 'The target is close.' },
    { emoji: '🎯', mot: 'One more push.' },
    { emoji: '🏆', mot: 'Target reached. Well done!' },
    { emoji: '🚀', mot: 'Past the target — lovely.' },
    { emoji: '🌟', mot: 'Impressive.' },
    { emoji: '👑', mot: 'Almost nothing left.' },
    { emoji: '🎉', mot: 'Everything found. Hats off.' },
  ];

  /**
   * Palier courant et repères chiffrés.
   * @param {number} score      points du joueur
   * @param {number} max        points de tous les mots trouvables
   * @param {number} partCible  part du maximum qui vaut victoire (0,3 = 30 %)
   */
  function etat(score, max, partCible) {
    const cible = Math.max(1, Math.round(max * partCible));
    let palier;

    if (max > 0 && score >= max) {
      palier = 12;
    } else if (score >= cible) {
      // Quatre paliers pour aller de la cible au maximum.
      const avance = (score - cible) / Math.max(1, max - cible);
      palier = Math.min(11, 8 + Math.floor(avance * 4));
    } else {
      // Huit paliers pour aller de zéro à la cible. Le palier 0 est réservé au
      // score nul : dès le premier mot trouvé, le message change.
      palier = Math.min(7, Math.floor((score / cible) * 8));
      if (score > 0) palier = Math.max(1, palier);
    }

    return {
      cible: cible,
      palier: palier,
      gagne: score >= cible,
      partJauge: max > 0 ? Math.min(100, (score / max) * 100) : 0,
      partCible: max > 0 ? Math.min(100, (cible / max) * 100) : 0,
    };
  }

  /** Score d'entrée de chacun des 12 paliers, pour les afficher en liste. */
  function seuils(max, partCible) {
    const cible = Math.max(1, Math.round(max * partCible));
    const liste = [];
    for (let k = 1; k <= 8; k++) liste.push(Math.ceil((cible * k) / 8));
    for (let k = 1; k <= 4; k++) liste.push(Math.ceil(cible + ((max - cible) * k) / 4));
    return liste;
  }

  /**
   * Installe le balisage dans un conteneur et renvoie de quoi le mettre à jour.
   * @param {HTMLElement} conteneur
   * @param {object} options  partCible, paliers, textes {cible, max, points}
   */
  function installer(conteneur, options) {
    conteneur.classList.add('progression');
    conteneur.innerHTML =
      '<p class="progression-mot">' +
      '<span class="progression-emoji"></span>' +
      '<span class="progression-texte"></span>' +
      '</p>' +
      '<div class="progression-piste">' +
      '<span class="progression-jauge"></span>' +
      '<span class="progression-repere"></span>' +
      '</div>' +
      '<p class="progression-chiffres">' +
      '<span class="progression-score"></span>' +
      '<span class="progression-cible"></span>' +
      '<span class="progression-max"></span>' +
      '</p>';

    const emoji = conteneur.querySelector('.progression-emoji');
    const texte = conteneur.querySelector('.progression-texte');
    const jauge = conteneur.querySelector('.progression-jauge');
    const repere = conteneur.querySelector('.progression-repere');
    const vueScore = conteneur.querySelector('.progression-score');
    const vueCible = conteneur.querySelector('.progression-cible');
    const vueMax = conteneur.querySelector('.progression-max');

    let reglages = options || {};

    return {
      /** Change la langue ou les libellés sans reconstruire. */
      configurer(nouveaux) {
        reglages = Object.assign({}, reglages, nouveaux);
      },

      maj(score, max) {
        const paliers = reglages.paliers || PALIERS_FR;
        const textes = reglages.textes || {};
        const infos = etat(score, max, reglages.partCible || 0.3);
        const palier = paliers[Math.min(infos.palier, paliers.length - 1)];

        emoji.textContent = palier.emoji;
        texte.textContent = palier.mot;
        jauge.style.width = infos.partJauge + '%';
        jauge.classList.toggle('progression-jauge--gagnee', infos.gagne);
        repere.style.left = infos.partCible + '%';
        repere.title = (textes.cible || 'cible') + ' : ' + infos.cible;

        vueScore.innerHTML = '<b>' + score + '</b> ' + (textes.points || 'pts');
        vueCible.innerHTML = (textes.cible || 'cible') + ' <b>' + infos.cible + '</b>';
        vueMax.innerHTML = (textes.max || 'max') + ' <b>' + max + '</b>';

        conteneur.setAttribute(
          'aria-label',
          `${score} ${textes.points || 'points'}, ${textes.cible || 'cible'} ${infos.cible}, ` +
            `${textes.max || 'maximum'} ${max}. ${palier.mot}`
        );
        return infos;
      },

      etat(score, max) {
        return etat(score, max, reglages.partCible || 0.3);
      },
    };
  }

  JM.progression = {
    PALIERS_FR: PALIERS_FR,
    PALIERS_EN: PALIERS_EN,
    etat: etat,
    seuils: seuils,
    installer: installer,
  };
})(window);
