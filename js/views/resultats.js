/* ============================================================================
   views/resultats.js — podiums, récapitulatif, export.
   ----------------------------------------------------------------------------
   L'écran de fin de journée. Il sert à trois choses, dans cet ordre :
     · annoncer les vainqueurs ;
     · retrouver le détail d'un match dont quelqu'un conteste le score ;
     · emporter une copie de tout, en JSON, au cas où.
   ============================================================================ */

import { ajouter, h, titre, mention, chapo, filet, bouton, vide, dateLisible } from './dom.js';
import { nomEquipe } from '../state.js';
import {
  podium, tousLesMatchsJoues, nomDuTour, matchsDuTour, resultatMatch,
} from '../bracket.js';
import { exportTournament } from '../storage.js';

/** Un podium, ou l'explication de son absence. */
function blocPodium(etat, prefixe, libelle) {
  const tableau = etat.brackets[prefixe];
  const bloc = h('section', { class: 'section' },
    h('h2', { class: 'section__titre' }, libelle));

  if (!tableau) {
    ajouter(bloc, h('p', { class: 'vide' },
      prefixe === 'consolante'
        ? 'La consolante n’a pas eu lieu.'
        : 'Le tableau n’a pas encore été créé.'));
    return bloc;
  }

  const p = podium(etat, prefixe);
  if (!p) {
    const restants = [];
    for (let r = 1; r <= tableau.tours; r++) {
      for (const m of matchsDuTour(etat, prefixe, r)) {
        if (m.status === 'pret') restants.push(m);
      }
    }
    ajouter(bloc, h('p', { class: 'vide' },
      `Pas encore terminé — ${restants.length} match${restants.length > 1 ? 's' : ''} à jouer.`));
    return bloc;
  }

  ajouter(bloc, 
    h('ol', { class: 'podium' },
      h('li', { class: 'podium__rang podium__rang--premier' },
        h('span', { class: 'podium__place' }, '1'),
        h('span', { class: 'podium__equipe' }, nomEquipe(etat, p.premier))),
      h('li', { class: 'podium__rang' },
        h('span', { class: 'podium__place' }, '2'),
        h('span', { class: 'podium__equipe' }, nomEquipe(etat, p.deuxieme))),
      p.demiFinalistes.map((id) =>
        h('li', { class: 'podium__rang' },
          h('span', { class: 'podium__place' }, '½'),
          h('span', { class: 'podium__equipe' }, nomEquipe(etat, id))))
    ),
    p.demiFinalistes.length
      ? h('p', { class: 'ligne__secondaire' },
        'Il n’y a pas de match pour la troisième place : les deux équipes sorties en demi-finale sont à égalité.')
      : null
  );

  return bloc;
}

export function rendre(ctx) {
  const etat = ctx.etat;
  const racine = h('div');

  ajouter(racine, 
    mention(`${etat.config.venue}${etat.date ? ' · ' + dateLisible(etat.date) : ''}`),
    titre('Résultats')
  );

  if (!etat.brackets.main) {
    ajouter(racine, 
      chapo('Rien à afficher tant que le tournoi n’a pas commencé.'),
      h('div', { class: 'boutons' },
        h('a', { class: 'bouton bouton--action bouton--pleine-largeur', href: `#/t/${etat.code}/chapeau` },
          'Aller au chapeau'))
    );
    return racine;
  }

  /* ---- les deux podiums --------------------------------------------------- */
  ajouter(racine, 
    blocPodium(etat, 'main', 'Tableau principal'),
    blocPodium(etat, 'consolante', 'Consolante'),
    filet()
  );

  /* ---- le récapitulatif ---------------------------------------------------- */
  const matchs = tousLesMatchsJoues(etat);
  ajouter(racine, 
    h('section', { class: 'section' },
      h('div', { class: 'entre-deux' },
        h('h2', { class: 'section__titre' }, 'Tous les matchs'),
        h('span', { class: 'ligne__secondaire' }, `${matchs.length} joué${matchs.length > 1 ? 's' : ''}`))
    )
  );

  if (!matchs.length) {
    ajouter(racine, vide('Aucun match terminé pour l’instant.'));
  } else {
    ajouter(racine, 
      h('ul', { class: 'liste' },
        matchs.map((m) => {
          const r = resultatMatch(m.sets, etat.config);
          const tableau = etat.brackets[m.bracket];
          const gagnantEstA = m.winner === m.teamA;
          return h('li', { class: 'recap' },
            h('p', { class: 'recap__tour' },
              `${m.bracket === 'main' ? 'Principal' : 'Consolante'} · ${nomDuTour(tableau.tours, m.round)}`),
            h('p', { class: 'recap__equipes' },
              h('strong', {}, nomEquipe(etat, gagnantEstA ? m.teamA : m.teamB)),
              ' bat ',
              nomEquipe(etat, gagnantEstA ? m.teamB : m.teamA)),
            h('p', { class: 'recap__manches' },
              `${r.manchesA}–${r.manchesB} · ` +
              m.sets.map((s) => `${s.a}-${s.b}`).join('  |  '))
          );
        })
      )
    );
  }

  /* ---- l'export ------------------------------------------------------------
     Le filet de sécurité. Si Supabase est indisponible le jour J, ce fichier
     contient tout : joueurs, équipes, tableaux, scores. */
  ajouter(racine, 
    filet(),
    h('div', { class: 'encart' },
      h('p', { class: 'mention' }, 'Filet de sécurité'),
      h('p', {}, 'Téléchargez tout le tournoi dans un fichier. Faites-le en fin de journée : ' +
        'il contient les joueurs, les équipes, les tableaux et tous les scores.'),
      h('div', { class: 'boutons' },
        bouton('Télécharger le tournoi (JSON)', {
          variante: 'bouton--action bouton--pleine-largeur',
          onclick: () => exportTournament(ctx.etat),
        })))
  );

  return racine;
}
