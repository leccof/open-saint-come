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

import { ajouter, h, titre, mention, chapo, filet, bouton, vide } from './dom.js';
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
  ajouter(racine, 
    h('div', { class: 'entete' },
      h('span', { class: 'enorme' }, String(joueurs.length)),
      h('div', { class: 'entete__texte' },
        h('p', { class: 'mention' }, etat.config.venue),
        h('p', { class: 'entete__quoi' },
          joueurs.length > 1 ? 'joueurs inscrits' : 'joueur inscrit'),
        etat.config.announcedPlayers
          ? h('p', { class: 'ligne__secondaire' }, `sur ${etat.config.announcedPlayers} annoncés`)
          : null,
        plan
          ? h('p', { class: 'ligne__secondaire' }, plan.tailles.includes(3)
            ? `${plan.nbEquipes} équipes, dont une triplette`
            : `${plan.nbEquipes} doublettes`)
          : null
      )
    )
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
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterLeJoueur(); } },
    });

    /* Le nom de cette fonction ne doit PAS être « ajouter » : c'est déjà celui
       de l'utilitaire importé de dom.js, et une fonction locale masque
       l'import à l'intérieur de son bloc. Le code appelait alors cette
       fonction-ci en croyant remplir la page, ce qui redessinait l'écran en
       boucle jusqu'à épuisement de la pile — et l'écran ne s'affichait jamais. */
    function ajouterLeJoueur() {
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

    ajouter(racine, 
      h('div', { class: 'bande bande--sombre' },
        h('label', { class: 'champ-libelle', for: 'nouveau-joueur' }, 'Ajouter un joueur'),
        h('div', { class: 'saisie-ligne' },
          champ,
          bouton('Ajouter', { variante: 'bouton--action', onclick: ajouterLeJoueur })
        ),
        h('p', { class: 'champ-erreur' },
          erreur || 'Tapez un nom, appuyez sur Entrée, enchaînez.')
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
    ajouter(racine, 
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
    ajouter(racine, 
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
    ajouter(racine, 
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

  /* ---- la liste, sur deux colonnes ----------------------------------------
     Vingt joueurs se voient d'un seul coup d'œil au lieu de six. C'est la
     différence entre chercher un nom et le trouver. */
  if (!joueurs.length) {
    ajouter(racine, vide('Aucun joueur pour l’instant.'));
  } else {
    ajouter(racine,
      h('p', { class: 'mention mention--liste' },
        fige ? 'La liste est close' : 'Touchez un nom pour le corriger'),
      h('div', { class: 'grille-2' },
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

            // Pendant l'édition, le jeton prend les deux colonnes.
            return h('div', { class: 'saisie-ligne jeton--pleine' },
              champEdit,
              bouton('OK', { variante: 'bouton--action', onclick: valider })
            );
          }

          const enDouble = lesDoublons.some((d) => d.ids.includes(joueur.id));

          return h('div', { class: 'jeton' + (enDouble ? ' jeton--double' : '') },
            h('span', { class: 'jeton__rang' }, String(i + 1)),
            h('button', {
              class: 'jeton__nom jeton__bouton',
              type: 'button',
              'aria-label': `Modifier ${joueur.name}`,
              onclick: () => { idEnEdition = joueur.id; ctx.rafraichir(); },
            }, joueur.name),
            fige ? null : h('button', {
              class: 'jeton__action',
              type: 'button',
              'aria-label': `Retirer ${joueur.name}`,
              onclick: () => {
                if (confirm(`Retirer ${joueur.name} de la liste ?`)) {
                  ctx.majEtat(supprimerJoueur(ctx.etat, joueur.id));
                }
              },
            }, '✕')
          );
        })
      )
    );
  }

  /* ---- lancer le chapeau -------------------------------------------------- */
  if (!fige) {
    const pret = peutTirer(etat);
    ajouter(racine, 
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
    ajouter(racine, 
      h('p', { class: 'champ-erreur centre' },
        'Le tirage est lancé : la liste est close. Les noms restent corrigeables.'),
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
