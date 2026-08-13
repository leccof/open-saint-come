/* ============================================================================
   views/chapeau.js — l'écran signature.
   ----------------------------------------------------------------------------
   Trente personnes autour d'une table, et un nom qui sort. L'écran doit être
   presque vide : un rouleau, un bouton, et le nom.

   L'ENCHAÎNEMENT, DANS L'ORDRE :
     1. On appuie sur « Tirer un nom ».
     2. Le nom est tiré IMMÉDIATEMENT, au sort cryptographique (draw.js).
     3. Seulement ensuite, le rouleau se met à tourner — décor pur, dont
        l'arrivée est déjà connue.
     4. Il ralentit selon une courbe de freinage et s'arrête net sur ce nom.
     5. L'état n'est enregistré qu'à cet instant : redessiner l'écran pendant
        l'animation la ferait disparaître.
   ============================================================================ */

import { ajouter, h, titre, mention, chapo, filet, bouton, vide } from './dom.js';
import { nomJoueur, nomEquipe, renommerEquipe, planEquipes } from '../state.js';
import {
  tirerUnNom, annulerDernierTirage, tirageTermine,
  manquePourCompleter, bandeDeNoms,
} from '../draw.js';
import { creerTableauPrincipal } from '../bracket.js';
import { creerPiste, secouer, claquer, vibrer } from './lancer.js';

/* État éphémère de l'écran. */
let enCoursDAnimation = false;
let equipeEnEdition = null;
let claqueEnAttente = false;   // le nom doit-il « claquer » au prochain dessin

/**
 * Le dernier nom sorti.
 *
 * On ne le mémorise PAS dans une variable de l'écran : il se déduit de l'ordre
 * de sortie, qui est enregistré. Une variable repartirait à zéro à chaque
 * rechargement de la page, et l'écran afficherait « appuyez pour faire sortir
 * le premier nom » au milieu d'un tirage déjà bien avancé.
 * C'est la règle du projet : ce qui se déduit ne se stocke pas.
 */
function dernierNomSorti(etat) {
  const ordre = etat.draw.order;
  return ordre.length ? ordre[ordre.length - 1] : null;
}

/** Durée du tirage, lue dans le thème pour rester au même endroit que le reste. */
function dureeTirage() {
  const brut = getComputedStyle(document.documentElement)
    .getPropertyValue('--sc-duree-tirage').trim();
  const ms = parseFloat(brut) || 0;
  return brut.endsWith('ms') ? ms : ms * 1000;
}

/* Le défilement des noms n'est plus piloté ici : il fait partie de la même
   timeline que le lancer de boule (views/lancer.js). C'est ce qui garantit que
   le freinage tombe exactement sur l'impact, sans deux horloges à accorder. */

export function rendre(ctx) {
  const etat = ctx.etat;
  const racine = h('div');
  const plan = planEquipes(etat);
  const restants = etat.draw.remaining.length;
  const termine = tirageTermine(etat);



  /* ======================================================================
     LA SCÈNE — le rouleau et sa légende
     ====================================================================== */

  /* Attention aux noms : « piste » désigne ici la bande de noms qui défile,
     « lanceur » la scène où roule la boule. Deux choses différentes. */
  const lanceur = creerPiste();

  const fenetre = h('div', { class: 'rouleau' });
  const piste = h('div', { class: 'rouleau__piste' });
  ajouter(fenetre, piste);

  const legende = h('p', { class: 'chapeau-scene__legende' });

  /* TROIS BANDES PLEINE LARGEUR, empilées : la piste sur fond sombre, le nom
     sur fond d'argile, puis la légende sur le crème. C'est cette alternance
     qui donne son rythme à l'écran — bien davantage qu'un cadre autour d'une
     colonne. */
  const scene = h('div', { class: 'bande bande--haut bande--sombre chapeau-scene' },
    h('p', { class: 'mention' }, etat.config.venue),
    h('h1', { class: 'titre-ecran' }, 'Le chapeau'),
    lanceur.element);

  const bandeNom = h('div', { class: 'bande bande--signal bande-nom' }, fenetre);

  /* Ce qu'on affiche à l'arrêt : le dernier nom sorti, ou une invitation. */
  function afficherRepos() {
    const dernierTire = dernierNomSorti(etat);
    piste.style.transform = 'translateY(0)';

    // Au repos, la boule est soit dans le cercle (rien n'a encore été tiré),
    // soit arrêtée contre le but (un nom vient de sortir).
    if (dernierTire) lanceur.placerALArrivee(); else lanceur.placerAuDepart();
    if (dernierTire) {
      fenetre.classList.add('rouleau--arrete');
      piste.replaceChildren(
        h('div', { class: 'rouleau__nom' }, nomJoueur(etat, dernierTire))
      );
    } else if (termine) {
      fenetre.classList.remove('rouleau--arrete');
      piste.replaceChildren(h('div', { class: 'rouleau__nom' }, '—'));
    } else {
      fenetre.classList.remove('rouleau--arrete');
      piste.replaceChildren(h('div', { class: 'rouleau__nom' }, '•  •  •'));
    }

    const manque = manquePourCompleter(etat);
    if (termine) {
      legende.replaceChildren(`${etat.teams.length} équipes formées.`);
    } else if (manque > 0 && dernierTire) {
      legende.replaceChildren(
        h('strong', {}, 'En attente de son coéquipier'),
        `Équipe ${etat.teams.length} · encore ${manque} joueur${manque > 1 ? 's' : ''}.`
      );
    } else if (dernierTire) {
      const equipe = etat.teams[etat.teams.length - 1];
      legende.replaceChildren(
        h('strong', {}, `Équipe ${etat.teams.length} au complet`),
        nomEquipe(etat, equipe)
      );
    } else {
      legende.replaceChildren('Appuyez pour faire sortir le premier nom.');
    }

    // Le nom vient de se verrouiller : on le fait claquer. La classe est posée
    // ici et non à la fin de l'animation, parce que l'enregistrement redessine
    // l'écran juste après et emporterait tout élément ajouté avant.
    if (claqueEnAttente) {
      claqueEnAttente = false;
      claquer(fenetre);
    }
  }

  afficherRepos();

  ajouter(racine, scene, bandeNom, legende,
    termine
      ? chapo('Toutes les équipes sont formées.')
      : chapo('Chaque nom tiré rejoint l’équipe en cours. Deux noms, une doublette.'));

  /* ======================================================================
     LE BOUTON
     ====================================================================== */

  if (!termine) {
    const boutonTirer = bouton(enCoursDAnimation ? '…' : 'Tirer un nom', {
      variante: 'bouton--geant',
      disabled: enCoursDAnimation || restants === 0,
      onclick: () => {
        if (enCoursDAnimation) return;

        // 1. Le sort est jeté ici, et nulle part ailleurs.
        const resultat = tirerUnNom(ctx.etat);
        if (!resultat.joueurId) return;

        const nomFinal = nomJoueur(ctx.etat, resultat.joueurId);

        // Mouvement réduit demandé par le système : on révèle sans animer.
        const sansAnimation =
          matchMedia('(prefers-reduced-motion: reduce)').matches || dureeTirage() === 0;

        if (sansAnimation) {
          ctx.majEtat(resultat.etat);
          return;
        }

        // 2. Le décor : une bande de noms qui se termine par le bon.
        const nomsRestants = ctx.etat.draw.remaining.map((id) => nomJoueur(ctx.etat, id));
        const bande = bandeDeNoms(nomsRestants, nomFinal);

        enCoursDAnimation = true;
        boutonTirer.disabled = true;
        boutonTirer.textContent = '…';
        fenetre.classList.remove('rouleau--arrete');
        legende.replaceChildren('');
        piste.replaceChildren(
          ...bande.map((n) => h('div', { class: 'rouleau__nom' }, n))
        );

        // 3. UNE SEULE timeline entraîne la boule ET les noms. La hauteur
        //    d'un cran est MESURÉE, jamais supposée : quelqu'un qui a agrandi
        //    le texte dans les réglages de son téléphone verrait sinon le
        //    rouleau s'immobiliser à cheval entre deux noms.
        const hauteurCran = fenetre.getBoundingClientRect().height;

        lanceur.jouer(dureeTirage(), {
          rouleau: piste,
          distance: (bande.length - 1) * hauteurCran,
          surImpact: () => { secouer(scene); vibrer(14); },
          surArret: () => {
            vibrer([0, 12, 45, 22]);
            enCoursDAnimation = false;
            claqueEnAttente = true;
            // L'enregistrement n'a lieu qu'ici : redessiner plus tôt aurait
            // effacé l'animation en cours.
            ctx.majEtat(resultat.etat);
          },
        });
      },
    });

    ajouter(racine, boutonTirer);
    ajouter(racine, 
      h('p', { class: 'chapeau-reste' },
        restants === 0
          ? 'Le chapeau est vide.'
          : `${restants} joueur${restants > 1 ? 's' : ''} encore dans le chapeau`)
    );
  }

  /* ---- annuler le dernier tirage ----------------------------------------
     Volontairement discret : un chapeau qu'on refait, c'est un chapeau qu'on
     conteste. Mais une fausse manip doit rester rattrapable. */
  if (etat.draw.order.length > 0 && !enCoursDAnimation) {
    ajouter(racine, 
      h('div', { class: 'boutons' },
        bouton('Annuler le dernier tirage', {
          variante: 'bouton--discret bouton--pleine-largeur',
          onclick: () => {
            const dernier = etat.draw.order[etat.draw.order.length - 1];
            if (!confirm(`Remettre ${nomJoueur(etat, dernier)} dans le chapeau ?`)) return;
            ctx.majEtat(annulerDernierTirage(ctx.etat));
          },
        })
      )
    );
  }

  /* ======================================================================
     LES ÉQUIPES FORMÉES
     ====================================================================== */

  ajouter(racine, filet());
  ajouter(racine, 
    h('div', { class: 'entre-deux' },
      h('h2', { class: 'section__titre' }, 'Les équipes'),
      plan ? h('span', { class: 'ligne__secondaire' }, `${etat.teams.length} / ${plan.nbEquipes}`) : null
    )
  );

  if (!etat.teams.length) {
    ajouter(racine, vide('Aucune équipe pour l’instant.'));
  } else {
    ajouter(racine, 
      h('div', { class: 'grille-2' },
        etat.teams.map((equipe, i) => {
          if (equipeEnEdition === equipe.id) {
            let brouillon = equipe.name || '';
            const champ = h('input', {
              class: 'champ',
              type: 'text',
              value: brouillon,
              placeholder: nomEquipe(etat, equipe),
              'aria-label': 'Nom de l’équipe',
              oninput: (e) => { brouillon = e.target.value; },
              onkeydown: (e) => {
                if (e.key === 'Enter') valider();
                if (e.key === 'Escape') { equipeEnEdition = null; ctx.rafraichir(); }
              },
            });
            const valider = () => {
              equipeEnEdition = null;
              ctx.majEtat(renommerEquipe(ctx.etat, equipe.id, brouillon));
            };
            queueMicrotask(() => { champ.focus(); champ.select(); });

            return h('li', { class: 'equipe-formee' },
              h('span', { class: 'equipe-formee__rang' }, String(i + 1)),
              h('div', { class: 'equipe-formee__nom' }, champ),
              bouton('OK', { variante: 'bouton--action', onclick: valider })
            );
          }

          return h('li', {
            class: 'equipe-formee' + (equipe.complete ? '' : ' equipe-formee--incomplete'),
          },
            h('span', { class: 'equipe-formee__rang' }, String(i + 1)),
            h('span', { class: 'equipe-formee__nom' },
              nomEquipe(etat, equipe),
              equipe.complete ? null : h('span', { class: 'ligne__secondaire' }, ' · en attente')
            ),
            h('button', {
              class: 'bouton-icone',
              type: 'button',
              'aria-label': `Renommer l’équipe ${i + 1}`,
              onclick: () => { equipeEnEdition = equipe.id; ctx.rafraichir(); },
            }, '✎')
          );
        })
      )
    );
  }

  /* ======================================================================
     LA SUITE
     ====================================================================== */

  if (termine) {
    ajouter(racine, 
      h('div', { class: 'boutons' },
        bouton('Créer les tableaux', {
          variante: 'bouton--action bouton--pleine-largeur',
          onclick: () => {
            if (ctx.etat.brackets.main) {
              ctx.allerA(`#/t/${ctx.etat.code}/tableaux`);
              return;
            }
            if (!confirm(
              `Créer le tableau avec ${ctx.etat.teams.length} équipes ?\n\n` +
              'Le placement et les exemptions seront tirés au sort.'
            )) return;
            ctx.majEtat(creerTableauPrincipal(ctx.etat));
            ctx.allerA(`#/t/${ctx.etat.code}/tableaux`);
          },
        })
      )
    );
  }

  return racine;
}
