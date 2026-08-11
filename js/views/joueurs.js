/* ============================================================================
   views/joueurs.js — la saisie des joueurs.
   ----------------------------------------------------------------------------
   L'écran le plus utilisé de la matinée. Deux exigences :

     · SAISIR VITE. Un nom, Entrée, un nom, Entrée. Le champ garde le focus,
       la liste s'allonge sous les yeux. Personne ne doit avoir à viser un
       bouton entre deux inscriptions.

     · NE RIEN LAISSER PASSER. Compteur en direct, doublons signalés, et une
       alerte franche quand l'effectif est impair — avec les trois issues
       possibles, présentées noir sur blanc.
   ============================================================================ */

import { h, titre, mention, chapo, filet, bouton, vide } from './dom.js';
import {
  ajouterJoueur, renommerJoueur, supprimerJoueur, doublons,
  planEquipes, peutTirer, problemeEffectif, definirTriplette, demarrerTirage,
} from '../state.js';

/* État éphémère : ce qui n'a pas à être enregistré. */
let saisie = '';
let idEnEdition = null;
let erreur = null;
let redonnerFocus = false;

export function rendre(ctx) {
  const etat = ctx.etat;
  const joueurs = etat.players;
  const fige = etat.draw.status !== 'idle';
  const racine = h('div');

  const lesDoublons = doublons(etat);
  const plan = planEquipes(etat);
  const souci = problemeEffectif(etat);

  /* ---- en-tête et compteur ---------------------------------------------- */
  racine.append(
    mention(etat.config.venue),
    titre('Les joueurs'),
    h('div', { class: 'entre-deux' },
      h('div', { class: 'compteur' },
        h('span', { class: 'compteur__nombre' }, String(joueurs.length)),
        h('span', { class: 'compteur__libelle' },
          joueurs.length > 1 ? 'joueurs inscrits' : 'joueur inscrit')
      ),
      etat.config.announcedPlayers
        ? h('span', { class: 'ligne__secondaire' }, `sur ${etat.config.announcedPlayers} annoncés`)
        : null
    ),
    plan
      ? chapo(plan.tailles.includes(3)
        ? `${plan.nbEquipes} équipes : ${plan.nbEquipes - 1} doublettes et une triplette.`
        : `${plan.nbEquipes} doublettes.`)
      : chapo('Ajoutez les joueurs au fur et à mesure des arrivées.')
  );

  /* ---- saisie ------------------------------------------------------------ */
  if (!fige) {
    const champ = h('input', {
      class: 'champ',
      id: 'nouveau-joueur',
      type: 'text',
      value: saisie,
      placeholder: 'Nom du joueur',
      autocapitalize: 'words',
      autocomplete: 'off',
      spellcheck: 'false',
      oninput: (e) => { saisie = e.target.value; },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } },
    });

    function ajouter() {
      const resultat = ajouterJoueur(ctx.etat, saisie);
      if (resultat.erreur) {
        erreur = resultat.erreur;
        ctx.rafraichir();
        return;
      }
      saisie = '';
      erreur = null;
      redonnerFocus = true;      // on rend la main au champ pour enchaîner
      ctx.majEtat(resultat.etat);
    }

    racine.append(
      h('div', { class: 'champ-groupe' },
        h('label', { class: 'champ-libelle', for: 'nouveau-joueur' }, 'Ajouter un joueur'),
        h('div', { class: 'saisie-ligne' },
          champ,
          bouton('Ajouter', { variante: 'bouton--action', onclick: ajouter })
        ),
        erreur ? h('p', { class: 'champ-erreur' }, erreur) : null
      )
    );

    // Le champ reprend le focus après un ajout, pour enchaîner les saisies.
    if (redonnerFocus) {
      redonnerFocus = false;
      queueMicrotask(() => { champ.focus(); });
    }
  }

  /* ---- doublons ----------------------------------------------------------
     Signalés, jamais bloqués : deux cousins peuvent réellement porter le même
     nom, et c'est à l'organisateur de trancher, pas à l'application. */
  if (lesDoublons.length) {
    racine.append(
      h('div', { class: 'encart' },
        h('p', { class: 'mention' }, 'Noms en double'),
        h('p', {},
          lesDoublons.map((d) => `${d.name} (${d.ids.length} fois)`).join(', ') +
          ' — ajoutez une initiale si ce sont bien deux personnes différentes.')
      )
    );
  }

  /* ---- effectif impair ---------------------------------------------------
     Les trois issues, explicitement. C'est le moment où l'organisateur a
     besoin qu'on lui pose la question clairement. */
  if (souci && souci.type === 'impair' && !fige) {
    racine.append(
      h('div', { class: 'encart encart--signal' },
        h('p', { class: 'section__titre' }, 'Effectif impair'),
        h('p', {}, `${joueurs.length} joueurs : il en manque un pour faire des doublettes. Trois solutions.`),
        h('div', { class: 'boutons' },
          bouton('Ajouter un joueur', {
            onclick: () => {
              redonnerFocus = true;
              ctx.rafraichir();
              document.getElementById('nouveau-joueur')?.focus();
            },
          }),
          bouton('Former une triplette', {
            variante: 'bouton--action',
            onclick: () => ctx.majEtat(definirTriplette(ctx.etat, true)),
          }),
          h('p', { class: 'ligne__secondaire' },
            'Ou retirez un joueur de la liste ci-dessous.')
        )
      )
    );
  }

  /* ---- triplette en vigueur ---------------------------------------------- */
  if (etat.config.triplette && joueurs.length % 2 === 1 && !fige) {
    racine.append(
      h('div', { class: 'encart' },
        h('p', {}, 'Une triplette est prévue : la dernière équipe formée comptera trois joueurs.'),
        h('div', { class: 'boutons' },
          bouton('Annuler la triplette', {
            variante: 'bouton--discret',
            onclick: () => ctx.majEtat(definirTriplette(ctx.etat, false)),
          })
        )
      )
    );
  }

  /* ---- la liste ---------------------------------------------------------- */
  racine.append(filet());

  if (!joueurs.length) {
    racine.append(vide('Aucun joueur pour l’instant.'));
  } else {
    racine.append(
      h('ul', { class: 'liste' },
        joueurs.map((joueur, i) => {
          if (idEnEdition === joueur.id) {
            let brouillon = joueur.name;
            const champEdit = h('input', {
              class: 'champ',
              type: 'text',
              value: joueur.name,
              'aria-label': 'Nouveau nom',
              oninput: (e) => { brouillon = e.target.value; },
              onkeydown: (e) => {
                if (e.key === 'Enter') valider();
                if (e.key === 'Escape') { idEnEdition = null; ctx.rafraichir(); }
              },
            });
            const valider = () => {
              idEnEdition = null;
              ctx.majEtat(renommerJoueur(ctx.etat, joueur.id, brouillon));
            };
            queueMicrotask(() => { champEdit.focus(); champEdit.select(); });

            return h('li', { class: 'ligne' },
              h('span', { class: 'ligne__numero' }, String(i + 1)),
              h('div', { class: 'ligne__principal' }, champEdit),
              h('div', { class: 'ligne__actions' },
                bouton('OK', { variante: 'bouton--action', onclick: valider })
              )
            );
          }

          const enDouble = lesDoublons.some((d) => d.ids.includes(joueur.id));

          return h('li', { class: 'ligne' },
            h('span', { class: 'ligne__numero' }, String(i + 1)),
            h('span', { class: 'ligne__principal' },
              joueur.name,
              enDouble ? h('span', { class: 'ligne__secondaire' }, ' · en double') : null
            ),
            fige ? null : h('div', { class: 'ligne__actions' },
              h('button', {
                class: 'bouton-icone',
                type: 'button',
                'aria-label': `Modifier ${joueur.name}`,
                onclick: () => { idEnEdition = joueur.id; ctx.rafraichir(); },
              }, '✎'),
              h('button', {
                class: 'bouton-icone',
                type: 'button',
                'aria-label': `Retirer ${joueur.name}`,
                onclick: () => {
                  if (confirm(`Retirer ${joueur.name} de la liste ?`)) {
                    ctx.majEtat(supprimerJoueur(ctx.etat, joueur.id));
                  }
                },
              }, '✕')
            )
          );
        })
      )
    );
  }

  /* ---- lancer le chapeau -------------------------------------------------- */
  if (!fige) {
    const pret = peutTirer(etat);
    racine.append(
      h('div', { class: 'boutons' },
        bouton('Lancer le chapeau', {
          variante: 'bouton--action bouton--pleine-largeur',
          disabled: !pret,
          onclick: () => {
            const n = ctx.etat.players.length;
            if (!confirm(
              `Lancer le tirage avec ${n} joueurs ?\n\n` +
              'La liste sera close : on ne pourra plus ajouter ni retirer personne.'
            )) return;
            ctx.majEtat(demarrerTirage(ctx.etat));
            ctx.allerA(`#/t/${ctx.etat.code}/chapeau`);
          },
        }),
        !pret && souci ? h('p', { class: 'champ-erreur centre' }, souci.message) : null
      )
    );
  } else {
    racine.append(
      h('div', { class: 'boutons' },
        h('a', {
          class: 'bouton bouton--action bouton--pleine-largeur',
          href: `#/t/${etat.code}/chapeau`,
        }, 'Aller au chapeau')
      )
    );
  }

  return racine;
}
