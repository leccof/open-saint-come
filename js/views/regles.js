/* ============================================================================
   views/regles.js — la page des règles.
   ----------------------------------------------------------------------------
   Accessible de partout, y compris hors d'un tournoi. Elle sert à trancher une
   discussion au bord du terrain : il faut donc pouvoir sauter directement à la
   bonne section, sans faire défiler dix écrans.
   ============================================================================ */

import { ajouter, h, titre, mention, chapo, filet, bouton } from './dom.js';
import { INTRO, SECTIONS, LIEN_FFPJP } from '../rules-data.js';
import { VERSION_APP } from '../app.js';

export function rendre() {
  const racine = h('div');

  ajouter(racine, 
    h('div', { class: 'boutons' },
      bouton('‹ Retour', {
        variante: 'bouton--discret',
        onclick: () => {
          // On revient d'où l'on vient. S'il n'y a pas d'historique (page
          // ouverte directement par un lien), on retombe sur l'accueil.
          if (history.length > 1) history.back();
          else location.hash = '#/';
        },
      })),
    mention('Pétanque'),
    titre('Les règles'),
    chapo(INTRO)
  );

  /* ---- sommaire ----------------------------------------------------------
     ATTENTION, PIÈGE : toute la navigation de l'application passe par le # de
     l'adresse. Une ancre HTML ordinaire (href="#regle-terrain") modifierait
     donc l'adresse, le routeur croirait qu'on demande une autre page, et
     renverrait à l'accueil au lieu de faire défiler.

     On garde le href — pour le clic droit, l'ouverture dans un onglet et les
     lecteurs d'écran — mais on intercepte le clic et on fait défiler nous-mêmes,
     sans jamais toucher à l'adresse. */
  ajouter(racine, 
    h('nav', { class: 'sommaire', 'aria-label': 'Sommaire des règles' },
      h('ul', {},
        SECTIONS.map((s) =>
          h('li', {}, h('a', {
            class: 'sommaire__lien',
            href: `#regle-${s.id}`,
            onclick: (e) => {
              e.preventDefault();
              document.getElementById(`regle-${s.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
          }, s.titre))
        )
      )
    )
  );

  /* ---- les sections ------------------------------------------------------ */
  for (const section of SECTIONS) {
    const bloc = h('section', { class: 'section', id: `regle-${section.id}` },
      h('h2', { class: 'section__titre' }, section.titre));

    for (const p of section.paragraphes || []) {
      ajouter(bloc, h('p', { class: 'regle__texte' }, p));
    }

    if (section.points && section.points.length) {
      ajouter(bloc, 
        h('ul', { class: 'regle__points' },
          section.points.map((point) => h('li', { class: 'regle__point' }, point)))
      );
    }

    ajouter(racine, bloc, filet());
  }

  /* ---- le renvoi au texte officiel --------------------------------------- */
  ajouter(racine, 
    h('div', { class: 'encart' },
      h('p', { class: 'mention' }, 'Le texte qui fait foi'),
      h('p', {}, LIEN_FFPJP.note),
      h('div', { class: 'boutons' },
        h('a', {
          class: 'bouton bouton--action bouton--pleine-largeur',
          href: LIEN_FFPJP.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        }, LIEN_FFPJP.libelle)))
  );

  /* Le repère de version. Discret, mais c'est lui qui permet de dire « tu es
     sur une vieille copie, recharge » au lieu de chercher un bug qui n'existe
     pas. */
  ajouter(racine,
    h('p', { class: 'mention centre version-app' }, `Version ${VERSION_APP}`));

  return racine;
}
