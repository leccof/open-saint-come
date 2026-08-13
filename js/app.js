/* ============================================================================
   app.js — le point d'entrée : navigation entre les écrans.
   ----------------------------------------------------------------------------
   Ce fichier ne contient AUCUNE logique de tournoi et AUCUN accès au réseau.
   Son travail :

     · lire l'adresse (#/t/ABC123/chapeau) et décider quel écran afficher ;
     · charger le tournoi correspondant via storage.js ;
     · garder l'indicateur de synchronisation à jour ;
     · redessiner l'écran quand l'état change.

   LA NAVIGATION PASSE PAR LE FRAGMENT D'URL (le # ). C'est une contrainte de
   GitHub Pages : le serveur ne sait servir que des fichiers existants. Avec des
   adresses classiques, /t/ABC123 renverrait une erreur 404. Ce qui suit le #
   n'est jamais envoyé au serveur, donc tout fonctionne, et le lien reste
   partageable et collable dans un QR code.
   ============================================================================ */

import * as storage from './storage.js';
import { h, remplir, titre, chapo } from './views/dom.js';
import * as vueAccueil from './views/accueil.js';
import * as vueConfig from './views/config.js';
import * as vueJoueurs from './views/joueurs.js';
import * as vueChapeau from './views/chapeau.js';
import * as vueTableaux from './views/tableaux.js';
import * as vueResultats from './views/resultats.js';
import * as vueRegles from './views/regles.js';
import { entreeEcran, brancherToucher } from './views/anim.js';

/* ----------------------------------------------------------------------------
   ÉLÉMENTS DE LA PAGE
   ---------------------------------------------------------------------------- */

const elContenu = document.getElementById('contenu');
const elStatut = document.getElementById('statut');
const elNav = document.getElementById('nav');
const elTitre = document.getElementById('bandeau-titre');
const elCode = document.getElementById('bandeau-code');

/* ----------------------------------------------------------------------------
   L'ÉTAT COURANT DE L'APPLICATION
   ----------------------------------------------------------------------------
   Une seule variable pour le tournoi ouvert. Toute modification passe par
   majEtat(), qui enregistre et redessine — jamais l'un sans l'autre.
   ---------------------------------------------------------------------------- */

let etat = null;              // le tournoi ouvert, ou null sur l'accueil
let route = { nom: 'accueil' };
let arreterVeille = null;     // pour cesser de surveiller le tournoi précédent

/**
 * Remplace l'état courant, l'enregistre et redessine l'écran.
 * C'est LE point de passage unique : si un écran modifie le tournoi sans
 * appeler cette fonction, la modification ne serait ni enregistrée ni affichée.
 */
export function majEtat(nouvelEtat, { enregistrer = true } = {}) {
  etat = enregistrer ? storage.saveTournament(nouvelEtat) : nouvelEtat;
  dessiner();
}

export function etatCourant() {
  return etat;
}

/* ----------------------------------------------------------------------------
   L'INDICATEUR DE SYNCHRONISATION
   ---------------------------------------------------------------------------- */

const LIBELLE_STATUT = {
  synchronise: 'Synchronisé',
  attente: 'En attente',
  horsligne: 'Hors ligne',
};

storage.onStatut((s) => {
  elStatut.className = `statut statut--${s}`;
  remplir(
    elStatut,
    h('span', { class: 'statut__pastille', 'aria-hidden': 'true' }),
    h('span', { class: 'statut__texte' }, LIBELLE_STATUT[s] || s)
  );
});

/* ----------------------------------------------------------------------------
   LECTURE DE L'ADRESSE
   ----------------------------------------------------------------------------
   Formes reconnues :
     #/                       l'accueil
     #/regles                 la page des règles, accessible de partout
     #/t/ABC123               un tournoi — on choisit l'écran selon son avancement
     #/t/ABC123/joueurs       une section précise
   ---------------------------------------------------------------------------- */

const SECTIONS = ['config', 'joueurs', 'chapeau', 'tableaux', 'resultats'];

function lireRoute() {
  const brut = (location.hash || '').replace(/^#/, '');
  const morceaux = brut.split('/').filter(Boolean);

  if (morceaux[0] === 'regles') return { nom: 'regles' };

  if (morceaux[0] === 't' && morceaux[1]) {
    const code = storage.normaliserCode(morceaux[1]);
    if (!code) return { nom: 'accueil' };
    const section = SECTIONS.includes(morceaux[2]) ? morceaux[2] : null;
    return { nom: 'tournoi', code, section };
  }

  return { nom: 'accueil' };
}

/** L'écran à proposer par défaut, selon l'avancement du tournoi. */
function sectionParDefaut(etatTournoi) {
  if (!etatTournoi) return 'config';
  switch (etatTournoi.phase) {
    case 'config': return 'config';
    case 'joueurs': return 'joueurs';
    case 'tirage': return 'chapeau';
    case 'tableaux': return 'tableaux';
    case 'termine': return 'resultats';
    default: return 'joueurs';
  }
}

export function allerA(chemin) {
  location.hash = chemin;
}

/* ----------------------------------------------------------------------------
   LA NAVIGATION DU BAS
   ---------------------------------------------------------------------------- */

const ENTREES_NAV = [
  { section: 'joueurs', libelle: 'Joueurs' },
  { section: 'chapeau', libelle: 'Chapeau' },
  { section: 'tableaux', libelle: 'Tableaux' },
  { section: 'resultats', libelle: 'Résultats' },
];

function dessinerNav() {
  const dansUnTournoi = route.nom === 'tournoi' && etat;
  elNav.hidden = !dansUnTournoi;
  document.body.classList.toggle('a-navigation', dansUnTournoi);
  if (!dansUnTournoi) return;

  remplir(
    elNav,
    ENTREES_NAV.map((e) =>
      h('a', {
        class: 'nav__lien',
        href: `#/t/${etat.code}/${e.section}`,
        'aria-current': route.section === e.section ? 'page' : null,
      }, e.libelle)
    ),
    h('a', {
      class: 'nav__lien',
      href: '#/regles',
      'aria-current': route.nom === 'regles' ? 'page' : null,
    }, 'Règles')
  );
}

/* ----------------------------------------------------------------------------
   LE BANDEAU
   ---------------------------------------------------------------------------- */

function dessinerBandeau() {
  if (route.nom === 'tournoi' && etat) {
    elTitre.textContent = etat.name || 'Tournoi';
    elCode.textContent = etat.code;
    elCode.hidden = false;
  } else {
    elTitre.textContent = 'Open de Saint-Côme';
    elCode.hidden = true;
  }
}

/* ----------------------------------------------------------------------------
   DESSIN DE L'ÉCRAN
   ----------------------------------------------------------------------------
   Les écrans arrivent aux étapes suivantes. Pour l'instant, chacun annonce
   simplement ce qu'il contiendra : la coquille, elle, est complète et
   navigable.
   ---------------------------------------------------------------------------- */

/**
 * Le contexte remis à chaque écran. C'est tout ce qu'une vue a le droit de
 * connaître du reste de l'application : l'état, comment le modifier, comment
 * naviguer, comment se redessiner.
 */
/* Vrai uniquement au premier dessin d'un écran donné. Les vues s'en servent
   pour ne jouer leur animation d'arrivée qu'une fois, et non à chaque frappe
   au clavier. */
let vuePrecedente = null;
let premierRendu = true;

function contexte() {
  return {
    etat,
    majEtat,
    allerA,
    premierRendu,
    /* rafraichir() redessine SANS enregistrer : pour les changements purement
       visuels (ouvrir un champ, afficher un message) qui n'ont rien à faire
       dans la base de données. */
    rafraichir: dessiner,
  };
}

/**
 * Dessine l'écran, en protégeant l'application d'un écran qui planterait.
 *
 * POURQUOI CE FILET. Sans lui, une erreur dans une vue interrompt le dessin
 * AVANT que le contenu ne soit remplacé : l'écran précédent reste affiché, et
 * rien n'indique que quoi que ce soit s'est mal passé. On croit à un problème
 * de réseau, on recharge, on recommence — et le vrai message d'erreur dort
 * dans la console.
 *
 * Un tournoi ne se met pas en pause pendant qu'on cherche. Mieux vaut un écran
 * qui dit « ça a planté, voici quoi faire » qu'un écran figé.
 */
function dessiner() {
  try {
    dessinerEcran();
  } catch (err) {
    console.error('[app] l’écran n’a pas pu être dessiné', err);
    remplir(elContenu,
      titre('Cet écran n’a pas pu s’afficher'),
      chapo('Le tournoi lui-même n’est pas perdu : il est enregistré sur cet appareil et sur le serveur.'),
      h('p', { class: 'ligne__secondaire' }, String(err && err.message ? err.message : err)),
      h('div', { class: 'boutons' },
        h('a', { class: 'bouton bouton--action bouton--pleine-largeur', href: '#/' },
          'Retour à l’accueil'),
        h('button', {
          class: 'bouton bouton--discret bouton--pleine-largeur',
          type: 'button',
          onclick: () => location.reload(),
        }, 'Recharger la page')));
  }
}

function dessinerEcran() {
  dessinerBandeau();
  dessinerNav();

  const cle = `${route.nom}/${route.section || ''}`;
  premierRendu = cle !== vuePrecedente;
  vuePrecedente = cle;

  if (route.nom === 'regles') {
    remplir(elContenu, vueRegles.rendre());
    apresRendu();
    return;
  }

  if (route.nom === 'accueil') {
    remplir(elContenu, vueAccueil.rendre(contexte()));
    apresRendu();
    return;
  }

  if (!etat) {
    remplir(elContenu,
      titre('Chargement…'),
      chapo('Recherche du tournoi ' + route.code + '.'));
    return;
  }

  const ctx = contexte();

  switch (route.section) {
    case 'config':    remplir(elContenu, vueConfig.rendre(ctx)); break;
    case 'joueurs':   remplir(elContenu, vueJoueurs.rendre(ctx)); break;
    case 'chapeau':   remplir(elContenu, vueChapeau.rendre(ctx)); break;
    case 'tableaux':  remplir(elContenu, vueTableaux.rendre(ctx)); break;
    case 'resultats': remplir(elContenu, vueResultats.rendre(ctx)); break;
    default:          remplir(elContenu, vueJoueurs.rendre(ctx));
  }
  apresRendu();
}

/**
 * Ce qui suit chaque dessin : l'écran se pose, et les boutons deviennent
 * sensibles au doigt.
 *
 * L'entrée en scène ne se joue qu'à l'ARRIVÉE sur un écran. Sans cette
 * condition, saisir un joueur relancerait toute l'animation à chaque lettre —
 * insupportable, et exactement le genre de détail qui fait qu'une app « fait
 * cheap ».
 */
function apresRendu() {
  if (premierRendu) entreeEcran(elContenu);
  brancherToucher(elContenu);
}

/* ----------------------------------------------------------------------------
   CHANGEMENT D'ADRESSE
   ---------------------------------------------------------------------------- */

async function surChangementDeRoute() {
  const nouvelle = lireRoute();

  // On quitte un tournoi : on cesse de le surveiller.
  if (arreterVeille && (nouvelle.nom !== 'tournoi' || nouvelle.code !== route.code)) {
    arreterVeille();
    arreterVeille = null;
  }

  const memeTournoi = nouvelle.nom === 'tournoi' && etat && etat.code === nouvelle.code;
  route = nouvelle;

  if (nouvelle.nom !== 'tournoi') {
    etat = null;
    dessiner();
    return;
  }

  if (!memeTournoi) {
    etat = null;
    dessiner();                                   // affiche « Chargement… »

    const charge = await storage.loadTournament(nouvelle.code);
    if (route.code !== nouvelle.code) return;     // l'utilisateur est déjà reparti

    if (!charge) {
      remplir(elContenu,
        titre('Tournoi introuvable'),
        chapo(`Aucun tournoi ne porte le code ${nouvelle.code}. Vérifiez les six caractères.`),
        h('div', { class: 'boutons' },
          h('a', { class: 'bouton bouton--action', href: '#/' }, 'Retour à l’accueil')));
      return;
    }

    etat = charge;

    // On surveille les modifications faites depuis un autre appareil.
    arreterVeille = storage.watchTournament(etat.code, (distant) => {
      etat = distant;
      dessiner();
    });
  }

  // Pas de section dans l'adresse : on propose celle qui correspond à
  // l'avancement, et on corrige l'adresse pour qu'elle reste partageable.
  if (!route.section) {
    const section = sectionParDefaut(etat);
    location.replace(`#/t/${etat.code}/${section}`);
    return;
  }

  dessiner();
}

/* ----------------------------------------------------------------------------
   DÉMARRAGE
   ---------------------------------------------------------------------------- */

window.addEventListener('hashchange', surChangementDeRoute);
surChangementDeRoute();
