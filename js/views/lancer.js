/* ============================================================================
   views/lancer.js — le lancer de boule du chapeau.
   ----------------------------------------------------------------------------
   L'animation du moment de suspense. Elle reprend, en mouvement, le motif de
   l'affiche : le cercle de lancement, l'arc unique, le but. Ce qui était un
   diagramme immobile devient le geste lui-même.

   LE DÉROULÉ, ET POURQUOI IL EST FAIT COMME ÇA :

     0 %  →  40 %   LE LANCER. La boule quitte le cercle et décrit sa parabole.
                    Pendant ce temps, les noms défilent à pleine vitesse : rien
                    n'est encore décidé, du moins c'est ce que ça raconte.

           40 %     L'IMPACT. C'est le temps fort. La boule touche le sol, un
                    anneau se propage, l'écran encaisse le choc, le téléphone
                    vibre. Et surtout : le rouleau de noms se met à freiner
                    BRUTALEMENT. Le coup a été joué, la roue s'arrête.

    40 %  → 100 %   LA COURSE. Deux rebonds qui s'amortissent, puis la boule
                    roule et vient mourir contre le but. Le nom se verrouille
                    à l'instant exact où elle s'immobilise.

   Le sort est jeté AVANT que tout cela ne commence (draw.js). Ce fichier ne
   décide de rien : il met en scène un résultat déjà connu.
   ============================================================================ */

import { h } from './dom.js';

/* ----------------------------------------------------------------------------
   GÉOMÉTRIE DE LA SCÈNE
   Le repère du SVG, en unités arbitraires. La scène s'étire à la largeur
   disponible sans se déformer.
   ---------------------------------------------------------------------------- */

const LARGEUR = 300;
const HAUTEUR = 96;

const SOL = 78;             // la ligne de sol
const X_CERCLE = 36;        // centre du cercle de lancement
const X_IMPACT = 214;       // là où la boule touche le sol
const X_ARRET = 239;        // là où elle s'immobilise, juste devant le but
const X_BUT = 253;          // le but, juste devant
const RAYON = 7.5;

const HAUTEUR_ARC = 62;     // hauteur de la parabole au sommet
const HAUTEUR_REBOND = 17;  // hauteur du premier rebond

/** Fraction de l'animation où la boule touche le sol. */
export const INSTANT_IMPACT = 0.4;

/* ----------------------------------------------------------------------------
   CONSTRUCTION
   ---------------------------------------------------------------------------- */

const SVG = 'http://www.w3.org/2000/svg';

function svg(balise, attributs) {
  const el = document.createElementNS(SVG, balise);
  for (const [k, v] of Object.entries(attributs)) el.setAttribute(k, v);
  return el;
}

/**
 * Crée la piste. Renvoie { element, placerAuDepart, jouer }.
 *
 * Les couleurs ne sont pas écrites ici : chaque forme porte une classe, et
 * c'est app.css qui les habille à partir des variables du thème. La règle du
 * projet tient aussi dans les images.
 */
export function creerPiste() {
  const racine = svg('svg', {
    class: 'piste',
    viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`,
    'aria-hidden': 'true',      // décor : rien à annoncer à un lecteur d'écran
  });

  const sol = svg('line', {
    class: 'piste__sol', x1: 14, y1: SOL, x2: LARGEUR - 14, y2: SOL,
  });

  const cercle = svg('ellipse', {
    class: 'piste__cercle', cx: X_CERCLE, cy: SOL, rx: 17, ry: 4.6,
  });

  const but = svg('circle', { class: 'piste__but', cx: X_BUT, cy: SOL, r: 2.8 });

  // L'onde de choc. Elle grandit et son trait s'amincit jusqu'à disparaître —
  // aucune transparence, conformément à la philosophie : on ne mélange pas les
  // encres, on change l'épaisseur du trait.
  const impact = svg('circle', {
    class: 'piste__impact', cx: X_IMPACT, cy: SOL, r: 0, 'stroke-width': 0,
  });

  const boule = svg('g', { class: 'piste__boule' });
  boule.append(
    svg('circle', { class: 'piste__boule-corps', cx: 0, cy: 0, r: RAYON }),
    // Deux stries : sans elles, une sphère qui roule ne se distingue pas d'une
    // sphère qui glisse. C'est ce détail qui donne le poids de la boule.
    svg('line', { class: 'piste__stries', x1: -RAYON + 1.6, y1: -2.4, x2: RAYON - 1.6, y2: -2.4 }),
    svg('line', { class: 'piste__stries', x1: -RAYON + 1.6, y1: 2.4, x2: RAYON - 1.6, y2: 2.4 })
  );

  racine.append(sol, cercle, but, impact, boule);

  function placer(x, y, angle) {
    boule.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
  }

  placer(X_CERCLE, SOL, 0);

  /**
   * Joue le lancer.
   * @param {number} duree      durée totale, en millisecondes
   * @param {object} rappels    { surImpact, surArret }
   */
  function jouer(duree, { surImpact = () => {}, surArret = () => {} } = {}) {
    const depart = performance.now();
    let impactAnnonce = false;

    function trame(maintenant) {
      const p = Math.min(1, (maintenant - depart) / duree);

      let x, y;

      if (p < INSTANT_IMPACT) {
        // --- le vol : une parabole simple, vitesse horizontale constante ---
        const u = p / INSTANT_IMPACT;
        x = X_CERCLE + (X_IMPACT - X_CERCLE) * u;
        y = SOL - 4 * HAUTEUR_ARC * u * (1 - u);
      } else {
        const v = (p - INSTANT_IMPACT) / (1 - INSTANT_IMPACT);

        // --- la course au sol : la boule décélère jusqu'à s'arrêter net ---
        x = X_IMPACT + (X_ARRET - X_IMPACT) * (1 - Math.pow(1 - v, 3));

        // --- les rebonds : une sinusoïde redressée, amortie ---
        // |sin| donne des cloches successives, l'exponentielle les écrase.
        const rebond = HAUTEUR_REBOND * Math.exp(-5.2 * v) * Math.abs(Math.sin(Math.PI * 2.6 * v));
        y = SOL - rebond;

        if (!impactAnnonce) {
          impactAnnonce = true;
          impact.setAttribute('r', 5);
          impact.setAttribute('stroke-width', 2);
          surImpact();
        }
      }

      // Roulement sans glissement : l'angle suit la distance parcourue.
      const angle = ((x - X_CERCLE) / RAYON) * (180 / Math.PI);
      placer(x, y, angle);

      // L'onde de choc, une fois déclenchée.
      if (impactAnnonce) {
        const v = (p - INSTANT_IMPACT) / (1 - INSTANT_IMPACT);
        const q = Math.min(1, v / 0.45);
        impact.setAttribute('r', 5 + 24 * q);
        impact.setAttribute('stroke-width', (2 * (1 - q)).toFixed(2));
      }

      if (p < 1) {
        requestAnimationFrame(trame);
      } else {
        placer(X_ARRET, SOL, angle);
        impact.setAttribute('stroke-width', 0);
        surArret();
      }
    }

    requestAnimationFrame(trame);
  }

  /** Remet la boule dans le cercle, prête pour le tirage suivant. */
  function placerAuDepart() {
    placer(X_CERCLE, SOL, 0);
    impact.setAttribute('r', 0);
    impact.setAttribute('stroke-width', 0);
  }

  /** La boule à l'arrêt contre le but : l'état après un tirage. */
  function placerALArrivee() {
    placer(X_ARRET, SOL, 190);
    impact.setAttribute('r', 0);
    impact.setAttribute('stroke-width', 0);
  }

  return { element: racine, jouer, placerAuDepart, placerALArrivee };
}

/**
 * Une secousse brève sur un élément : le choc encaissé par l'écran.
 * Purement décoratif, et retiré tout seul.
 */
export function secouer(element) {
  element.classList.remove('secousse');
  // Forcer le navigateur à recalculer, sinon réajouter la classe tout de suite
  // ne relance pas l'animation.
  void element.offsetWidth;
  element.classList.add('secousse');
  setTimeout(() => element.classList.remove('secousse'), 240);
}

/**
 * Une vibration courte, quand l'appareil sait le faire.
 * Silencieusement ignorée sur iPhone, qui ne l'expose pas au navigateur.
 */
export function vibrer(motif) {
  try { navigator.vibrate?.(motif); } catch { /* sans importance */ }
}
