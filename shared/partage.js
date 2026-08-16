/*
 * partage.js — le texte que copie le bouton « Copier mon résultat ».
 *
 * Un partage sans adresse est un cul-de-sac : celui qui le reçoit voit le
 * résultat, n'a rien à cliquer, et le jeu s'arrête là. Chaque partage porte
 * donc le nom du site en tête et son adresse en pied.
 *
 * Cette adresse n'est pas écrite en dur mais **lue là où la page se trouve**.
 * Le jour où le site déménage sur son nom de domaine, les partages suivent
 * seuls — sinon on distribuerait des liens vers l'ancienne adresse pendant des
 * mois sans s'en apercevoir.
 */
(function (global) {
  'use strict';

  const JM = global.JM || (global.JM = {});

  const NOM = 'CogitoPlay';

  // Les mêmes couleurs que les jeux de mots, palette de lisibilité comprise.
  const CARRES = {
    standard: { plein: '🟩', vide: '⬜' },
    distincte: { plein: '🟦', vide: '⬜' },
  };

  /** L'adresse du jeu en cours, sans le `index.html` qui n'apporte rien. */
  function lien() {
    return (location.origin + location.pathname).replace(/index\.html$/, '');
  }

  /**
   * Une barre de dix carrés, pour donner à voir un score.
   *
   * Le mot mystère se partage bien parce qu'on **voit** la partie ; une phrase
   * de statistiques, personne ne la transmet. Les autres jeux n'ont pas de
   * grille à montrer, mais ils ont une progression vers une cible.
   */
  function barre(part, cases) {
    const total = cases || 10;
    const palette = CARRES[JM.prefs.lire().palette] || CARRES.standard;
    const pleins = Math.max(0, Math.min(total, Math.round((part || 0) * total)));
    return palette.plein.repeat(pleins) + palette.vide.repeat(total - pleins);
  }

  /** Assemble le partage : nom du site, le corps fourni par le jeu, l'adresse. */
  function composer(lignes) {
    const utiles = lignes.filter(Boolean);
    return [NOM + ' · ' + utiles[0]].concat(utiles.slice(1)).concat(lien()).join('\n');
  }

  /**
   * Copie dans le presse-papier. Rend une promesse de booléen plutôt que
   * d'afficher elle-même un message : la grille anglaise doit annoncer le
   * résultat dans sa langue.
   */
  function copier(texte) {
    function secours() {
      // L'API moderne manque encore sur d'anciens navigateurs, et le protocole
      // file:// la refuse partout.
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
      return ok;
    }

    if (navigator.clipboard && location.protocol !== 'file:') {
      return navigator.clipboard.writeText(texte).then(function () {
        return true;
      }, secours);
    }
    return Promise.resolve(secours());
  }

  JM.partage = {
    NOM: NOM,
    lien: lien,
    barre: barre,
    composer: composer,
    copier: copier,
  };
})(window);
