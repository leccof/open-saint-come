/* ============================================================================
   views/lancer.js — le lancer de boule du chapeau.
   ----------------------------------------------------------------------------
   L'animation du moment de suspense. Elle reprend, en mouvement, le motif de
   l'affiche : le cercle de lancement, l'arc unique, le but. Ce qui était un
   diagramme immobile devient le geste lui-même.

   ----------------------------------------------------------------------------
   POURQUOI GSAP, ET POURQUOI IL EST DANS LE DÉPÔT

   Toute la séquence tient dans UNE timeline : la boule, sa rotation, l'onde de
   choc et le rouleau de noms y sont placés sur la même règle graduée. C'est ce
   qui garantit que le freinage des noms tombe exactement sur l'impact — à la
   milliseconde, sans horloge à synchroniser à la main.

   La bibliothèque est SERVIE DEPUIS LE SITE (js/vendor/gsap.min.js), pas
   depuis un CDN. Sur un terrain en Aveyron le réseau saute : un CDN muet
   aurait cassé le moment le plus attendu de la journée. Ici, si l'application
   s'affiche, l'animation fonctionne. Aucun npm, aucun bundler, aucune étape de
   build — un fichier, chargé comme le reste.

   ----------------------------------------------------------------------------
   LE DÉROULÉ, EN FRACTIONS DE LA DURÉE TOTALE

     0    → 0,40   LE LANCER. La boule quitte le cercle et décrit sa parabole.
                   Les noms défilent à pleine vitesse : rien ne semble décidé.

          0,40     L'IMPACT. Elle touche le sol, une onde se propage, l'écran
                   encaisse le choc, le téléphone vibre — et le rouleau se met
                   à freiner BRUTALEMENT. Le coup a été joué.

     0,40 → 1,00   LA COURSE. Les rebonds s'amortissent, la boule roule et
                   vient mourir devant le but. Le nom se verrouille à l'instant
                   exact où elle s'immobilise.

   Le sort est jeté AVANT que tout cela ne commence (draw.js). Ce fichier ne
   décide de rien : il met en scène un résultat déjà connu.
   ============================================================================ */

/* GSAP est chargé par index.html, en balise <script> classique (voir le
   commentaire là-bas : le format UMD est incompatible avec un import de
   module, qui est en mode strict). On le lit donc ici sur window.

   Le garde-fou n'est pas décoratif : si pour une raison quelconque la
   bibliothèque manquait, mieux vaut un tirage sans animation qu'un écran
   blanc au milieu du chapeau. */
const gsap = window.gsap;
const DISPONIBLE = !!gsap;

/* ----------------------------------------------------------------------------
   GÉOMÉTRIE DE LA SCÈNE — en unités du repère SVG
   ---------------------------------------------------------------------------- */

const LARGEUR = 300;
const HAUTEUR = 96;

const SOL = 78;
const X_CERCLE = 36;        // centre du cercle de lancement
const X_IMPACT = 214;       // là où la boule touche le sol
const X_ARRET = 239;        // là où elle s'immobilise, devant le but
const X_BUT = 253;
const RAYON = 7.5;

const HAUTEUR_ARC = 62;     // hauteur de la parabole au sommet

/** Fraction de la durée où la boule touche le sol. */
export const INSTANT_IMPACT = 0.4;

/* La montée occupe la première moitié du vol. La descente, elle, est confiée à
   l'assouplissement « bounce.out » de GSAP, qui contient DÉJÀ les rebonds : sa
   première touche au sol se produit à 36,36 % de sa durée. On cale donc la
   descente pour que cette première touche tombe pile sur INSTANT_IMPACT. */
const DEBUT_CHUTE = 0.2;
const PREMIERE_TOUCHE = 0.363636;                 // propriété de bounce.out
const DUREE_CHUTE = (INSTANT_IMPACT - DEBUT_CHUTE) / PREMIERE_TOUCHE;

/** Rotation d'une boule qui roule sans glisser, en degrés. */
const angleA = (x) => ((x - X_CERCLE) / RAYON) * (180 / Math.PI);

/* ----------------------------------------------------------------------------
   CONSTRUCTION DE LA SCÈNE
   ---------------------------------------------------------------------------- */

const NS = 'http://www.w3.org/2000/svg';

function svg(balise, attributs) {
  const el = document.createElementNS(NS, balise);
  for (const [k, v] of Object.entries(attributs)) el.setAttribute(k, v);
  return el;
}

/**
 * Crée la piste. Renvoie { element, jouer, placerAuDepart, placerALArrivee }.
 *
 * Aucune couleur n'est écrite ici : chaque forme porte une classe, et c'est
 * app.css qui l'habille à partir des variables du thème. La règle du projet
 * vaut aussi pour les images.
 */
export function creerPiste() {
  const racine = svg('svg', {
    class: 'piste',
    viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`,
    'aria-hidden': 'true',        // décor : rien à annoncer à un lecteur d'écran
  });

  const sol = svg('line', { class: 'piste__sol', x1: 14, y1: SOL, x2: LARGEUR - 14, y2: SOL });
  const cercle = svg('ellipse', { class: 'piste__cercle', cx: X_CERCLE, cy: SOL, rx: 17, ry: 4.6 });
  const but = svg('circle', { class: 'piste__but', cx: X_BUT, cy: SOL, r: 2.8 });

  // L'onde de choc s'efface en AMINCISSANT son trait, jamais en devenant
  // transparente : on ne mélange pas les encres.
  const onde = svg('circle', { class: 'piste__impact', cx: X_IMPACT, cy: SOL, r: 0, 'stroke-width': 0 });

  const boule = svg('g', { class: 'piste__boule' });
  boule.append(
    svg('circle', { class: 'piste__boule-corps', cx: 0, cy: 0, r: RAYON }),
    // Deux stries : sans elles, une sphère qui roule ne se distingue pas d'une
    // sphère qui glisse. C'est ce détail qui donne son poids à la boule.
    svg('line', { class: 'piste__stries', x1: -RAYON + 1.6, y1: -2.4, x2: RAYON - 1.6, y2: -2.4 }),
    svg('line', { class: 'piste__stries', x1: -RAYON + 1.6, y1: 2.4, x2: RAYON - 1.6, y2: 2.4 })
  );

  racine.append(sol, cercle, but, onde, boule);

  let timeline = null;

  function poser(x, angle) {
    timeline?.kill();
    if (DISPONIBLE) {
      gsap.set(boule, { x, y: SOL, rotation: angle });
      gsap.set(onde, { attr: { r: 0, 'stroke-width': 0 } });
    } else {
      boule.setAttribute('transform', `translate(${x} ${SOL}) rotate(${angle})`);
      onde.setAttribute('r', 0);
    }
  }

  const placerAuDepart = () => poser(X_CERCLE, 0);
  const placerALArrivee = () => poser(X_ARRET, angleA(X_ARRET));

  placerAuDepart();

  /**
   * Joue le lancer, et entraîne le rouleau de noms avec lui.
   *
   * @param {number} duree            durée totale, en millisecondes
   * @param {object} options
   *        rouleau    l'élément de la bande de noms (facultatif)
   *        distance   de combien la faire défiler, en pixels
   *        surImpact  appelé au contact de la boule avec le sol
   *        surArret   appelé quand tout est immobile
   */
  function jouer(duree, { rouleau = null, distance = 0, surImpact = () => {}, surArret = () => {} } = {}) {
    // Sans la bibliothèque : pas d'animation, mais le tirage aboutit.
    if (!DISPONIBLE) {
      placerALArrivee();
      if (rouleau && distance) rouleau.style.transform = `translateY(${-distance}px)`;
      surImpact();
      surArret();
      return null;
    }

    placerAuDepart();

    const tl = gsap.timeline({
      // La timeline est construite sur une durée de 1, puis mise à l'échelle :
      // toutes les positions ci-dessous se lisent donc comme des fractions.
      onComplete: surArret,

      /* lazy: false — GSAP diffère par défaut l'initialisation de certaines
         interpolations à l'image suivante, par souci de performance. Sur une
         séquence courte et très calée comme celle-ci, ce report provoque une
         première image fausse, et rend l'animation impossible à inspecter
         proprement. Le gain de performance est nul ici : quelques éléments. */
      defaults: { lazy: false },
    });

    /* ---- la boule ------------------------------------------------------- */

    // Vol : vitesse horizontale constante, comme une vraie parabole.
    tl.to(boule, { x: X_IMPACT, duration: INSTANT_IMPACT, ease: 'none' }, 0)
      .to(boule, { rotation: angleA(X_IMPACT), duration: INSTANT_IMPACT, ease: 'none' }, 0)

      // Montée jusqu'au sommet, puis chute : « bounce.out » enchaîne la chute
      // ET les rebonds amortis, avec des hauteurs de rebond décroissantes.
      .to(boule, { y: SOL - HAUTEUR_ARC, duration: DEBUT_CHUTE, ease: 'power2.out' }, 0)
      .to(boule, { y: SOL, duration: DUREE_CHUTE, ease: 'bounce.out' }, DEBUT_CHUTE)

      // Course au sol : la boule décélère et s'arrête devant le but. La
      // rotation suit exactement la même courbe, sinon elle glisserait.
      .to(boule, { x: X_ARRET, duration: 1 - INSTANT_IMPACT, ease: 'power3.out' }, INSTANT_IMPACT)
      .to(boule, { rotation: angleA(X_ARRET), duration: 1 - INSTANT_IMPACT, ease: 'power3.out' }, INSTANT_IMPACT)

      /* ---- l'impact ----------------------------------------------------- */
      .call(surImpact, null, INSTANT_IMPACT)
      .set(onde, { attr: { r: 5, 'stroke-width': 2 } }, INSTANT_IMPACT)
      .to(onde, { attr: { r: 29, 'stroke-width': 0 }, duration: 0.28, ease: 'power2.out' }, INSTANT_IMPACT);

    /* ---- le rouleau de noms ----------------------------------------------
       EN DEUX TEMPS, et c'est tout l'effet.

       Avant l'impact, la roue tourne encore presque à pleine vitesse : elle a
       parcouru un peu plus de la moitié du chemin, mais rien ne semble joué.
       À la seconde où la boule touche le sol, elle freine d'un coup et va
       mourir sur le nom.

       Une décélération régulière donnerait un compte à rebours. Ce
       décrochement-là donne un coup joué. */
    if (rouleau && distance) {
      tl.fromTo(rouleau, { y: 0 },
        { y: -distance * 0.58, duration: INSTANT_IMPACT, ease: 'power1.out' }, 0)
        .to(rouleau, { y: -distance, duration: 1 - INSTANT_IMPACT, ease: 'expo.out' }, INSTANT_IMPACT);
    }

    tl.duration(duree / 1000);      // mise à l'échelle de toute la séquence
    timeline = tl;
    return tl;
  }

  return { element: racine, jouer, placerAuDepart, placerALArrivee };
}

/* ----------------------------------------------------------------------------
   LES DEUX PETITS EFFETS DU CHOC
   ---------------------------------------------------------------------------- */

/** Une secousse brève : le choc encaissé par l'écran. */
export function secouer(element) {
  if (!DISPONIBLE) return;
  gsap.fromTo(element,
    { x: 0, y: 0 },
    { keyframes: [{ x: 2, y: 1.5 }, { x: -1.5, y: -1 }, { x: 1, y: 0.5 }, { x: 0, y: 0 }],
      duration: 0.2, ease: 'none', clearProps: 'transform' });
}

/** Le nom qui se verrouille : une prise de volume franche, aussitôt rattrapée. */
export function claquer(element) {
  if (!DISPONIBLE) return;
  gsap.fromTo(element, { scale: 1.07 },
    { scale: 1, duration: 0.16, ease: 'power2.out', clearProps: 'transform' });
}

/**
 * Une vibration courte, quand l'appareil sait le faire.
 * Silencieusement ignorée sur iPhone, qui ne l'expose pas au navigateur.
 */
export function vibrer(motif) {
  try { navigator.vibrate?.(motif); } catch { /* sans importance */ }
}
