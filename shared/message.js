/*
 * message.js — retours transitoires et confirmations, communs à tous les jeux.
 *
 * Un seul message à la fois : le suivant remplace le précédent dans le même
 * nœud. Empilés, ils recouvraient le compteur de mots et la barre de
 * progression dès qu'on validait plusieurs mots à la suite.
 *
 * Les confirmations passent par la fenêtre modale maison plutôt que par
 * confirm(), qui n'est pas stylable, change de tête selon le système et bloque
 * le fil d'exécution.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const enCours = new WeakMap(); // conteneur -> { noeud, minuterie }

  /**
   * Affiche un message transitoire.
   * @param {HTMLElement} conteneur
   * @param {string} texte
   * @param {{genre?: string, duree?: number}} options
   */
  JM.message = function (conteneur, texte, options) {
    if (!conteneur) return;
    const reglages = options || {};
    const genre = reglages.genre || 'neutre';
    const duree = reglages.duree || 1600;

    let etat = enCours.get(conteneur);
    if (!etat) {
      etat = { noeud: document.createElement('p'), minuterie: null };
      conteneur.appendChild(etat.noeud);
      enCours.set(conteneur, etat);
    }

    clearTimeout(etat.minuterie);
    if (!etat.noeud.isConnected) conteneur.appendChild(etat.noeud);

    etat.noeud.className = 'message--' + genre;
    etat.noeud.textContent = texte;
    // Relance l'animation d'apparition même si le texte est identique.
    etat.noeud.style.animation = 'none';
    void etat.noeud.offsetWidth;
    etat.noeud.style.animation = '';

    etat.minuterie = setTimeout(function () {
      etat.noeud.remove();
    }, duree);
  };

  /**
   * Confirmation dans une fenêtre modale maison.
   * @returns {Promise<boolean>} vrai si l'action est confirmée
   */
  JM.confirme = function (options) {
    const reglages = options || {};
    return new Promise(function (resoudre) {
      const dialogue = document.createElement('dialog');
      dialogue.className = 'jm-modale';
      dialogue.innerHTML =
        '<div class="jm-modale-contenu">' +
        '<h2></h2>' +
        '<p class="jm-note"></p>' +
        '<div class="jm-modale-actions">' +
        '<button class="jm-bouton" data-reponse="non"></button>' +
        '<button class="jm-bouton jm-bouton--principal" data-reponse="oui"></button>' +
        '</div>' +
        '</div>';

      dialogue.querySelector('h2').textContent = reglages.titre || '';
      const note = dialogue.querySelector('p');
      if (reglages.texte) note.textContent = reglages.texte;
      else note.remove();
      dialogue.querySelector('[data-reponse="non"]').textContent = reglages.annuler || 'Annuler';
      dialogue.querySelector('[data-reponse="oui"]').textContent = reglages.ok || 'Confirmer';

      let reponse = false;
      dialogue.addEventListener('click', function (evenement) {
        const bouton = evenement.target.closest('[data-reponse]');
        if (bouton) {
          reponse = bouton.dataset.reponse === 'oui';
          dialogue.close();
        } else if (evenement.target === dialogue) {
          dialogue.close(); // clic sur le fond : on annule
        }
      });
      dialogue.addEventListener('close', function () {
        dialogue.remove();
        resoudre(reponse);
      });

      document.body.appendChild(dialogue);
      dialogue.showModal();
    });
  };
})(window);
