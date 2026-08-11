/* ============================================================================
   bracket.js — construction des tableaux, byes, progression, consolante.
   ----------------------------------------------------------------------------
   C'est ici que les applications de tournoi cassent le plus souvent. Trois
   pièges classiques, et la façon dont ils sont désamorcés :

     · LES BYES MAL PLACÉS. Si l'on complète simplement la liste avec des places
       vides à la fin, tous les exemptés se retrouvent dans la même moitié du
       tableau. Ici, le placement découle de l'ordre classique de bracket, qui
       les répartit tout seul (voir § 2).

     · LA PROGRESSION QUI SE DÉSYNCHRONISE. Beaucoup d'applications stockent
       « le vainqueur de ce match va à ce match-là ». Deux listes à tenir à
       jour, donc deux occasions de se contredire. Ici, RIEN N'EST STOCKÉ : la
       position d'un match dans le tableau est écrite dans son identifiant, et
       la progression se calcule (voir § 3).

     · LA CORRECTION D'UN SCORE DÉJÀ SAISI. Si l'on corrige le premier tour
       alors que les demi-finales sont jouées, il faut effacer ce qui n'a plus
       de sens — mais uniquement ça. La reconstruction du § 4 s'en charge en
       repartant du tour 1 à chaque fois.
   ============================================================================ */

import { clonerEtat, nomEquipe } from './state.js';

/* ============================================================================
   § 1. OUTILS DE BASE
   ============================================================================ */

/** La puissance de 2 immédiatement supérieure ou égale. 11 → 16, 8 → 8. */
export function puissanceDeDeuxSuperieure(n) {
  let taille = 1;
  while (taille < n) taille *= 2;
  return taille;
}

/** Nombre de tours d'un tableau : 16 équipes → 4 tours. */
export function nombreDeTours(taille) {
  return Math.round(Math.log2(Math.max(1, taille)));
}

/** L'identifiant d'un match encode sa position exacte dans le tableau. */
export function idMatch(prefixe, tour, position) {
  return `M-${prefixe}-${tour}-${position}`;
}

/**
 * Un entier au hasard dans [0, borne), sans biais.
 *
 * Le simple `valeur % borne` favorise légèrement les premières valeurs quand
 * borne ne divise pas 2³². On rejette donc les tirages de la zone de
 * débordement et on retire. Sur un tirage au sort public, la rigueur n'est pas
 * un luxe : c'est ce qui rend le résultat incontestable.
 */
export function entierAleatoire(borne) {
  if (borne <= 1) return 0;
  const plafond = Math.floor(0xffffffff / borne) * borne;
  const tampon = new Uint32Array(1);
  let valeur;
  do {
    crypto.getRandomValues(tampon);
    valeur = tampon[0];
  } while (valeur >= plafond);
  return valeur % borne;
}

/** Mélange de Fisher-Yates, avec le générateur cryptographique. */
export function melangerCrypto(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = entierAleatoire(i + 1);
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/* ============================================================================
   § 2. LES BYES ET LEUR PLACEMENT
   ----------------------------------------------------------------------------
   Un « bye » est une équipe exemptée de tour, qui passe au suivant sans jouer.

   POURQUOI IL EN FAUT. Un tableau à élimination directe ne fonctionne que si
   le nombre d'équipes est une puissance de 2 : à chaque tour on divise par
   deux. Avec 11 équipes, au deuxième tour il en resterait 5,5. On complète
   donc jusqu'à 16 avec 5 places vides.

   COMMENT ON LES PLACE. C'est le point délicat. On procède en trois temps :

     1. On mélange les équipes au hasard et on leur attribue un numéro de 1 à N.
        C'est ici, et uniquement ici, que se joue le tirage au sort.
     2. Les places vides prennent les numéros restants, de N+1 à la taille du
        tableau.
     3. On dispose les numéros selon l'ordre classique de bracket, qui a une
        propriété bien pratique : il oppose systématiquement le n° 1 au dernier,
        le n° 2 à l'avant-dernier, et ainsi de suite. Comme les derniers numéros
        sont justement les places vides, LES BYES TOMBENT TOUT SEULS sur des
        équipes différentes, réparties dans les deux moitiés du tableau.

   Il n'y a donc aucun code « d'équilibrage » : la répartition découle de la
   structure. Et comme le mélange de l'étape 1 est aléatoire, savoir qui est
   exempté est bien le fruit d'un tirage, pas de l'ordre d'inscription.
   ============================================================================ */

/**
 * L'ordre classique de bracket, construit par doublement successif.
 *
 * On part de [1]. À chaque étape, chaque numéro t est suivi de son adversaire
 * (n - t), où n est le futur total plus un. Cela donne :
 *
 *   taille 2  : [1, 2]
 *   taille 4  : [1, 4, 2, 3]              → 1 contre 4, 2 contre 3
 *   taille 8  : [1, 8, 4, 5, 2, 7, 3, 6]  → 1c8, 4c5, 2c7, 3c6
 *   taille 16 : [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 *
 * La valeur à l'indice i est le numéro de l'équipe qui occupe la case i du
 * tableau. Les cases 2p et 2p+1 s'affrontent au match p du premier tour.
 */
export function ordreDesTetes(taille) {
  let ordre = [1];
  while (ordre.length < taille) {
    const total = ordre.length * 2 + 1;
    const suivant = [];
    for (const tete of ordre) suivant.push(tete, total - tete);
    ordre = suivant;
  }
  return ordre;
}

/**
 * Construit un tableau complet à partir d'une liste d'identifiants d'équipes.
 *
 * @param {string[]} idsEquipes  Les équipes, DÉJÀ mélangées par l'appelant.
 * @param {string}   prefixe     'main' ou 'consolante'.
 * @returns {{ size, tours, seeds, matches, byes }}
 */
export function construireTableau(idsEquipes, prefixe) {
  const nb = idsEquipes.length;
  const size = puissanceDeDeuxSuperieure(nb);
  const tours = nombreDeTours(size);

  // Étape 2 : les numéros 1..nb vont aux équipes, le reste reste vide.
  const parNumero = new Array(size).fill(null);
  idsEquipes.forEach((id, i) => { parNumero[i] = id; });

  // Étape 3 : on dispose selon l'ordre classique.
  const ordre = ordreDesTetes(size);
  const seeds = ordre.map((numero) => parNumero[numero - 1]);

  // Les matchs du premier tour : cases 2p et 2p+1.
  const matches = {};
  for (let p = 0; p < size / 2; p++) {
    const id = idMatch(prefixe, 1, p);
    matches[id] = {
      id,
      bracket: prefixe,
      round: 1,
      position: p,
      teamA: seeds[p * 2],
      teamB: seeds[p * 2 + 1],
      sets: [],
      winner: null,
      status: 'attente',
    };
  }

  // Les tours suivants : cases encore inconnues, elles se rempliront seules.
  for (let r = 2; r <= tours; r++) {
    for (let p = 0; p < size / 2 ** r; p++) {
      const id = idMatch(prefixe, r, p);
      matches[id] = {
        id,
        bracket: prefixe,
        round: r,
        position: p,
        teamA: null,
        teamB: null,
        sets: [],
        winner: null,
        status: 'attente',
      };
    }
  }

  return { size, tours, seeds, matches, byes: size - nb };
}

/* ============================================================================
   § 3. LA PROGRESSION
   ----------------------------------------------------------------------------
   Le vainqueur du match (tour R, position P) va toujours au match
   (tour R+1, position P÷2 arrondi à l'inférieur), du côté A si P est pair, du
   côté B si P est impair.

   Une seule ligne de calcul, la même pour tous les matchs des deux tableaux.
   Rien à stocker, donc rien qui puisse se désynchroniser.
   ============================================================================ */

export function matchSuivant(tour, position) {
  return {
    tour: tour + 1,
    position: Math.floor(position / 2),
    cote: position % 2 === 0 ? 'A' : 'B',
  };
}

/* ============================================================================
   § 4. LES SCORES
   ----------------------------------------------------------------------------
   Un match se joue au meilleur des trois manches, chaque manche en 13 points.
   ============================================================================ */

/** Une manche est valide si le vainqueur est exactement à 13 et l'autre en dessous. */
export function validerManche(a, b, points = 13) {
  const na = Number(a), nb = Number(b);
  if (!Number.isInteger(na) || !Number.isInteger(nb)) return { ok: false, message: 'Scores incomplets.' };
  if (na < 0 || nb < 0) return { ok: false, message: 'Un score ne peut pas être négatif.' };
  if (na > points || nb > points) return { ok: false, message: `Une manche s'arrête à ${points} points.` };
  if (na === nb) return { ok: false, message: 'Une manche ne peut pas finir à égalité.' };
  if (Math.max(na, nb) !== points) return { ok: false, message: `Le vainqueur de la manche doit être à ${points}.` };
  return { ok: true, message: null };
}

/**
 * Lit une liste de manches et en tire le résultat du match.
 * Renvoie { manchesA, manchesB, vainqueur: 'A'|'B'|null, termine }.
 */
export function resultatMatch(manches, config = {}) {
  const aGagner = config.setsToWin ?? 2;
  let manchesA = 0, manchesB = 0;

  for (const m of manches || []) {
    if (!m || m.a == null || m.b == null) continue;
    if (m.a > m.b) manchesA++;
    else if (m.b > m.a) manchesB++;
    if (manchesA >= aGagner || manchesB >= aGagner) break;   // le match est clos
  }

  const vainqueur = manchesA >= aGagner ? 'A' : manchesB >= aGagner ? 'B' : null;
  return { manchesA, manchesB, vainqueur, termine: vainqueur !== null };
}

/**
 * Nettoie une liste de manches : on retire les manches vides, et surtout les
 * manches saisies APRÈS que le match soit déjà gagné. Dès qu'une équipe a ses
 * deux manches, la troisième n'existe plus.
 */
function nettoyerManches(manches, config = {}) {
  const aGagner = config.setsToWin ?? 2;
  const propres = [];
  let a = 0, b = 0;

  for (const m of manches || []) {
    if (!m || m.a == null || m.b == null || m.a === '' || m.b === '') continue;
    propres.push({ a: Number(m.a), b: Number(m.b) });
    if (m.a > m.b) a++; else if (m.b > m.a) b++;
    if (a >= aGagner || b >= aGagner) break;
  }
  return propres;
}

/* ============================================================================
   § 5. RECONSTRUCTION EN CASCADE
   ----------------------------------------------------------------------------
   Après CHAQUE modification de score, on repart du premier tour et on
   redescend tout le tableau. C'est un peu plus de calcul — quelques dizaines
   d'opérations — mais ça garantit qu'un tableau ne peut jamais être dans un
   état incohérent, même après une correction tardive.

   Règle de conservation : un match ne perd son score que si ses PARTICIPANTS
   ont changé. Corriger un match du premier tour n'efface donc que les matchs
   réellement concernés par la correction, pas tout le tableau.
   ============================================================================ */

/** Met à jour le statut et le vainqueur d'un match, d'après ses participants. */
function majMatch(match, config) {
  // Aucun adversaire connu.
  if (!match.teamA && !match.teamB) {
    match.status = 'attente';
    match.winner = null;
    return;
  }

  // Une seule équipe. Au premier tour, c'est un bye : elle passe sans jouer.
  // Aux tours suivants, ça veut simplement dire que l'autre demi n'est pas
  // encore jouée.
  if (!match.teamA || !match.teamB) {
    if (match.round === 1) {
      match.status = 'bye';
      match.winner = match.teamA || match.teamB;
      match.sets = [];
    } else {
      match.status = 'attente';
      match.winner = null;
    }
    return;
  }

  const r = resultatMatch(match.sets, config);
  match.winner = r.vainqueur === 'A' ? match.teamA : r.vainqueur === 'B' ? match.teamB : null;
  match.status = r.termine ? 'termine' : 'pret';
}

function vainqueurDe(etat, prefixe, tour, position) {
  const m = etat.matches[idMatch(prefixe, tour, position)];
  return m ? m.winner : null;
}

/**
 * Recalcule tout un tableau, du premier tour à la finale.
 * MODIFIE l'état passé en paramètre : à n'appeler que sur une copie.
 */
export function reconstruire(etat, prefixe) {
  const tableau = etat.brackets[prefixe];
  if (!tableau) return;

  for (let r = 1; r <= tableau.tours; r++) {
    const nbMatchs = tableau.size / 2 ** r;
    for (let p = 0; p < nbMatchs; p++) {
      const match = etat.matches[idMatch(prefixe, r, p)];
      if (!match) continue;

      if (r > 1) {
        const a = vainqueurDe(etat, prefixe, r - 1, p * 2);
        const b = vainqueurDe(etat, prefixe, r - 1, p * 2 + 1);

        // Les participants ont changé : le score enregistré ici ne veut plus
        // rien dire, on l'efface. C'est exactement la cascade demandée.
        if (match.teamA !== a || match.teamB !== b) {
          match.teamA = a;
          match.teamB = b;
          match.sets = [];
        }
      }

      majMatch(match, etat.config);
    }
  }

  // Le match qui occupait le terrain a pu disparaître ou changer d'équipes.
  if (etat.currentMatchId) {
    const encours = etat.matches[etat.currentMatchId];
    if (!encours || encours.status === 'termine' || encours.status === 'attente') {
      etat.currentMatchId = null;
    }
  }
}

/* ============================================================================
   § 6. LE TABLEAU PRINCIPAL
   ============================================================================ */

/**
 * Crée le tableau principal à partir des équipes formées au chapeau.
 * Le tirage au sort du placement (et donc des byes) a lieu ici.
 */
export function creerTableauPrincipal(etat) {
  const ids = etat.teams.map((e) => e.id);
  if (ids.length < 2) return etat;

  const suivant = clonerEtat(etat);
  const t = construireTableau(melangerCrypto(ids), 'main');

  suivant.brackets.main = {
    prefixe: 'main',
    size: t.size,
    tours: t.tours,
    seeds: t.seeds,
    byes: t.byes,
  };
  Object.assign(suivant.matches, t.matches);
  suivant.phase = 'tableaux';

  reconstruire(suivant, 'main');
  return suivant;
}

/* ============================================================================
   § 7. LA CONSOLANTE
   ----------------------------------------------------------------------------
   Règle retenue : LA CONSOLANTE ACCUEILLE TOUTE ÉQUIPE QUI PERD SON PREMIER
   MATCH JOUÉ.

   Pourquoi pas simplement « les perdants du premier tour » ? Parce qu'avec des
   byes, le premier tour compte très peu de vrais matchs. Sur 11 équipes il n'y
   en a que 3 : les 5 équipes exemptées qui perdraient au deuxième tour
   seraient éliminées après UNE SEULE partie, sans consolante. Pour un concours
   de village, c'est exactement ce qu'il ne faut pas.

   Avec cette règle, tout le monde joue au moins deux parties.

   Conséquence pratique : la liste des participants n'est connue qu'une fois le
   deuxième tour joué (le premier match des équipes exemptées). Quand il n'y a
   aucun bye, le premier tour suffit.
   ============================================================================ */

/** Vrai si cette équipe a été exemptée au premier tour du tableau principal. */
function aEuUnBye(etat, idEquipe) {
  const b = etat.brackets.main;
  if (!b || !idEquipe) return false;
  for (let p = 0; p < b.size / 2; p++) {
    const m = etat.matches[idMatch('main', 1, p)];
    if (m && m.status === 'bye' && m.winner === idEquipe) return true;
  }
  return false;
}

function perdantDe(match) {
  if (!match || match.status !== 'termine' || !match.winner) return null;
  return match.teamA === match.winner ? match.teamB : match.teamA;
}

/** Les équipes qui ont perdu leur tout premier match joué. */
export function perdantsPremierMatch(etat) {
  const b = etat.brackets.main;
  if (!b) return [];

  const perdants = [];

  // Premier tour : tous les perdants sont des « premiers matchs ».
  for (let p = 0; p < b.size / 2; p++) {
    const l = perdantDe(etat.matches[idMatch('main', 1, p)]);
    if (l) perdants.push(l);
  }

  // Deuxième tour : uniquement les équipes qui étaient exemptées au premier.
  // Les autres ont déjà gagné une partie, ce n'est pas leur premier match.
  if (b.tours >= 2) {
    for (let p = 0; p < b.size / 4; p++) {
      const l = perdantDe(etat.matches[idMatch('main', 2, p)]);
      if (l && aEuUnBye(etat, l)) perdants.push(l);
    }
  }

  return perdants;
}

/** Vrai quand la liste des participants à la consolante est définitivement close. */
export function consolantePrete(etat) {
  const b = etat.brackets.main;
  if (!b) return false;

  const termine = (m) => m && (m.status === 'termine' || m.status === 'bye');

  // Le premier tour doit être entièrement joué.
  for (let p = 0; p < b.size / 2; p++) {
    if (!termine(etat.matches[idMatch('main', 1, p)])) return false;
  }

  // S'il y a eu des byes, il faut aussi attendre le deuxième tour — c'est le
  // premier match des équipes exemptées.
  // (Sauf sur un tout petit tableau, où le deuxième tour est déjà la finale :
  //  attendre n'aurait alors aucun sens.)
  const attendreLeSecondTour = b.byes > 0 && b.tours >= 3;
  if (attendreLeSecondTour) {
    for (let p = 0; p < b.size / 4; p++) {
      if (!termine(etat.matches[idMatch('main', 2, p)])) return false;
    }
  }

  return perdantsPremierMatch(etat).length >= 2;
}

/** Crée le tableau de consolante. Le placement y est tiré au sort comme pour le principal. */
export function creerConsolante(etat) {
  const equipes = perdantsPremierMatch(etat);
  if (equipes.length < 2) return etat;

  const suivant = clonerEtat(etat);

  // On efface d'éventuels matchs de consolante précédents avant de reconstruire.
  for (const id of Object.keys(suivant.matches)) {
    if (suivant.matches[id].bracket === 'consolante') delete suivant.matches[id];
  }

  const t = construireTableau(melangerCrypto(equipes), 'consolante');
  suivant.brackets.consolante = {
    prefixe: 'consolante',
    size: t.size,
    tours: t.tours,
    seeds: t.seeds,
    byes: t.byes,
  };
  Object.assign(suivant.matches, t.matches);

  reconstruire(suivant, 'consolante');
  return suivant;
}

/**
 * Vrai si la consolante existante ne correspond plus aux résultats du tableau
 * principal — typiquement après la correction d'un score du premier tour.
 * L'app doit alors demander confirmation avant de la reconstruire.
 */
export function consolanteObsolete(etat) {
  const c = etat.brackets.consolante;
  if (!c) return false;
  const actuels = new Set(perdantsPremierMatch(etat));
  const inscrits = new Set(c.seeds.filter(Boolean));
  if (actuels.size !== inscrits.size) return true;
  for (const id of actuels) if (!inscrits.has(id)) return true;
  return false;
}

/* ============================================================================
   § 8. ENREGISTRER UN SCORE
   ============================================================================ */

/**
 * Enregistre les manches d'un match et propage tout ce qui en découle.
 * Renvoie un NOUVEL état.
 *
 * @param {object} etat
 * @param {string} matchId
 * @param {Array<{a:number,b:number}>} manches
 */
export function enregistrerManches(etat, matchId, manches) {
  const match = etat.matches[matchId];
  if (!match) return etat;
  if (match.status === 'bye') return etat;        // un bye ne se saisit pas

  const suivant = clonerEtat(etat);
  const m = suivant.matches[matchId];

  m.sets = nettoyerManches(manches, suivant.config);
  majMatch(m, suivant.config);

  reconstruire(suivant, m.bracket);

  // Le match vient de se terminer et occupait le terrain : le terrain se libère.
  if (suivant.currentMatchId === matchId && m.status === 'termine') {
    suivant.currentMatchId = null;
  }

  // La consolante devient peut-être possible.
  if (m.bracket === 'main' && !suivant.brackets.consolante && consolantePrete(suivant)) {
    return creerConsolante(suivant);
  }

  return suivant;
}

/**
 * Les matchs situés en aval de celui-ci et qui contiennent DÉJÀ un score.
 * L'app s'en sert pour prévenir : « 2 matchs suivants seront remis à zéro,
 * confirmez-vous ? »
 */
export function matchsAvalDejaJoues(etat, matchId) {
  const match = etat.matches[matchId];
  if (!match) return [];
  const b = etat.brackets[match.bracket];
  if (!b) return [];

  const touches = [];
  let tour = match.round;
  let position = match.position;

  while (tour < b.tours) {
    const suite = matchSuivant(tour, position);
    tour = suite.tour;
    position = suite.position;
    const m = etat.matches[idMatch(match.bracket, tour, position)];
    if (m && m.sets && m.sets.length > 0) touches.push(m);
  }
  return touches;
}

/* ============================================================================
   § 9. LECTURE — tout ce dont l'affichage a besoin
   ============================================================================ */

/** Les matchs d'un tour, dans l'ordre. */
export function matchsDuTour(etat, prefixe, tour) {
  const b = etat.brackets[prefixe];
  if (!b) return [];
  const nb = b.size / 2 ** tour;
  const liste = [];
  for (let p = 0; p < nb; p++) {
    const m = etat.matches[idMatch(prefixe, tour, p)];
    if (m) liste.push(m);
  }
  return liste;
}

/** « Finale », « Demi-finales », « Quarts de finale »… */
export function nomDuTour(nbTours, tour) {
  const restant = nbTours - tour;
  if (restant === 0) return 'Finale';
  if (restant === 1) return 'Demi-finales';
  if (restant === 2) return 'Quarts de finale';
  if (restant === 3) return 'Huitièmes de finale';
  if (restant === 4) return 'Seizièmes de finale';
  return tour === 1 ? '1er tour' : `${tour}e tour`;
}

/**
 * La file d'attente du terrain : les matchs jouables, dans l'ordre où il est
 * logique de les faire passer. Le tableau principal d'abord, puis la
 * consolante ; à l'intérieur, tour par tour.
 *
 * Il n'y a qu'un seul terrain : cette liste, c'est le programme de la journée.
 */
export function filAttente(etat) {
  const liste = [];
  for (const prefixe of ['main', 'consolante']) {
    const b = etat.brackets[prefixe];
    if (!b) continue;
    for (let r = 1; r <= b.tours; r++) {
      for (const m of matchsDuTour(etat, prefixe, r)) {
        if (m.status === 'pret') liste.push(m);
      }
    }
  }
  return liste;
}

/** Le prochain match à jouer, ou null s'il n'y en a plus. */
export function prochainMatch(etat) {
  if (etat.currentMatchId && etat.matches[etat.currentMatchId]?.status === 'pret') {
    return etat.matches[etat.currentMatchId];
  }
  return filAttente(etat)[0] || null;
}

/**
 * Le podium d'un tableau, ou null tant que la finale n'est pas jouée.
 * Il n'y a pas de match pour la 3e place : on nomme donc les deux équipes
 * sorties en demi-finale, ce qui est l'usage dans les concours.
 */
export function podium(etat, prefixe = 'main') {
  const b = etat.brackets[prefixe];
  if (!b) return null;

  const finale = etat.matches[idMatch(prefixe, b.tours, 0)];
  if (!finale || finale.status !== 'termine') return null;

  const premier = finale.winner;
  const deuxieme = finale.teamA === premier ? finale.teamB : finale.teamA;

  const demiFinalistes = [];
  if (b.tours >= 2) {
    for (const m of matchsDuTour(etat, prefixe, b.tours - 1)) {
      const l = perdantDe(m);
      if (l) demiFinalistes.push(l);
    }
  }

  return { premier, deuxieme, demiFinalistes };
}

/** Tous les matchs joués, à plat, pour le récapitulatif de fin de journée. */
export function tousLesMatchsJoues(etat) {
  const liste = [];
  for (const prefixe of ['main', 'consolante']) {
    const b = etat.brackets[prefixe];
    if (!b) continue;
    for (let r = 1; r <= b.tours; r++) {
      for (const m of matchsDuTour(etat, prefixe, r)) {
        if (m.status === 'termine') liste.push(m);
      }
    }
  }
  return liste;
}

/** Libellé lisible d'un match, pour le récapitulatif et l'export. */
export function libelleMatch(etat, match) {
  const b = etat.brackets[match.bracket];
  const tour = b ? nomDuTour(b.tours, match.round) : `tour ${match.round}`;
  const tableau = match.bracket === 'main' ? 'Principal' : 'Consolante';
  return `${tableau} · ${tour} — ${nomEquipe(etat, match.teamA)} contre ${nomEquipe(etat, match.teamB)}`;
}
