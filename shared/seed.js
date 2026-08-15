/*
 * seed.js — tirages déterministes à partir de la date.
 *
 * Principe : une chaîne de caractères (« jeu-mot:2026-08-15 ») est réduite en
 * entier 32 bits par FNV-1a, qui sert de graine à un générateur mulberry32.
 * Même chaîne = même suite de nombres, sur n'importe quelle machine et
 * n'importe quel navigateur : la partie du jour est identique pour tout le
 * monde sans le moindre échange réseau.
 */
(function (global) {
  const JM = global.JM || (global.JM = {});

  // Référence des numéros de jour : le 1er janvier 2026 est le jour 0.
  const EPOQUE = Date.UTC(2026, 0, 1);
  const MS_PAR_JOUR = 86400000;

  /** Hachage FNV-1a 32 bits d'une chaîne. */
  function hash32(chaine) {
    let h = 0x811c9dc5;
    for (let i = 0; i < chaine.length; i++) {
      h ^= chaine.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Générateur pseudo-aléatoire mulberry32 : rapide, court, bien distribué. */
  function mulberry32(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Renvoie une fonction rng() -> [0,1) reproductible pour cette clé. */
  JM.rng = function (cle) {
    return mulberry32(hash32(String(cle)));
  };

  /** Entier dans [0, borne). */
  JM.entier = function (rng, borne) {
    return Math.floor(rng() * borne);
  };

  /** Date locale au format YYYY-MM-DD (pas UTC : le « jour » est celui du joueur). */
  JM.dateISO = function (d) {
    d = d || new Date();
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mois}-${jour}`;
  };

  /**
   * Numéro du jour depuis l'époque, calculé sur les composantes locales pour
   * qu'un changement d'heure ne décale jamais le compte.
   */
  JM.numeroJour = function (d) {
    d = d || new Date();
    const minuitLocal = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((minuitLocal - EPOQUE) / MS_PAR_JOUR);
  };

  /** Numéro de la période de `taille` jours contenant `d` (Jeu 3 : taille 14). */
  JM.numeroPeriode = function (taille, d) {
    return Math.floor(JM.numeroJour(d) / taille);
  };

  /** Millisecondes restantes avant le prochain minuit local. */
  JM.msAvantMinuit = function (d) {
    d = d || new Date();
    const minuit = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return minuit.getTime() - d.getTime();
  };

  /** Mélange de Fisher-Yates sur une copie du tableau, piloté par rng. */
  JM.melange = function (tableau, rng) {
    const copie = tableau.slice();
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copie[i];
      copie[i] = copie[j];
      copie[j] = tmp;
    }
    return copie;
  };

  /**
   * Tire l'élément numéro `index` d'une liste sans jamais répéter tant que la
   * liste n'est pas épuisée : chaque « cycle » de N tirages est une permutation
   * complète de la liste, dépendant du numéro de cycle. Deux joueurs au même
   * index obtiennent le même élément.
   */
  JM.tirageSansRepetition = function (liste, index, cle) {
    const taille = liste.length;
    if (taille === 0) return undefined;
    const cycle = Math.floor(index / taille);
    const position = index - cycle * taille;
    const permutation = JM.melange(liste, JM.rng(`${cle}#cycle${cycle}`));
    return permutation[position];
  };
})(window);
