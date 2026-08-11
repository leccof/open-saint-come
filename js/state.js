/* ============================================================================
   state.js — la forme de l'objet tournoi, et les opérations dessus.
   ----------------------------------------------------------------------------
   Tout le tournoi tient dans UN SEUL objet JSON. C'est lui que storage.js
   transporte, et c'est lui qu'on télécharge en cas de pépin.

   Trois règles gouvernent ce fichier, et elles évitent l'essentiel des bugs
   des applications de tournoi :

     1. AUCUNE DONNÉE N'EST ÉCRITE DEUX FOIS. Une équipe ne stocke pas le nom
        de ses joueurs, seulement leurs identifiants. Corriger « Jean-Micel »
        en « Jean-Michel » le corrige partout d'un coup, parce que le nom
        n'existe qu'à un seul endroit.

     2. CE QUI SE DÉDUIT N'EST PAS STOCKÉ. Le podium, le nombre de joueurs
        restants, l'équipe qualifiée : tout ça se recalcule. Sinon, on finit
        un jour avec un podium qui contredit les scores.

     3. TOUTE FONCTION RENVOIE UN NOUVEL ÉTAT, elle ne modifie jamais celui
        qu'on lui donne. C'est ce qui rend « annuler » possible et les bugs
        rares.
   ============================================================================ */

export const VERSION_SCHEMA = 1;
export const NOM_TERRAIN = 'Le terrain du Potager';

/* ----------------------------------------------------------------------------
   CRÉATION
   ---------------------------------------------------------------------------- */

/**
 * L'état de départ d'un tournoi, côté métier.
 *
 * Note : ni `id`, ni `code`, ni `name`, ni `updatedAt` n'apparaissent ici.
 * Ces quatre champs sont ajoutés par storage.js, qui les gère de bout en bout.
 * state.js ne connaît pas le stockage, storage.js ne connaît pas la pétanque.
 */
export function creerEtatInitial({ date = '' } = {}) {
  return {
    schemaVersion: VERSION_SCHEMA,
    date,

    /* Où en est le tournoi. Sert à savoir quel écran proposer.
       'config' → 'joueurs' → 'tirage' → 'tableaux' → 'termine' */
    phase: 'config',

    config: {
      announcedPlayers: 0,   // effectif annoncé, modifiable tant qu'on n'a pas tiré
      teamSize: 2,           // doublettes
      triplette: false,      // une (seule) équipe à 3, si l'effectif est impair
      setsToWin: 2,          // deux manches gagnantes
      pointsPerSet: 13,
      venue: NOM_TERRAIN,
    },

    players: [],             // [{ id, name }]

    draw: {
      status: 'idle',        // 'idle' | 'encours' | 'termine'
      remaining: [],         // identifiants encore dans le chapeau
      order: [],             // ordre exact de sortie des noms
      pending: null,         // joueur tiré qui attend son coéquipier
    },

    teams: [],               // [{ id, players: [...], name: null }]

    brackets: {
      main: null,            // { prefixe, size, tours, seeds: [...] }
      consolante: null,
    },

    matches: {},             // dictionnaire plat, voir bracket.js

    /* Il n'y a qu'un seul terrain : les matchs se jouent l'un après l'autre.
       Ce champ dit lequel est en cours. Il ne se déduit de rien, donc il est
       stocké — contrairement à tout le reste. */
    currentMatchId: null,
  };
}

/** Copie profonde. On travaille toujours sur une copie, jamais sur l'original. */
export function clonerEtat(etat) {
  return structuredClone(etat);
}

/* ----------------------------------------------------------------------------
   IDENTIFIANTS
   ----------------------------------------------------------------------------
   Les identifiants sont tirés au hasard, et non incrémentés (p1, p2, p3…).
   Raison : deux personnes peuvent saisir des joueurs en même temps, chacune sur
   son téléphone. Avec des compteurs, les deux créeraient « p7 » et l'un
   écraserait l'autre. Avec du hasard, la collision est impossible en pratique.
   ---------------------------------------------------------------------------- */

const ALPHABET_ID = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function idCourt(prefixe) {
  const octets = new Uint8Array(8);
  crypto.getRandomValues(octets);
  let suffixe = '';
  for (const o of octets) suffixe += ALPHABET_ID[o % ALPHABET_ID.length];
  return `${prefixe}-${suffixe}`;
}

/* ----------------------------------------------------------------------------
   NOMS
   ---------------------------------------------------------------------------- */

/** Espaces superflus retirés, espaces multiples réduits à un seul. */
export function normaliserNom(nom) {
  return String(nom ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Clé de comparaison pour repérer les doublons.
 * « JEAN-MICHEL », « jean michel » et « Jean-Michel » donnent la même clé :
 * accents retirés, ponctuation retirée, tout en minuscules.
 * Le jour J, deux personnes tapent rarement un nom exactement pareil.
 */
export function cleNom(nom) {
  return normaliserNom(nom)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime les accents
    .replace(/[^a-z0-9]/g, '');        // supprime tirets, apostrophes, espaces
}

/* ----------------------------------------------------------------------------
   JOUEURS
   ---------------------------------------------------------------------------- */

export function joueurParId(etat, id) {
  return etat.players.find((j) => j.id === id) || null;
}

export function nomJoueur(etat, id) {
  const j = joueurParId(etat, id);
  return j ? j.name : '(joueur inconnu)';
}

/**
 * Ajoute un joueur. Renvoie { etat, joueur, erreur }.
 * Le nom vide est refusé ; le doublon est accepté mais signalé, car deux
 * cousins peuvent réellement s'appeler pareil.
 */
export function ajouterJoueur(etat, nom) {
  const propre = normaliserNom(nom);
  if (!propre) return { etat, joueur: null, erreur: 'Le nom est vide.' };
  if (etat.draw.status !== 'idle') {
    return { etat, joueur: null, erreur: 'Le tirage a commencé, la liste est close.' };
  }

  const joueur = { id: idCourt('p'), name: propre };
  const suivant = clonerEtat(etat);
  suivant.players.push(joueur);
  return { etat: suivant, joueur, erreur: null };
}

export function renommerJoueur(etat, id, nom) {
  const propre = normaliserNom(nom);
  if (!propre) return etat;
  const suivant = clonerEtat(etat);
  const j = suivant.players.find((p) => p.id === id);
  if (j) j.name = propre;
  return suivant;
}

/** Supprime un joueur. Impossible une fois le tirage lancé. */
export function supprimerJoueur(etat, id) {
  if (etat.draw.status !== 'idle') return etat;
  const suivant = clonerEtat(etat);
  suivant.players = suivant.players.filter((p) => p.id !== id);
  return suivant;
}

/**
 * Les groupes de joueurs portant le même nom.
 * Renvoie [{ cle, name, ids: [...] }], uniquement pour les noms en double.
 */
export function doublons(etat) {
  const paquets = new Map();
  for (const j of etat.players) {
    const cle = cleNom(j.name);
    if (!paquets.has(cle)) paquets.set(cle, { cle, name: j.name, ids: [] });
    paquets.get(cle).ids.push(j.id);
  }
  return [...paquets.values()].filter((p) => p.ids.length > 1);
}

/* ----------------------------------------------------------------------------
   COMPOSITION DES ÉQUIPES
   ---------------------------------------------------------------------------- */

/**
 * Comment les joueurs présents vont se répartir en équipes.
 * Renvoie { nbEquipes, tailles: [2, 2, 3] } ou null si ce n'est pas possible.
 *
 * Effectif pair   → que des doublettes.
 * Effectif impair → soit c'est refusé (null), soit, si l'organisateur a choisi
 *                   la triplette, la DERNIÈRE équipe formée compte 3 joueurs.
 *                   C'est autorisé en mêlée, et c'est la convention la plus
 *                   simple à expliquer autour de la table.
 */
export function planEquipes(etat) {
  const n = etat.players.length;
  if (n < 4) return null;                      // pas de tournoi en dessous de 4

  if (n % 2 === 0) {
    return { nbEquipes: n / 2, tailles: Array(n / 2).fill(2) };
  }

  if (etat.config.triplette) {
    const nbEquipes = (n - 1) / 2;             // n = 2k+1 → k équipes
    const tailles = Array(nbEquipes).fill(2);
    tailles[nbEquipes - 1] = 3;                // la dernière prend le troisième
    return { nbEquipes, tailles };
  }

  return null;                                 // impair non résolu
}

/** Vrai si l'effectif permet de lancer le tirage. */
export function peutTirer(etat) {
  return etat.draw.status === 'idle' && planEquipes(etat) !== null;
}

/**
 * Ce qu'il faut dire à l'organisateur quand l'effectif est impair.
 * Renvoie null si tout va bien.
 */
export function problemeEffectif(etat) {
  const n = etat.players.length;
  if (n < 4) return { type: 'trop-peu', message: `Il faut au moins 4 joueurs (actuellement ${n}).` };
  if (n % 2 === 1 && !etat.config.triplette) {
    return {
      type: 'impair',
      message: `${n} joueurs, c'est impair : il faut en ajouter un, en retirer un, ou former une triplette.`,
    };
  }
  return null;
}

export function definirTriplette(etat, oui) {
  const suivant = clonerEtat(etat);
  suivant.config.triplette = !!oui;
  return suivant;
}

/* ----------------------------------------------------------------------------
   ÉQUIPES
   ---------------------------------------------------------------------------- */

export function equipeParId(etat, id) {
  return etat.teams.find((e) => e.id === id) || null;
}

/**
 * Le nom affiché d'une équipe.
 * Par défaut, les noms des joueurs séparés par une barre oblique. Si
 * l'organisateur a saisi un nom, c'est celui-là qui prime.
 */
export function nomEquipe(etat, equipeOuId) {
  const equipe = typeof equipeOuId === 'string' ? equipeParId(etat, equipeOuId) : equipeOuId;
  if (!equipe) return '—';
  if (equipe.name) return equipe.name;
  return equipe.players.map((id) => nomJoueur(etat, id)).join(' / ');
}

/** Nom court, pour les cases étroites du tableau : prénoms seuls. */
export function nomEquipeCourt(etat, equipeOuId) {
  const equipe = typeof equipeOuId === 'string' ? equipeParId(etat, equipeOuId) : equipeOuId;
  if (!equipe) return '—';
  if (equipe.name) return equipe.name;
  return equipe.players.map((id) => nomJoueur(etat, id).split(' ')[0]).join(' / ');
}

export function renommerEquipe(etat, id, nom) {
  const propre = normaliserNom(nom);
  const suivant = clonerEtat(etat);
  const e = suivant.teams.find((t) => t.id === id);
  if (e) e.name = propre || null;             // vide = on revient au nom automatique
  return suivant;
}

/* ----------------------------------------------------------------------------
   CONFIGURATION
   ---------------------------------------------------------------------------- */

/** Modifie la configuration. Certaines valeurs se figent une fois le tirage lancé. */
export function definirConfig(etat, patch) {
  const suivant = clonerEtat(etat);
  Object.assign(suivant.config, patch);
  return suivant;
}

export function definirDate(etat, date) {
  const suivant = clonerEtat(etat);
  suivant.date = date;
  return suivant;
}

export function definirPhase(etat, phase) {
  const suivant = clonerEtat(etat);
  suivant.phase = phase;
  return suivant;
}

/* ----------------------------------------------------------------------------
   LE CHAPEAU
   ---------------------------------------------------------------------------- */

/**
 * Arme le chapeau : tous les joueurs y entrent, aucune équipe n'existe encore.
 *
 * À partir d'ici la liste des joueurs est close — on ne peut plus en ajouter
 * ni en retirer. C'est volontaire : modifier l'effectif au milieu d'un tirage
 * rendrait le résultat contestable, et sur un tirage public c'est le genre de
 * chose qui se discute longtemps.
 */
export function demarrerTirage(etat) {
  if (!peutTirer(etat)) return etat;
  const suivant = clonerEtat(etat);
  suivant.draw = {
    status: 'encours',
    remaining: suivant.players.map((j) => j.id),
    order: [],
    pending: null,
  };
  suivant.teams = [];
  suivant.phase = 'tirage';
  return suivant;
}

/* ----------------------------------------------------------------------------
   LE MATCH EN COURS
   ----------------------------------------------------------------------------
   Il n'y a qu'un seul terrain. Ce n'est donc pas un détail cosmétique : savoir
   quel match occupe le terrain évite trois personnes debout à se demander qui
   joue.
   ---------------------------------------------------------------------------- */

export function definirMatchEnCours(etat, matchId) {
  const suivant = clonerEtat(etat);
  suivant.currentMatchId = matchId;
  return suivant;
}
