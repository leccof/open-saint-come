/* ============================================================================
   views/dom.js — la petite boîte à outils pour fabriquer du HTML.
   ----------------------------------------------------------------------------
   Pas de framework, pas de moteur de gabarits : une seule fonction, `h`, qui
   crée un élément.

   POURQUOI PAS innerHTML ? Parce qu'on affiche des noms saisis par des humains.
   Si quelqu'un s'inscrit sous le nom « <script>… », innerHTML l'exécuterait.
   En passant par createElement et textContent, le texte reste du texte, quoi
   qu'il contienne. C'est gratuit, et ça règle la question une fois pour toutes.
   ============================================================================ */

/** Propriétés à poser sur l'objet plutôt qu'en attribut HTML. */
const PROPRIETES = new Set(['value', 'checked', 'disabled', 'selected', 'textContent']);

/**
 * Crée un élément.
 *
 *   h('button', { class: 'bouton', onclick: f }, 'Tirer un nom')
 *   h('li', { class: 'ligne' }, h('span', {}, nom), boutonSupprimer)
 *
 * Les enfants peuvent être : une chaîne, un nombre, un élément, un tableau,
 * ou null / false / undefined (ignorés — pratique pour l'affichage conditionnel).
 */
export function h(balise, proprietes = {}, ...enfants) {
  const el = document.createElement(balise);

  for (const [cle, valeur] of Object.entries(proprietes || {})) {
    if (valeur == null || valeur === false) continue;

    if (cle === 'class') el.className = valeur;
    else if (cle === 'dataset') Object.assign(el.dataset, valeur);
    else if (cle === 'style' && typeof valeur === 'object') Object.assign(el.style, valeur);
    else if (cle.startsWith('on') && typeof valeur === 'function') {
      el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    } else if (PROPRIETES.has(cle)) el[cle] = valeur;
    else if (valeur === true) el.setAttribute(cle, '');
    else el.setAttribute(cle, valeur);
  }

  ajouterEnfants(el, enfants);
  return el;
}

function ajouterEnfants(el, enfants) {
  for (const enfant of enfants) {
    if (enfant == null || enfant === false || enfant === true) continue;
    if (Array.isArray(enfant)) { ajouterEnfants(el, enfant); continue; }
    el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

/**
 * Ajoute des enfants à un élément existant.
 *
 * À UTILISER PARTOUT À LA PLACE DE element.append(). La méthode native du
 * navigateur convertit null en la chaîne « null » et l'affiche à l'écran : un
 * `condition ? element : null` suffit donc à faire apparaître un « null » au
 * milieu d'une page. Celle-ci ignore null, false et undefined, exactement
 * comme h() le fait pour ses enfants.
 */
export function ajouter(el, ...enfants) {
  ajouterEnfants(el, enfants);
  return el;
}

/** Vide un élément de tout son contenu. */
export function vider(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Remplace le contenu d'un élément. */
export function remplir(el, ...enfants) {
  vider(el);
  ajouterEnfants(el, enfants);
  return el;
}

/* ----------------------------------------------------------------------------
   Quelques fabriques répétées partout, pour éviter de réécrire les mêmes
   classes vingt fois.
   ---------------------------------------------------------------------------- */

export const titre = (texte) => h('h1', { class: 'titre-ecran' }, texte);
export const mention = (texte) => h('p', { class: 'mention' }, texte);
export const chapo = (texte) => h('p', { class: 'chapo' }, texte);
export const filet = () => h('hr', { class: 'filet' });
export const vide = (texte) => h('p', { class: 'vide' }, texte);

export function bouton(texte, options = {}) {
  const { variante = '', ...reste } = options;
  return h('button', {
    type: 'button',
    class: `bouton ${variante}`.trim(),
    ...reste,
  }, texte);
}

/** Formate une date ISO (2026-08-15) en français lisible (15 août 2026). */
export function dateLisible(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
