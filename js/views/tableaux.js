/* ============================================================================
   views/tableaux.js — les tableaux et la saisie des scores.
   ----------------------------------------------------------------------------
   DEUX PARTIS PRIS, ET ILS SE TIENNENT.

   1. UNE VUE TOUR PAR TOUR, PAS UNE ARBORESCENCE.
      Le bracket en arbre, celui qu'on voit dans les compétitions télévisées,
      devient illisible sur 380 px dès le deuxième tour : les cases rétrécissent
      jusqu'à ne plus contenir un nom. On affiche donc UN SEUL TOUR à la fois,
      en pleine largeur, avec des flèches pour circuler. On suit une équipe en
      avançant d'un tour, comme on tourne une page.

   2. AUCUN CLAVIER NUMÉRIQUE.
      Une manche s'arrête à 13, et le vainqueur EST à 13. Il ne reste donc que
      deux choses à saisir : qui a gagné, et combien l'autre avait. La seconde
      tient dans une grille de treize touches. Deux appuis par manche.
   ============================================================================ */

import { ajouter, h, titre, mention, chapo, bouton, vide } from './dom.js';
import { nomEquipe, definirMatchEnCours, definirPhase } from '../state.js';
import {
  matchsDuTour, nomDuTour, enregistrerManches, matchsAvalDejaJoues,
  resultatMatch, prochainMatch, consolantePrete, creerConsolante,
  consolanteObsolete, podium,
} from '../bracket.js';

/* ----------------------------------------------------------------------------
   ÉTAT ÉPHÉMÈRE DE L'ÉCRAN
   ---------------------------------------------------------------------------- */

let onglet = 'main';                  // 'main' | 'consolante'
const tourAffiche = {};               // prefixe → numéro de tour
let matchOuvert = null;               // identifiant du match en cours de saisie
let brouillon = [];                   // les manches en cours de saisie

/* ----------------------------------------------------------------------------
   CONVERSIONS ENTRE LE BROUILLON ET LES MANCHES ENREGISTRÉES
   ----------------------------------------------------------------------------
   Une manche enregistrée, c'est { a: 13, b: 7 }.
   Un brouillon, c'est { gagnant: 'A', perdant: 7 } — la forme dans laquelle on
   la saisit. Le vainqueur étant toujours à 13, les deux disent la même chose.
   ---------------------------------------------------------------------------- */

function brouillonDepuisManches(manches) {
  return (manches || []).map((m) => ({
    gagnant: m.a > m.b ? 'A' : 'B',
    perdant: Math.min(m.a, m.b),
  }));
}

function manchesDepuisBrouillon(liste, points = 13) {
  return liste
    .filter((d) => d.gagnant && d.perdant != null)
    .map((d) => (d.gagnant === 'A'
      ? { a: points, b: d.perdant }
      : { a: d.perdant, b: points }));
}

/** Compte les manches gagnées de chaque côté dans le brouillon. */
function compterManches(liste) {
  let a = 0, b = 0;
  for (const d of liste) {
    if (!d.gagnant || d.perdant == null) continue;
    if (d.gagnant === 'A') a++; else b++;
  }
  return { a, b };
}

/**
 * Les manches à afficher : celles déjà saisies, plus la suivante si le match
 * n'est pas encore décidé. Dès qu'une équipe a ses deux manches, la troisième
 * disparaît — elle n'aura pas lieu.
 */
function manchesAAfficher(liste, aGagner) {
  const gardees = [];
  let a = 0, b = 0;

  for (const d of liste) {
    gardees.push(d);
    if (d.gagnant && d.perdant != null) {
      if (d.gagnant === 'A') a++; else b++;
    }
    if (a >= aGagner || b >= aGagner) return gardees;   // match clos
  }

  // Pas encore décidé : on ouvre la manche suivante — mais SEULEMENT si celle
  // en cours est complète. Sinon on afficherait deux manches à saisir en même
  // temps, et on saisirait la mauvaise.
  const derniere = gardees[gardees.length - 1];
  const enCoursDeSaisie = derniere && !(derniere.gagnant && derniere.perdant != null);
  if (!enCoursDeSaisie && gardees.length < aGagner * 2 - 1) {
    gardees.push({ gagnant: null, perdant: null });
  }
  return gardees;
}

function ouvrirMatch(match) {
  matchOuvert = match.id;
  brouillon = brouillonDepuisManches(match.sets);
}

function fermerMatch() {
  matchOuvert = null;
  brouillon = [];
}

/* ----------------------------------------------------------------------------
   LE PANNEAU DE SAISIE
   ---------------------------------------------------------------------------- */

function panneauSaisie(ctx, match) {
  const etat = ctx.etat;
  const aGagner = etat.config.setsToWin ?? 2;
  const points = etat.config.pointsPerSet ?? 13;
  const nomA = nomEquipe(etat, match.teamA);
  const nomB = nomEquipe(etat, match.teamB);

  const affichees = manchesAAfficher(brouillon, aGagner);
  const bloc = h('div', { class: 'saisie-match' });

  affichees.forEach((d, i) => {
    const complete = d.gagnant && d.perdant != null;

    /* ---- manche déjà saisie : repliée sur une ligne, modifiable ---------- */
    if (complete) {
      const scoreA = d.gagnant === 'A' ? points : d.perdant;
      const scoreB = d.gagnant === 'B' ? points : d.perdant;
      ajouter(bloc, 
        h('div', { class: 'manche manche--repliee' },
          h('span', { class: 'manche__resume' },
            h('span', { class: 'manche__titre' }, `Manche ${i + 1} `),
            h('b', {}, `${scoreA} — ${scoreB}`)),
          bouton('Corriger', {
            variante: 'bouton--discret',
            onclick: () => {
              // On rouvre cette manche et on efface les suivantes : elles
              // dépendaient de son résultat.
              brouillon = brouillon.slice(0, i);
              brouillon.push({ gagnant: null, perdant: null });
              ctx.rafraichir();
            },
          })
        )
      );
      return;
    }

    /* ---- manche en cours de saisie -------------------------------------- */
    const manche = h('div', { class: 'manche' },
      h('p', { class: 'manche__titre' }, `Manche ${i + 1}`));

    if (!d.gagnant) {
      // Étape 1 : qui a gagné la manche ?
      ajouter(manche, 
        h('p', { class: 'manche__question' }, 'Qui a gagné cette manche ?'),
        h('div', { class: 'boutons' },
          bouton(nomA, {
            variante: 'bouton--pleine-largeur',
            onclick: () => { d.gagnant = 'A'; brouillon = [...affichees]; ctx.rafraichir(); },
          }),
          bouton(nomB, {
            variante: 'bouton--pleine-largeur',
            onclick: () => { d.gagnant = 'B'; brouillon = [...affichees]; ctx.rafraichir(); },
          })
        )
      );
    } else {
      // Étape 2 : combien avait le perdant ? Le gagnant est à 13 par définition.
      const nomPerdant = d.gagnant === 'A' ? nomB : nomA;
      const nomGagnant = d.gagnant === 'A' ? nomA : nomB;

      ajouter(manche, 
        h('p', { class: 'manche__question' },
          h('strong', {}, nomGagnant), ` est à ${points}. Combien pour ${nomPerdant} ?`),
        h('div', { class: 'grille-scores' },
          Array.from({ length: points }, (_, n) =>
            bouton(String(n), {
              onclick: () => { d.perdant = n; brouillon = [...affichees]; ctx.rafraichir(); },
            })
          )
        ),
        h('div', { class: 'boutons' },
          bouton('Changer de vainqueur', {
            variante: 'bouton--discret',
            onclick: () => { d.gagnant = null; brouillon = [...affichees]; ctx.rafraichir(); },
          })
        )
      );
    }

    ajouter(bloc, manche);
  });

  /* ---- validation --------------------------------------------------------- */
  const compte = compterManches(affichees);
  const decide = compte.a >= aGagner || compte.b >= aGagner;
  const manches = manchesDepuisBrouillon(affichees, points);

  ajouter(bloc, 
    h('div', { class: 'boutons' },
      bouton(decide ? 'Enregistrer le résultat' : 'Enregistrer les manches saisies', {
        variante: 'bouton--action bouton--pleine-largeur',
        disabled: manches.length === 0,
        onclick: () => enregistrer(ctx, match, manches),
      }),
      bouton('Fermer', {
        variante: 'bouton--discret bouton--pleine-largeur',
        onclick: () => { fermerMatch(); ctx.rafraichir(); },
      })
    )
  );

  return bloc;
}

/**
 * Enregistre, en prévenant AVANT si la correction va effacer des matchs déjà
 * joués. Le recalcul en cascade est automatique, mais il ne doit jamais être
 * silencieux : quelqu'un a saisi ces scores, il a le droit de savoir.
 */
function enregistrer(ctx, match, manches) {
  const aval = matchsAvalDejaJoues(ctx.etat, match.id);

  if (aval.length) {
    const liste = aval.map((m) => `· ${nomDuTour(ctx.etat.brackets[m.bracket].tours, m.round)}`).join('\n');
    if (!confirm(
      `Ce changement remet en jeu ${aval.length} match${aval.length > 1 ? 's' : ''} déjà joué${aval.length > 1 ? 's' : ''} :\n${liste}\n\n` +
      'Leurs scores seront effacés. Confirmer ?'
    )) return;
  }

  let suivant = enregistrerManches(ctx.etat, match.id, manches);

  // La consolante peut ne plus correspondre aux résultats du principal.
  if (consolanteObsolete(suivant)) {
    if (confirm(
      'La consolante ne correspond plus aux résultats du tableau principal.\n\n' +
      'La refaire ? Les matchs de consolante déjà joués seront perdus.'
    )) {
      suivant = creerConsolante(suivant);
    }
  }

  fermerMatch();
  ctx.majEtat(suivant);
}

/* ----------------------------------------------------------------------------
   L'AFFICHAGE D'UN MATCH
   ---------------------------------------------------------------------------- */

function carteMatch(ctx, match, numero) {
  const etat = ctx.etat;
  const aGagner = etat.config.setsToWin ?? 2;
  const r = resultatMatch(match.sets, etat.config);
  const surLeTerrain = etat.currentMatchId === match.id;

  const cadre = h('div', {
    class: 'cadre' + (match.status === 'bye' ? ' cadre--bye' : ''),
  });

  const etiquette =
    match.status === 'bye' ? 'Exempte'
      : match.status === 'termine' ? 'Terminé'
        : match.status === 'pret' ? (surLeTerrain ? 'Sur le terrain' : 'À jouer')
          : 'En attente';

  ajouter(cadre, 
    h('div', { class: 'cadre__entete' },
      h('span', {}, `Match ${numero}`),
      h('span', {}, etiquette))
  );

  const ligneEquipe = (idEquipe, cote) => {
    const gagnante = match.winner && match.winner === idEquipe;
    const manches = cote === 'A' ? r.manchesA : r.manchesB;
    return h('div', {
      class: 'equipe'
        + (gagnante ? ' equipe--gagnante' : '')
        + (idEquipe ? '' : ' equipe--attente'),
    },
      h('span', { class: 'equipe__nom' }, idEquipe ? nomEquipe(etat, idEquipe) : 'En attente'),
      match.sets.length
        ? h('span', { class: 'equipe__score' },
          match.sets.map((m) => (cote === 'A' ? m.a : m.b)).join(' · ') + `  (${manches})`)
        : null
    );
  };

  ajouter(cadre, ligneEquipe(match.teamA, 'A'));
  if (match.status === 'bye') {
    ajouter(cadre, h('div', { class: 'equipe equipe--attente' },
      h('span', { class: 'equipe__nom' }, 'Exemptée — passe au tour suivant')));
  } else {
    ajouter(cadre, ligneEquipe(match.teamB, 'B'));
  }

  /* ---- actions ------------------------------------------------------------ */
  if (matchOuvert === match.id) {
    ajouter(cadre, panneauSaisie(ctx, match));
  } else if (match.status === 'pret' || match.status === 'termine') {
    const actions = h('div', { class: 'saisie-match' },
      h('div', { class: 'boutons boutons--cote-a-cote' },
        bouton(match.status === 'termine' ? 'Corriger le score' : 'Saisir le score', {
          variante: match.status === 'termine' ? '' : 'bouton--action',
          onclick: () => { ouvrirMatch(match); ctx.rafraichir(); },
        }),
        match.status === 'pret'
          ? bouton(surLeTerrain ? 'Retirer du terrain' : 'Sur le terrain', {
            variante: 'bouton--discret',
            onclick: () => ctx.majEtat(
              definirMatchEnCours(ctx.etat, surLeTerrain ? null : match.id)),
          })
          : null
      ));
    ajouter(cadre, actions);
  }

  return cadre;
}

/* ----------------------------------------------------------------------------
   L'ÉCRAN
   ---------------------------------------------------------------------------- */

export function rendre(ctx) {
  const etat = ctx.etat;
  const racine = h('div');

  ajouter(racine, mention(etat.config.venue), titre('Les tableaux'));

  /* ---- pas encore de tableau --------------------------------------------- */
  if (!etat.brackets.main) {
    ajouter(racine, 
      chapo('Le tableau se crée à la fin du chapeau, quand toutes les équipes sont formées.'),
      h('div', { class: 'boutons' },
        h('a', { class: 'bouton bouton--action bouton--pleine-largeur', href: `#/t/${etat.code}/chapeau` },
          'Aller au chapeau'))
    );
    return racine;
  }

  /* ---- le terrain --------------------------------------------------------- */
  const aJouer = prochainMatch(etat);
  if (aJouer) {
    ajouter(racine, 
      h('div', { class: 'terrain' },
        h('p', { class: 'terrain__libelle' },
          etat.currentMatchId === aJouer.id ? 'En cours sur le terrain' : 'Prochain match'),
        h('p', { class: 'terrain__match' },
          `${nomEquipe(etat, aJouer.teamA)} contre ${nomEquipe(etat, aJouer.teamB)}`),
        h('p', { class: 'ligne__secondaire' },
          `${aJouer.bracket === 'main' ? 'Principal' : 'Consolante'} · ` +
          nomDuTour(etat.brackets[aJouer.bracket].tours, aJouer.round))
      )
    );
  }

  /* ---- onglets ------------------------------------------------------------ */
  const consolanteExiste = !!etat.brackets.consolante;
  ajouter(racine, 
    h('div', { class: 'onglets', role: 'tablist' },
      h('button', {
        class: 'onglet', type: 'button', role: 'tab',
        'aria-selected': onglet === 'main' ? 'true' : 'false',
        onclick: () => { onglet = 'main'; fermerMatch(); ctx.rafraichir(); },
      }, 'Principal'),
      h('button', {
        class: 'onglet', type: 'button', role: 'tab',
        'aria-selected': onglet === 'consolante' ? 'true' : 'false',
        onclick: () => { onglet = 'consolante'; fermerMatch(); ctx.rafraichir(); },
      }, 'Consolante')
    )
  );

  /* ---- la consolante n'existe pas encore ---------------------------------- */
  if (onglet === 'consolante' && !consolanteExiste) {
    const prete = consolantePrete(etat);
    ajouter(racine, 
      chapo(prete
        ? 'Les équipes de la consolante sont connues.'
        : 'La consolante accueille toute équipe qui perd son premier match joué. ' +
          'Elle se crée dès que toutes les équipes ont joué une fois.'),
      prete
        ? h('div', { class: 'boutons' },
          bouton('Créer la consolante', {
            variante: 'bouton--action bouton--pleine-largeur',
            onclick: () => ctx.majEtat(creerConsolante(ctx.etat)),
          }))
        : null
    );
    return racine;
  }

  const prefixe = onglet;
  const tableau = etat.brackets[prefixe];

  /* ---- consolante devenue incohérente ------------------------------------- */
  if (prefixe === 'consolante' && consolanteObsolete(etat)) {
    ajouter(racine, 
      h('div', { class: 'encart encart--signal' },
        h('p', { class: 'section__titre' }, 'Consolante à refaire'),
        h('p', {}, 'Un score du tableau principal a changé : les équipes inscrites ici ne sont plus les bonnes.'),
        h('div', { class: 'boutons' },
          bouton('Refaire la consolante', {
            variante: 'bouton--action',
            onclick: () => {
              if (!confirm('Refaire la consolante ? Les matchs déjà joués ici seront perdus.')) return;
              ctx.majEtat(creerConsolante(ctx.etat));
            },
          })))
    );
  }

  /* ---- navigation entre les tours ------------------------------------------ */
  if (tourAffiche[prefixe] == null || tourAffiche[prefixe] > tableau.tours) {
    // Par défaut, on ouvre le premier tour où il reste quelque chose à jouer.
    let defaut = tableau.tours;
    for (let r = 1; r <= tableau.tours; r++) {
      const reste = matchsDuTour(etat, prefixe, r)
        .some((m) => m.status === 'pret' || m.status === 'attente');
      if (reste) { defaut = r; break; }
    }
    tourAffiche[prefixe] = defaut;
  }

  const tour = tourAffiche[prefixe];

  ajouter(racine, 
    h('div', { class: 'tours' },
      h('button', {
        class: 'tours__fleche', type: 'button', 'aria-label': 'Tour précédent',
        disabled: tour <= 1,
        onclick: () => { tourAffiche[prefixe] = tour - 1; fermerMatch(); ctx.rafraichir(); },
      }, '‹'),
      h('span', { class: 'tours__nom' }, nomDuTour(tableau.tours, tour)),
      h('button', {
        class: 'tours__fleche', type: 'button', 'aria-label': 'Tour suivant',
        disabled: tour >= tableau.tours,
        onclick: () => { tourAffiche[prefixe] = tour + 1; fermerMatch(); ctx.rafraichir(); },
      }, '›')
    ),
    h('p', { class: 'mention centre' }, `Tour ${tour} sur ${tableau.tours}`)
  );

  /* ---- les matchs du tour --------------------------------------------------- */
  const matchs = matchsDuTour(etat, prefixe, tour);
  if (!matchs.length) {
    ajouter(racine, vide('Aucun match à ce tour.'));
  } else {
    ajouter(racine, 
      h('div', { style: { marginTop: 'var(--sc-e-4)' } },
        matchs.map((m, i) => carteMatch(ctx, m, i + 1)))
    );
  }

  /* ---- fin du tournoi -------------------------------------------------------- */
  const podiumPrincipal = podium(etat, 'main');
  if (podiumPrincipal && etat.phase !== 'termine') {
    ajouter(racine, 
      h('div', { class: 'boutons' },
        bouton('Voir les résultats', {
          variante: 'bouton--action bouton--pleine-largeur',
          onclick: () => {
            ctx.majEtat(definirPhase(ctx.etat, 'termine'));
            ctx.allerA(`#/t/${etat.code}/resultats`);
          },
        }))
    );
  }

  return racine;
}
