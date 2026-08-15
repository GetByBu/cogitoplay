/*
 * dico.js — chargement et indexation des listes de mots.
 *
 * Les fichiers de /shared/dictionnaires/ sont utilisés tels quels (voir
 * LICENCES_ET_SOURCES.md). Le loader les récupère par fetch(), filtre par
 * longueur, et construit :
 *   - un Set des formes normalisées (sans accents) pour la validation ;
 *   - une Map norme -> première graphie d'origine, pour réafficher le mot
 *     correctement accentué au joueur.
 *
 * La normalisation d'accents est indispensable : les grilles et les claviers
 * ne produisent que des lettres non accentuées, alors qu'un tiers des mots
 * français de la liste en portent (« hématome » se joue h-e-m-a-t-o-m-e).
 */
(function (global) {
  const JM = global.JM || (global.JM = {});

  // Chemin des dictionnaires, résolu par rapport à ce script : chaque jeu peut
  // vivre dans son propre sous-dossier sans se soucier des « ../ ».
  const BASE_DICOS = new URL('dictionnaires/', document.currentScript.src);

  const cache = new Map();

  /** Minuscules, ligatures développées, diacritiques supprimés. */
  JM.normaliser = function (mot) {
    return mot
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  /**
   * Charge un dictionnaire.
   * @param {string} fichier  nom du fichier dans /shared/dictionnaires/
   * @param {{min?:number, max?:number}} options  bornes de longueur (après normalisation)
   * @returns {Promise<{mots:Set<string>, graphies:Map<string,string>, liste:string[]}>}
   */
  JM.chargerDico = function (fichier, options) {
    const min = (options && options.min) || 1;
    const max = (options && options.max) || Infinity;
    const cleCache = `${fichier}|${min}|${max}`;

    if (cache.has(cleCache)) return cache.get(cleCache);

    const promesse = fetch(new URL(fichier, BASE_DICOS))
      .then((reponse) => {
        if (!reponse.ok) {
          throw new Error(`${fichier} : réponse ${reponse.status}`);
        }
        return reponse.text();
      })
      .then((texte) => {
        const mots = new Set();
        const graphies = new Map();
        const lignes = texte.split('\n');

        for (let i = 0; i < lignes.length; i++) {
          const brut = lignes[i].trim();
          if (!brut) continue;
          const norme = JM.normaliser(brut);
          if (norme.length < min || norme.length > max) continue;
          if (!/^[a-z]+$/.test(norme)) continue; // écarte les résidus non alphabétiques
          if (!mots.has(norme)) {
            mots.add(norme);
            graphies.set(norme, brut);
          }
        }

        // Tri explicite : la normalisation peut réordonner par rapport au
        // fichier source, or les tirages déterministes dépendent de l'ordre.
        const liste = Array.from(mots).sort();
        return { mots, graphies, liste };
      });

    cache.set(cleCache, promesse);
    return promesse;
  };

  /** Graphie d'origine d'un mot normalisé (« hematome » -> « hématome »). */
  JM.graphie = function (dico, norme) {
    return dico.graphies.get(norme) || norme;
  };

  /**
   * Message d'erreur explicite quand le fetch échoue — le cas de loin le plus
   * fréquent est l'ouverture du fichier en file://, que Chrome et Safari
   * bloquent pour toute requête locale.
   */
  JM.messageErreurDico = function (erreur) {
    const enLocal = location.protocol === 'file:';
    if (enLocal) {
      return (
        'Le dictionnaire n’a pas pu être chargé parce que la page est ouverte ' +
        'directement depuis le disque (file://), ce que le navigateur interdit pour ' +
        'les requêtes locales.\n\n' +
        'Lance un petit serveur à la racine du projet :\n' +
        '    python3 -m http.server 8000\n' +
        'puis ouvre http://localhost:8000/'
      );
    }
    return 'Le dictionnaire n’a pas pu être chargé : ' + erreur.message;
  };
})(window);
