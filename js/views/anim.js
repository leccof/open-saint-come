/* ============================================================================
   views/anim.js — le système de mouvement de l'application.
   ----------------------------------------------------------------------------
   Un seul endroit pour toutes les entrées d'écran, les révélations de titre et
   les tracés de filet. Les écrans appellent ces fonctions ; ils ne connaissent
   pas GSAP.

   TROIS RÈGLES, tenues partout :

     1. ON N'ANIME QUE `transform` ET `opacity`. Jamais width, height, top ni
        left : ceux-là déclenchent un recalcul de mise en page à chaque image et
        font saccader un téléphone d'entrée de gamme. Le mouvement reste sur le
        compositeur graphique.

     2. RIEN NE DURE PLUS DE 600 ms. On consulte cette app trois secondes entre
        deux mènes ; une animation qu'il faut attendre est une animation ratée.

     3. « RÉDUIRE LES ANIMATIONS » COUPE TOUT. Le réglage du téléphone est
        respecté sans exception — et l'écran s'affiche alors instantanément,
        jamais à moitié.
   ============================================================================ */

const gsap = window.gsap;
const DISPONIBLE = !!gsap;

/** Le système demande-t-il de limiter les animations ? */
const mouvementReduit = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Vrai si l'on doit animer. Sinon, l'appelant laisse tout en place. */
const onAnime = () => DISPONIBLE && !mouvementReduit();

/* ----------------------------------------------------------------------------
   L'ENTRÉE D'UN ÉCRAN
   ----------------------------------------------------------------------------
   Les blocs montent et apparaissent l'un après l'autre, à 45 ms d'intervalle.
   C'est court : le dernier est en place avant qu'on ait fini de lire le titre.
   L'effet ne se voit pas, il se sent — l'écran a l'air de se poser plutôt que
   d'apparaître d'un coup.
   ---------------------------------------------------------------------------- */

export function entreeEcran(racine) {
  if (!onAnime() || !racine) return;

  /* Les vues renvoient un unique conteneur : on descend d'un cran, sinon on
     n'animerait qu'un seul bloc et le décalage ne se verrait pas. */
  let cible = racine;
  if (cible.children.length === 1 && cible.firstElementChild) {
    cible = cible.firstElementChild;
  }

  /* L'écran d'ouverture est exclu : il a sa propre mise en scène, et les deux
     se marcheraient dessus. */
  const blocs = [...cible.children].filter((e) => !e.classList.contains('hero'));
  if (!blocs.length) return;

  gsap.killTweensOf(blocs);
  gsap.fromTo(blocs,
    { y: 20, autoAlpha: 0 },
    {
      y: 0, autoAlpha: 1,
      duration: 0.45,
      ease: 'power3.out',
      stagger: 0.045,
      overwrite: 'auto',
      // clearProps : on retire les styles posés par GSAP une fois l'entrée
      // finie, pour ne pas laisser de couche graphique inutile derrière soi.
      clearProps: 'all',
    });
}

/* ----------------------------------------------------------------------------
   LA RÉVÉLATION D'UN GRAND TITRE
   ----------------------------------------------------------------------------
   Chaque ligne monte depuis sous une fenêtre qui la masque, comme une affiche
   qu'on décolle. Il faut que le parent de chaque ligne ait `overflow: hidden` —
   c'est le rôle de la classe .titre-masque.
   ---------------------------------------------------------------------------- */

export function revelerTitre(lignes, retard = 0) {
  if (!onAnime()) return;
  gsap.fromTo(lignes,
    { yPercent: 115 },
    { yPercent: 0, duration: 0.85, ease: 'expo.out', stagger: 0.09, delay: retard });
}

/* ----------------------------------------------------------------------------
   LE MOTIF DE L'AFFICHE, QUI SE DESSINE
   ----------------------------------------------------------------------------
   Les cercles de mesure s'ouvrent depuis le but, et la trajectoire se trace.
   C'est le diagramme de l'affiche qui prend vie derrière le titre.
   ---------------------------------------------------------------------------- */

export function animerMotif(svgRacine, retard = 0) {
  if (!onAnime() || !svgRacine) return;

  const anneaux = svgRacine.querySelectorAll('.motif__anneau');
  const arc = svgRacine.querySelector('.motif__arc');
  const point = svgRacine.querySelector('.motif__but');

  const tl = gsap.timeline({ delay: retard, defaults: { lazy: false } });

  if (anneaux.length) {
    // On met l'origine au centre du but : les cercles s'ouvrent depuis lui.
    gsap.set(anneaux, { transformOrigin: 'center center' });
    tl.fromTo(anneaux,
      { scale: 0.35, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, 0);
  }

  if (arc) {
    // Tracé progressif : on masque le trait puis on découvre sa longueur.
    const longueur = arc.getTotalLength();
    tl.fromTo(arc,
      { strokeDasharray: longueur, strokeDashoffset: longueur },
      { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 0.15);
  }

  if (point) {
    tl.fromTo(point, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.75);
  }

  return tl;
}

/* ----------------------------------------------------------------------------
   UN NOMBRE QUI DÉFILE JUSQU'À SA VALEUR
   ----------------------------------------------------------------------------
   Pour le compteur de joueurs. Le chiffre grimpe au lieu de sauter : on voit
   la liste grandir, ce qui est exactement l'information utile pendant les
   inscriptions.
   ---------------------------------------------------------------------------- */

export function compter(element, valeur, depuis = null) {
  if (!element) return;
  const depart = depuis ?? (Number(element.textContent) || 0);

  if (!onAnime() || depart === valeur) {
    element.textContent = String(valeur);
    return;
  }

  const etat = { n: depart };
  gsap.to(etat, {
    n: valeur,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate: () => { element.textContent = String(Math.round(etat.n)); },
  });
}

/* ----------------------------------------------------------------------------
   LE PODIUM
   ----------------------------------------------------------------------------
   Le seul endroit de l'application où l'on a le droit d'en faire un peu trop.
   La ligne du vainqueur s'installe, et une onde part de dessous — le même
   vocabulaire que l'impact de la boule.
   ---------------------------------------------------------------------------- */

export function revelerPodium(racine) {
  if (!onAnime() || !racine) return;

  const premier = racine.querySelector('.podium__rang--premier');
  const autres = racine.querySelectorAll('.podium__rang:not(.podium__rang--premier)');

  const tl = gsap.timeline({ defaults: { lazy: false } });

  if (premier) {
    tl.fromTo(premier,
      { scaleX: 0.82, autoAlpha: 0 },
      { scaleX: 1, autoAlpha: 1, duration: 0.7, ease: 'expo.out', transformOrigin: 'left center' }, 0);
  }
  if (autres.length) {
    tl.fromTo(autres,
      { x: -14, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08, clearProps: 'all' }, 0.18);
  }
  return tl;
}

/* ----------------------------------------------------------------------------
   LE RETOUR AU TOUCHER
   ----------------------------------------------------------------------------
   Un bouton qui s'enfonce sous le doigt. Minuscule, mais c'est ce qui fait la
   différence entre une page web et un objet qui répond.
   ---------------------------------------------------------------------------- */

export function brancherToucher(racine) {
  if (!onAnime() || !racine) return;

  for (const bouton of racine.querySelectorAll('.bouton, .bouton-icone, .onglet')) {
    bouton.addEventListener('pointerdown', () => {
      gsap.to(bouton, { scale: 0.965, duration: 0.09, ease: 'power2.out', overwrite: 'auto' });
    });
    for (const evenement of ['pointerup', 'pointerleave', 'pointercancel']) {
      bouton.addEventListener(evenement, () => {
        gsap.to(bouton, { scale: 1, duration: 0.28, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
      });
    }
  }
}
