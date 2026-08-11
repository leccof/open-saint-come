/* ============================================================================
   draw.js — le chapeau.
   ----------------------------------------------------------------------------
   Les joueurs sortent un par un. Deux noms consécutifs forment une équipe.

   DEUX PRINCIPES, et ils ne sont pas décoratifs :

     1. LE HASARD EST CRYPTOGRAPHIQUE. On tire avec crypto.getRandomValues et
        un rejet des valeurs biaisées, jamais avec Math.random(). Sur un tirage
        public, dont dépendent les équipes de toute une journée, le résultat
        doit être incontestable. (Math.random() sert malgré tout dans cet écran,
        mais uniquement pour faire défiler des noms à l'image : ce défilement
        est un décor, le nom qui sortira est décidé avant qu'il ne commence.)

     2. LES ÉQUIPES SE RECALCULENT À PARTIR DE L'ORDRE DE SORTIE. On ne les
        construit pas au fur et à mesure. L'ordre des noms tirés est la seule
        vérité ; les équipes s'en déduisent. C'est ce qui rend « annuler le
        dernier tirage » aussi simple qu'un retrait en fin de liste, sans
        risque de laisser une équipe à moitié défaite derrière soi.
   ============================================================================ */

import { clonerEtat, idCourt, planEquipes } from './state.js';
import { entierAleatoire } from './bracket.js';

/* ----------------------------------------------------------------------------
   COMPOSITION DES ÉQUIPES À PARTIR DE L'ORDRE
   ---------------------------------------------------------------------------- */

/**
 * Reconstruit les équipes d'après l'ordre de sortie des noms.
 *
 * Les équipes déjà existantes gardent leur identifiant et leur nom
 * personnalisé : seule la composition est recalculée. Sans cela, renommer une
 * équipe puis tirer un nom de plus effacerait le nom saisi.
 */
export function recomposerEquipes(etat) {
  const plan = planEquipes(etat);
  if (!plan) return [];

  const ordre = etat.draw.order;
  const equipes = [];
  let curseur = 0;

  for (let i = 0; i < plan.nbEquipes; i++) {
    const taille = plan.tailles[i];
    const membres = ordre.slice(curseur, curseur + taille);
    curseur += taille;

    if (membres.length === 0) break;          // cette équipe n'a pas commencé

    const ancienne = etat.teams[i];
    equipes.push({
      id: ancienne ? ancienne.id : idCourt('t'),
      players: membres,
      name: ancienne ? ancienne.name : null,
      complete: membres.length === taille,
    });
  }

  return equipes;
}

/** Le joueur qui vient de sortir et attend encore son coéquipier, ou null. */
export function joueurEnAttente(etat) {
  const derniere = etat.teams[etat.teams.length - 1];
  if (!derniere || derniere.complete) return null;
  return derniere.players[derniere.players.length - 1];
}

/** Combien de joueurs il manque encore à l'équipe en cours de formation. */
export function manquePourCompleter(etat) {
  const plan = planEquipes(etat);
  if (!plan) return 0;
  const derniere = etat.teams[etat.teams.length - 1];
  if (!derniere || derniere.complete) return 0;
  return plan.tailles[etat.teams.length - 1] - derniere.players.length;
}

/* ----------------------------------------------------------------------------
   TIRER
   ---------------------------------------------------------------------------- */

/**
 * Tire un nom au hasard parmi ceux qui restent dans le chapeau.
 * Renvoie { etat, joueurId } — joueurId vaut null si le chapeau est vide.
 */
export function tirerUnNom(etat) {
  const restants = etat.draw.remaining;
  if (!restants || restants.length === 0) return { etat, joueurId: null };

  const index = entierAleatoire(restants.length);
  const joueurId = restants[index];

  const suivant = clonerEtat(etat);
  suivant.draw.remaining = restants.filter((_, i) => i !== index);
  suivant.draw.order = [...suivant.draw.order, joueurId];
  suivant.teams = recomposerEquipes(suivant);
  suivant.draw.pending = joueurEnAttente(suivant);

  if (suivant.draw.remaining.length === 0) {
    suivant.draw.status = 'termine';
    suivant.draw.pending = null;
  }

  return { etat: suivant, joueurId };
}

/**
 * Annule le dernier nom tiré : il retourne dans le chapeau.
 *
 * Le tirage est irréversible par principe — un chapeau qu'on refait, c'est un
 * chapeau qu'on conteste. Mais une fausse manip reste une fausse manip, et il
 * faut pouvoir la rattraper. D'où cette action, discrète, qui ne défait qu'un
 * seul tirage à la fois.
 */
export function annulerDernierTirage(etat) {
  const ordre = etat.draw.order;
  if (!ordre || ordre.length === 0) return etat;

  const suivant = clonerEtat(etat);
  const dernier = ordre[ordre.length - 1];

  suivant.draw.order = ordre.slice(0, -1);
  suivant.draw.remaining = [dernier, ...suivant.draw.remaining];
  suivant.draw.status = 'encours';
  suivant.teams = recomposerEquipes(suivant);
  suivant.draw.pending = joueurEnAttente(suivant);

  return suivant;
}

/** Vrai quand tous les noms sont sortis et que toutes les équipes sont formées. */
export function tirageTermine(etat) {
  return etat.draw.status === 'termine'
    && etat.teams.length > 0
    && etat.teams.every((e) => e.complete);
}

/* ----------------------------------------------------------------------------
   LA BANDE DE NOMS QUI DÉFILE
   ----------------------------------------------------------------------------
   Purement visuel. On fabrique une liste de noms assez longue pour que le
   rouleau tourne pendant environ une seconde et demie, et on place LE VRAI NOM
   TIRÉ tout à la fin : ainsi la bande s'arrête exactement dessus, sans
   correction ni saut.

   Le nom d'arrivée est déjà décidé quand cette fonction est appelée. Le
   désordre employé ici n'a donc aucune conséquence sur le résultat — c'est du
   décor, et rien d'autre.
   ---------------------------------------------------------------------------- */

export function bandeDeNoms(nomsDisponibles, nomFinal, longueur = 28) {
  if (!nomsDisponibles.length) return [nomFinal];
  const bande = [];
  while (bande.length < longueur) {
    // Un mélange grossier suffit : c'est un décor. Voir le commentaire ci-dessus.
    const melange = [...nomsDisponibles].sort(() => Math.random() - 0.5);
    bande.push(...melange);
  }
  bande.length = longueur;
  bande.push(nomFinal);
  return bande;
}
