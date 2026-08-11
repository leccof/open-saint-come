/* ============================================================================
   views/accueil.js — l'écran d'accueil.
   ----------------------------------------------------------------------------
   Trois choses, et rien d'autre :
     · créer un tournoi ;
     · en rejoindre un avec son code à 6 caractères ;
     · rouvrir un tournoi déjà ouvert sur cet appareil.
   ============================================================================ */

import { h, remplir, titre, mention, chapo, filet, bouton, dateLisible } from './dom.js';
import * as storage from '../storage.js';
import { creerEtatInitial } from '../state.js';
import { DEFAULT_TOURNAMENT_NAME } from '../../config.js';

/* État éphémère de l'écran : ce que la personne est en train de taper. */
let codeSaisi = '';
let message = null;
let occupe = false;

/**
 * La date par défaut : le prochain 15 août.
 * Si on prépare le tournoi en juillet, c'est le 15 août de cette année ; si on
 * s'y met en septembre, c'est celui de l'année suivante.
 */
function prochain15Aout() {
  const maintenant = new Date();
  const annee = maintenant.getMonth() > 7 || (maintenant.getMonth() === 7 && maintenant.getDate() > 15)
    ? maintenant.getFullYear() + 1
    : maintenant.getFullYear();
  return `${annee}-08-15`;
}

export function rendre(ctx) {
  const racine = h('div');

  /* ---- en-tête ---------------------------------------------------------- */
  racine.append(
    mention('Saint-Côme-d’Olt · Pétanque en doublette'),
    titre('Open de Saint-Côme'),
    chapo('Créez un tournoi, ou rejoignez-en un avec son code à six caractères.')
  );

  /* ---- créer ------------------------------------------------------------ */
  const boutonCreer = bouton(occupe ? 'Création…' : 'Créer un tournoi', {
    variante: 'bouton--action bouton--pleine-largeur',
    disabled: occupe,
    onclick: async () => {
      occupe = true;
      message = null;
      ctx.rafraichir();
      try {
        const etat = await storage.createTournament(
          DEFAULT_TOURNAMENT_NAME,
          creerEtatInitial({ date: prochain15Aout() })
        );
        occupe = false;
        codeSaisi = '';
        ctx.allerA(`#/t/${etat.code}/config`);
      } catch (err) {
        console.error(err);
        occupe = false;
        message = 'La création a échoué. Vérifiez la connexion et réessayez.';
        ctx.rafraichir();
      }
    },
  });

  racine.append(h('div', { class: 'boutons' }, boutonCreer));

  /* ---- rejoindre -------------------------------------------------------- */
  racine.append(filet());

  const champCode = h('input', {
    class: 'champ champ--code',
    type: 'text',
    id: 'code-tournoi',
    value: codeSaisi,
    maxlength: '6',
    // inputmode/autocapitalize : sur mobile, le clavier s'ouvre directement en
    // majuscules et la correction automatique ne vient pas saboter le code.
    autocapitalize: 'characters',
    autocorrect: 'off',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: '••••••',
    'aria-describedby': 'aide-code',
    oninput: (e) => {
      const propre = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      e.target.value = propre;
      codeSaisi = propre;
    },
    onkeydown: (e) => { if (e.key === 'Enter') rejoindre(); },
  });

  function rejoindre() {
    const code = storage.normaliserCode(codeSaisi);
    if (!code) {
      message = 'Un code de tournoi fait exactement six caractères.';
      ctx.rafraichir();
      return;
    }
    message = null;
    ctx.allerA(`#/t/${code}`);
  }

  racine.append(
    h('section', { class: 'section' },
      h('h2', { class: 'section__titre' }, 'Rejoindre un tournoi'),
      h('div', { class: 'champ-groupe' },
        h('label', { class: 'champ-libelle', for: 'code-tournoi' }, 'Code à six caractères'),
        champCode,
        h('p', { class: 'champ-erreur', id: 'aide-code' },
          message || 'Il est affiché en haut de l’écran sur l’appareil qui a créé le tournoi.')
      ),
      h('div', { class: 'boutons' },
        bouton('Ouvrir ce tournoi', {
          variante: 'bouton--pleine-largeur',
          onclick: rejoindre,
        })
      )
    )
  );

  /* ---- les tournois de cet appareil ------------------------------------- */
  const locaux = storage.listLocalTournaments();
  if (locaux.length) {
    racine.append(
      h('section', { class: 'section' },
        h('h2', { class: 'section__titre' }, 'Sur cet appareil'),
        h('ul', { class: 'liste' },
          locaux.map((t) =>
            h('li', { class: 'ligne' },
              h('a', {
                class: 'ligne__principal lien-nu',
                href: `#/t/${t.code}`,
              },
                h('span', {}, t.name || 'Tournoi'),
                h('span', { class: 'ligne__secondaire' },
                  ' — ' + t.code + (t.enAttente ? ' · non synchronisé' : ''))
              ),
              h('span', { class: 'ligne__secondaire' },
                t.updatedAt ? dateLisible(t.updatedAt.slice(0, 10)) : '')
            )
          )
        )
      )
    );
  }

  /* ---- règles ----------------------------------------------------------- */
  racine.append(
    filet(),
    h('div', { class: 'boutons' },
      h('a', { class: 'bouton bouton--discret bouton--pleine-largeur', href: '#/regles' },
        'Les règles de la pétanque'))
  );

  return racine;
}
