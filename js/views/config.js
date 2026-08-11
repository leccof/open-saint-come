/* ============================================================================
   views/config.js — configuration du tournoi.
   ----------------------------------------------------------------------------
   Nom, date, effectif annoncé. Tout reste modifiable TANT QUE LE TIRAGE N'EST
   PAS LANCÉ : le jour J, des joueurs arrivent et d'autres se désistent, il faut
   pouvoir corriger jusqu'à la dernière minute.
   ============================================================================ */

import { ajouter, h, titre, mention, chapo, filet, bouton } from './dom.js';
import { definirConfig, definirDate, definirPhase } from '../state.js';

let messageCopie = null;

/** L'adresse complète à partager (lien direct vers le tournoi). */
function lienPartage(code) {
  const base = location.origin + location.pathname;
  return `${base}#/t/${code}`;
}

export function rendre(ctx) {
  const etat = ctx.etat;
  const fige = etat.draw.status !== 'idle';
  const racine = h('div');

  ajouter(racine, 
    mention(etat.config.venue),
    titre('Configuration'),
    fige
      ? chapo('Le tirage est lancé : le nom et la date restent modifiables, mais plus l’effectif.')
      : chapo('Tout reste modifiable tant que le chapeau n’a pas commencé.')
  );

  /* ---- le code du tournoi ------------------------------------------------
     C'est l'information la plus importante de cet écran : c'est elle qu'on
     dicte aux autres pour qu'ils rejoignent. Elle est donc affichée en grand. */
  ajouter(racine, 
    h('section', { class: 'section' },
      h('p', { class: 'mention' }, 'Code du tournoi'),
      h('p', { class: 'code-geant' }, etat.code),
      h('p', { class: 'chapo' },
        'Dictez ces six caractères aux autres appareils, ou partagez le lien direct.'),
      h('div', { class: 'boutons' },
        bouton(messageCopie || 'Copier le lien de partage', {
          variante: 'bouton--pleine-largeur',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(lienPartage(etat.code));
              messageCopie = 'Lien copié';
            } catch {
              // Le presse-papiers est refusé hors HTTPS, ou par le navigateur.
              messageCopie = lienPartage(etat.code);
            }
            ctx.rafraichir();
            setTimeout(() => { messageCopie = null; ctx.rafraichir(); }, 2500);
          },
        })
      )
    ),
    filet()
  );

  /* ---- nom -------------------------------------------------------------- */
  ajouter(racine, 
    h('div', { class: 'champ-groupe' },
      h('label', { class: 'champ-libelle', for: 'nom-tournoi' }, 'Nom du tournoi'),
      h('input', {
        class: 'champ',
        id: 'nom-tournoi',
        type: 'text',
        value: etat.name || '',
        // On enregistre à la sortie du champ plutôt qu'à chaque frappe : sinon
        // l'écran se redessinerait sous les doigts et le curseur sauterait.
        onchange: (e) => ctx.majEtat({ ...ctx.etat, name: e.target.value.trim() || 'Tournoi' }),
      })
    )
  );

  /* ---- date ------------------------------------------------------------- */
  ajouter(racine, 
    h('div', { class: 'champ-groupe' },
      h('label', { class: 'champ-libelle', for: 'date-tournoi' }, 'Date'),
      h('input', {
        class: 'champ',
        id: 'date-tournoi',
        type: 'date',
        value: etat.date || '',
        onchange: (e) => ctx.majEtat(definirDate(ctx.etat, e.target.value)),
      })
    )
  );

  /* ---- terrain ---------------------------------------------------------- */
  ajouter(racine, 
    h('div', { class: 'champ-groupe' },
      h('label', { class: 'champ-libelle', for: 'terrain' }, 'Terrain'),
      h('input', {
        class: 'champ',
        id: 'terrain',
        type: 'text',
        value: etat.config.venue || '',
        onchange: (e) => ctx.majEtat(definirConfig(ctx.etat, { venue: e.target.value.trim() })),
      }),
      h('p', { class: 'champ-erreur' },
        'Il n’y a qu’un seul terrain : les matchs se jouent l’un après l’autre.')
    )
  );

  /* ---- effectif annoncé --------------------------------------------------
     Au doigt : deux gros boutons plutôt qu'un clavier numérique. */
  const annonce = etat.config.announcedPlayers || 0;

  function changerAnnonce(delta) {
    const valeur = Math.max(0, Math.min(200, annonce + delta));
    ctx.majEtat(definirConfig(ctx.etat, { announcedPlayers: valeur }));
  }

  ajouter(racine, 
    h('div', { class: 'champ-groupe' },
      h('label', { class: 'champ-libelle', for: 'annonce' }, 'Nombre de joueurs annoncé'),
      h('div', { class: 'saisie-ligne' },
        bouton('−', {
          'aria-label': 'Un joueur de moins',
          disabled: fige || annonce <= 0,
          onclick: () => changerAnnonce(-1),
        }),
        h('input', {
          class: 'champ centre',
          id: 'annonce',
          type: 'number',
          inputmode: 'numeric',
          min: '0',
          max: '200',
          value: String(annonce),
          disabled: fige,
          onchange: (e) => {
            const v = Math.max(0, Math.min(200, parseInt(e.target.value, 10) || 0));
            ctx.majEtat(definirConfig(ctx.etat, { announcedPlayers: v }));
          },
        }),
        bouton('+', {
          'aria-label': 'Un joueur de plus',
          disabled: fige,
          onclick: () => changerAnnonce(1),
        })
      ),
      h('p', { class: 'champ-erreur' },
        fige
          ? 'Figé depuis le lancement du tirage.'
          : 'Une simple prévision, pour vous repérer pendant les inscriptions.')
    )
  );

  /* ---- suite ------------------------------------------------------------ */
  ajouter(racine, 
    h('div', { class: 'boutons' },
      bouton('Passer aux joueurs', {
        variante: 'bouton--action bouton--pleine-largeur',
        onclick: () => {
          if (ctx.etat.phase === 'config') ctx.majEtat(definirPhase(ctx.etat, 'joueurs'));
          ctx.allerA(`#/t/${etat.code}/joueurs`);
        },
      })
    )
  );

  return racine;
}
