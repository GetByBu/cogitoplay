/*
 * storage.js — accès localStorage, tolérant aux navigations privées.
 *
 * Toutes les clés sont préfixées « jm. » et suffixées par un numéro de version
 * pour pouvoir changer de format plus tard sans casser les parties en cours.
 * Aucune donnée personnelle, aucun identifiant : uniquement la progression.
 */
(function (global) {
  const JM = global.JM || (global.JM = {});

  const PREFIXE = 'jm.';
  let disponible = null;

  function estDisponible() {
    if (disponible !== null) return disponible;
    try {
      const test = PREFIXE + '__test';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      disponible = true;
    } catch (e) {
      disponible = false; // mode privé, stockage désactivé, quota plein…
    }
    return disponible;
  }

  JM.storage = {
    disponible: estDisponible,

    lire(cle, defaut) {
      if (!estDisponible()) return defaut;
      try {
        const brut = localStorage.getItem(PREFIXE + cle);
        return brut === null ? defaut : JSON.parse(brut);
      } catch (e) {
        return defaut;
      }
    },

    ecrire(cle, valeur) {
      if (!estDisponible()) return false;
      try {
        localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
        return true;
      } catch (e) {
        return false;
      }
    },

    effacer(cle) {
      if (!estDisponible()) return;
      try {
        localStorage.removeItem(PREFIXE + cle);
      } catch (e) {
        /* rien à faire */
      }
    },

    /** Efface toutes les clés du projet (bouton « effacer mes données »). */
    toutEffacer() {
      if (!estDisponible()) return;
      const aSupprimer = [];
      for (let i = 0; i < localStorage.length; i++) {
        const cle = localStorage.key(i);
        if (cle && cle.startsWith(PREFIXE)) aSupprimer.push(cle);
      }
      aSupprimer.forEach((cle) => localStorage.removeItem(cle));
    },
  };

  /** Préférences communes à tous les jeux (thème, palette). */
  JM.prefs = {
    lire() {
      return JM.storage.lire('prefs.v1', { palette: 'standard' });
    },
    ecrire(prefs) {
      JM.storage.ecrire('prefs.v1', prefs);
    },
    /** Applique la palette sur <html> ; à appeler au démarrage de chaque jeu. */
    appliquer() {
      const prefs = JM.prefs.lire();
      document.documentElement.dataset.palette = prefs.palette || 'standard';
      return prefs;
    },
  };
})(window);
