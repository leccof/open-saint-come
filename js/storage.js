/* ============================================================================
   storage.js — toute la persistance de l'application, et rien d'autre.
   ----------------------------------------------------------------------------
   AUCUN AUTRE FICHIER DU PROJET NE PARLE À SUPABASE. C'est la règle du projet.
   Pour remplacer Supabase par votre propre serveur, il n'y a que ce fichier à
   réécrire : gardez les mêmes fonctions exportées et le reste de l'app ne verra
   pas la différence.

   Ce fichier ne connaît rien à la pétanque. Il ne sait pas ce qu'est une
   doublette ni un bracket : il transporte un objet JSON, point. C'est ce qui le
   rend remplaçable.

   ----------------------------------------------------------------------------
   LE CONTRAT PUBLIC

     createTournament(nom, etatInitial?)  →  crée un tournoi, renvoie son état
     loadTournament(code)                 →  charge un tournoi par son code
     saveTournament(etat)                 →  enregistre (immédiat en local,
                                             différé de 800 ms vers le serveur)

   Autour, quelques utilitaires : suivi du statut de synchronisation, liste des
   tournois ouverts sur cet appareil, surveillance des modifications distantes,
   et export JSON de secours.

   ----------------------------------------------------------------------------
   LE PRINCIPE, EN UNE PHRASE
   Le navigateur fait autorité. Supabase n'est qu'une copie partagée.

   Sur un terrain en Aveyron, le réseau saute. Si l'app dépendait du serveur
   pour fonctionner, elle s'arrêterait au pire moment. Donc :

     1. Toute modification est écrite DANS LE NAVIGATEUR immédiatement, de façon
        synchrone. Cette écriture ne peut pas échouer.
     2. L'envoi vers Supabase se fait ensuite, avec 800 ms de retard, et peut
        échouer autant de fois qu'il veut : on réessaiera.
     3. En cas de désaccord entre la copie locale et la copie distante, c'est la
        plus récemment modifiée qui gagne (comparaison des `updatedAt`).

   Conséquence : couper le réseau ne casse rien. On perd la synchronisation
   entre appareils, jamais les données.
   ============================================================================ */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

/* ----------------------------------------------------------------------------
   RÉGLAGES
   ---------------------------------------------------------------------------- */

const TABLE = 'tournaments';

/** Délai d'anti-rebond avant l'envoi vers le serveur.
 *  « Anti-rebond » (debounce) : quand on tape un nom lettre par lettre, on ne
 *  veut pas dix appels réseau. On attend 800 ms de calme avant d'envoyer, et
 *  chaque nouvelle frappe repousse l'échéance. */
const ANTI_REBOND_MS = 800;

/** Toutes les 15 s, on va voir si un autre appareil a modifié le tournoi. */
const INTERVALLE_VEILLE_MS = 15000;

/** Attente avant de réessayer un envoi qui a échoué : 2 s, 4 s, 8 s… plafonné
 *  à 30 s. Inutile de marteler un réseau qui ne répond pas. */
const RETENTATIVE_MIN_MS = 2000;
const RETENTATIVE_MAX_MS = 30000;

/** Préfixe de toutes nos clés dans le navigateur, pour ne rien écraser
 *  d'autre. */
const PREFIXE = 'osc:';
const CLE_INDEX = PREFIXE + 'index';
const cleTournoi = (code) => PREFIXE + 't:' + code;

/** Alphabet des codes de tournoi.
 *  On a retiré I, O, 0 et 1 : dictés à voix haute au milieu du bruit, ils se
 *  confondent. Il reste 32 caractères, soit un peu plus d'un milliard de codes
 *  possibles — largement assez. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR_CODE = 6;

/* ----------------------------------------------------------------------------
   STATUT DE SYNCHRONISATION
   Trois états, et un seul à la fois :
     'synchronise'  tout est enregistré sur le serveur
     'attente'      des modifications attendent d'être envoyées
     'horsligne'    le serveur est injoignable
   L'app affiche ce statut en permanence en haut de l'écran.
   ---------------------------------------------------------------------------- */

let statut = 'synchronise';
const abonnesStatut = new Set();

function definirStatut(nouveau) {
  if (nouveau === statut) return;
  statut = nouveau;
  for (const cb of abonnesStatut) {
    try { cb(statut); } catch (e) { console.error('[storage] abonné en erreur', e); }
  }
}

/** Statut courant : 'synchronise' | 'attente' | 'horsligne'. */
export function getStatut() {
  return statut;
}

/** S'abonner aux changements de statut. Renvoie une fonction de désabonnement. */
export function onStatut(callback) {
  abonnesStatut.add(callback);
  callback(statut);                       // on donne tout de suite l'état actuel
  return () => abonnesStatut.delete(callback);
}

/* ----------------------------------------------------------------------------
   LE CLIENT SUPABASE — chargé à la demande, et jamais bloquant
   ----------------------------------------------------------------------------
   Le client vient d'un CDN. Si le téléphone n'a pas de réseau au moment où la
   page s'ouvre, ce téléchargement échoue. Avec un `import` classique en haut du
   fichier, l'échec ferait planter TOUT le module, et donc toute l'app.

   On le charge donc en différé, dans un try/catch. Si ça échoue, on repasse en
   mode « hors ligne » et l'app continue de fonctionner sur le stockage local.
   On retentera au prochain besoin.
   ---------------------------------------------------------------------------- */

let clientPromesse = null;

async function client() {
  if (!clientPromesse) {
    clientPromesse = (async () => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },   // pas de comptes utilisateurs ici
      });
    })().catch((err) => {
      clientPromesse = null;               // on pourra réessayer plus tard
      throw err;
    });
  }
  return clientPromesse;
}

/* ----------------------------------------------------------------------------
   STOCKAGE LOCAL
   ----------------------------------------------------------------------------
   localStorage : la petite mémoire que chaque site possède dans le navigateur.
   Elle survit à la fermeture de l'onglet et fait quelques mégaoctets — très
   au-delà de ce qu'un tournoi peut peser (quelques dizaines de kilooctets).

   Tout est enveloppé dans des try/catch : en navigation privée sur iOS,
   localStorage peut lever une exception. L'app doit survivre à ça.
   ---------------------------------------------------------------------------- */

function lireLocal(cle) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    console.warn('[storage] lecture locale impossible', e);
    return null;
  }
}

function ecrireLocal(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    console.error('[storage] écriture locale impossible', e);
    return false;
  }
}

/** L'index des tournois ouverts sur cet appareil, pour l'écran d'accueil.
 *  Format : [{ code, name, updatedAt, enAttente }] */
function lireIndex() {
  const idx = lireLocal(CLE_INDEX);
  return Array.isArray(idx) ? idx : [];
}

function majIndex(etat, enAttente) {
  const index = lireIndex().filter((t) => t.code !== etat.code);
  index.unshift({
    code: etat.code,
    name: etat.name,
    updatedAt: etat.updatedAt,
    enAttente: !!enAttente,
  });
  ecrireLocal(CLE_INDEX, index.slice(0, 30));   // on n'en garde pas cent
}

/** Liste des tournois déjà ouverts sur cet appareil, le plus récent en tête. */
export function listLocalTournaments() {
  return lireIndex();
}

/* ----------------------------------------------------------------------------
   FILE D'ATTENTE DES ENVOIS
   ----------------------------------------------------------------------------
   Une entrée par tournoi en attente d'envoi. On ne garde que la dernière
   version : inutile d'envoyer trois états successifs, seul le dernier compte.
   ---------------------------------------------------------------------------- */

/** code → { etat, minuteur, essais, envoiEnCours } */
const enAttente = new Map();

function recalculerStatut() {
  // L'ordre compte : « hors ligne » l'emporte toujours. Afficher « synchronisé »
  // alors que le réseau est coupé laisserait croire qu'on reçoit les
  // modifications des autres appareils, ce qui est faux.
  if (!navigator.onLine) definirStatut('horsligne');
  else if (enAttente.size === 0) definirStatut('synchronise');
  else definirStatut('attente');
}

/* ----------------------------------------------------------------------------
   GÉNÉRATION DU CODE
   ---------------------------------------------------------------------------- */

/** Un code à 6 caractères, tiré avec le générateur cryptographique du
 *  navigateur — jamais Math.random(), qui est prévisible.
 *
 *  Le rejet des valeurs ≥ 256 - (256 % 32) évite le « biais de modulo » : sans
 *  lui, les premières lettres de l'alphabet sortiraient légèrement plus souvent
 *  que les dernières. */
function genererCode() {
  const seuil = 256 - (256 % ALPHABET.length);
  let code = '';
  const tampon = new Uint8Array(LONGUEUR_CODE * 2);
  while (code.length < LONGUEUR_CODE) {
    crypto.getRandomValues(tampon);
    for (const octet of tampon) {
      if (octet >= seuil) continue;
      code += ALPHABET[octet % ALPHABET.length];
      if (code.length === LONGUEUR_CODE) break;
    }
  }
  return code;
}

/** Normalise ce que l'utilisateur a tapé : majuscules, espaces retirés.
 *  Renvoie null si ça ne peut pas être un code valide. */
export function normaliserCode(saisie) {
  const code = String(saisie || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === LONGUEUR_CODE ? code : null;
}

/* ----------------------------------------------------------------------------
   CONVERSION ENTRE LA LIGNE SUPABASE ET L'OBJET D'ÉTAT
   ----------------------------------------------------------------------------
   En base, le tournoi est réparti sur cinq colonnes (id, code, name, state,
   updated_at). Dans l'app, c'est un seul objet. Ces deux fonctions font le
   passage, et sont le seul endroit du projet qui connaît la forme de la table.
   ---------------------------------------------------------------------------- */

function ligneVersEtat(ligne) {
  return {
    ...(ligne.state || {}),
    id: ligne.id,
    code: ligne.code,
    name: ligne.name,
    updatedAt: ligne.updated_at,
  };
}

function etatVersLigne(etat) {
  // On sort id/code/name/updatedAt de l'objet : ils ont leur propre colonne.
  const { id, code, name, updatedAt, ...reste } = etat;
  return {
    id,
    code,
    name,
    state: reste,
    updated_at: updatedAt,
  };
}

/* ----------------------------------------------------------------------------
   1. CRÉER UN TOURNOI
   ---------------------------------------------------------------------------- */

/**
 * Crée un tournoi et renvoie son état complet.
 *
 * @param {string} nom          Nom affiché du tournoi.
 * @param {object} etatInitial  État métier de départ (joueurs, équipes…).
 *                              storage.js n'y touche pas et ne le comprend pas :
 *                              il se contente de l'enrober et de le transporter.
 *
 * Fonctionne même sans réseau : le tournoi est créé localement et sera poussé
 * vers le serveur à la première occasion.
 */
export async function createTournament(nom, etatInitial = {}) {
  const maintenant = new Date().toISOString();

  let etat = {
    ...etatInitial,
    id: crypto.randomUUID(),
    code: genererCode(),
    name: nom,
    createdAt: maintenant,
    updatedAt: maintenant,
  };

  // On enregistre d'abord en local : à partir d'ici, le tournoi existe, quoi
  // qu'il arrive ensuite côté réseau.
  ecrireLocal(cleTournoi(etat.code), etat);
  majIndex(etat, true);

  try {
    const sb = await client();

    // Il est astronomiquement improbable de tirer deux fois le même code, mais
    // « improbable » n'est pas « impossible » : on retente si la base refuse
    // pour cause de doublon (code d'erreur 23505 = contrainte d'unicité).
    for (let essai = 0; essai < 5; essai++) {
      const { data, error } = await sb
        .from(TABLE)
        .insert(etatVersLigne(etat))
        .select()
        .single();

      if (!error) {
        const cree = ligneVersEtat(data);
        ecrireLocal(cleTournoi(cree.code), cree);
        majIndex(cree, false);
        definirStatut('synchronise');
        return cree;
      }

      if (error.code !== '23505') throw error;

      // Doublon : on efface la trace locale du code refusé et on retire.
      try { localStorage.removeItem(cleTournoi(etat.code)); } catch (_) {}
      etat = { ...etat, code: genererCode() };
      ecrireLocal(cleTournoi(etat.code), etat);
    }
    throw new Error('Impossible de trouver un code libre après 5 tentatives.');
  } catch (err) {
    // Pas de réseau, ou serveur muet : ce n'est pas grave, on a la copie locale.
    console.warn('[storage] création hors ligne, envoi différé', err);
    programmerEnvoi(etat);
    return etat;
  }
}

/* ----------------------------------------------------------------------------
   2. CHARGER UN TOURNOI
   ---------------------------------------------------------------------------- */

/**
 * Charge un tournoi par son code à 6 caractères.
 *
 * Récupère les deux versions — celle du navigateur et celle du serveur — et
 * garde la plus récente. Renvoie null si le tournoi n'existe nulle part.
 */
export async function loadTournament(code) {
  const codeNet = normaliserCode(code);
  if (!codeNet) return null;

  const local = lireLocal(cleTournoi(codeNet));

  let distant = null;
  let serveurJoignable = false;
  try {
    const sb = await client();
    const { data, error } = await sb
      .from(TABLE)
      .select('*')
      .eq('code', codeNet)
      .maybeSingle();          // maybeSingle : 0 ou 1 ligne, sans lever d'erreur
    if (error) throw error;
    serveurJoignable = true;
    if (data) distant = ligneVersEtat(data);
    recalculerStatut();
  } catch (err) {
    console.warn('[storage] serveur injoignable, on lit la copie locale', err);
    definirStatut('horsligne');
  }

  // --- arbitrage entre les deux copies ---------------------------------------
  if (!local && !distant) return null;

  if (!distant) {
    // Deux cas très différents se ressemblent ici :
    //   · le serveur n'a pas répondu       → on se contente de la copie locale ;
    //   · le serveur a répondu « inconnu » → ce tournoi a été créé hors ligne et
    //     n'a jamais été poussé. Il faut le pousser maintenant.
    if (serveurJoignable && local) programmerEnvoi(local);
    return local;
  }

  if (!local) {
    ecrireLocal(cleTournoi(codeNet), distant);
    majIndex(distant, false);
    return distant;
  }

  const tLocal = Date.parse(local.updatedAt || 0);
  const tDistant = Date.parse(distant.updatedAt || 0);

  if (tLocal > tDistant) {
    // Le téléphone a travaillé hors ligne et détient la version la plus
    // récente : on la renvoie et on la pousse vers le serveur.
    programmerEnvoi(local);
    return local;
  }

  ecrireLocal(cleTournoi(codeNet), distant);
  majIndex(distant, false);
  return distant;
}

/* ----------------------------------------------------------------------------
   3. ENREGISTRER
   ---------------------------------------------------------------------------- */

/**
 * Enregistre l'état d'un tournoi.
 *
 * Écriture locale IMMÉDIATE et synchrone, envoi serveur différé de 800 ms.
 * Appelez-la aussi souvent que vous voulez : les appels rapprochés sont
 * fusionnés, seul le dernier état part sur le réseau.
 *
 * Ne renvoie rien et ne peut pas échouer du point de vue de l'appelant : si le
 * réseau est absent, l'envoi est simplement reporté.
 */
export function saveTournament(etat) {
  if (!etat || !etat.code) {
    console.error('[storage] saveTournament appelé sans code', etat);
    return;
  }

  const horodate = { ...etat, updatedAt: new Date().toISOString() };

  ecrireLocal(cleTournoi(horodate.code), horodate);
  majIndex(horodate, true);
  programmerEnvoi(horodate);

  return horodate;
}

/** Met (ou remet) un tournoi dans la file d'envoi, avec l'anti-rebond. */
function programmerEnvoi(etat) {
  const entree = enAttente.get(etat.code) || { essais: 0, envoiEnCours: false };
  entree.etat = etat;

  clearTimeout(entree.minuteur);
  entree.minuteur = setTimeout(() => envoyer(etat.code), ANTI_REBOND_MS);

  enAttente.set(etat.code, entree);
  recalculerStatut();
}

/** Envoie réellement au serveur. Réessaie tout seul en cas d'échec. */
async function envoyer(code) {
  const entree = enAttente.get(code);
  if (!entree || entree.envoiEnCours) return;

  if (!navigator.onLine) {
    definirStatut('horsligne');
    return;                                 // on repartira sur l'événement 'online'
  }

  entree.envoiEnCours = true;
  const etatEnvoye = entree.etat;

  try {
    const sb = await client();

    // upsert : insère si la ligne n'existe pas, met à jour sinon. C'est ce qui
    // permet de rattraper un tournoi créé hors ligne, jamais inséré jusque-là.
    const { error } = await sb
      .from(TABLE)
      .upsert(etatVersLigne(etatEnvoye), { onConflict: 'code' });
    if (error) throw error;

    entree.envoiEnCours = false;

    // Si rien de neuf n'est arrivé pendant l'envoi, le tournoi est à jour.
    if (entree.etat === etatEnvoye) {
      enAttente.delete(code);
      majIndex(etatEnvoye, false);
    }
    recalculerStatut();
  } catch (err) {
    entree.envoiEnCours = false;
    entree.essais += 1;

    const attente = Math.min(
      RETENTATIVE_MIN_MS * 2 ** (entree.essais - 1),
      RETENTATIVE_MAX_MS
    );
    console.warn(
      `[storage] envoi échoué (essai ${entree.essais}), nouvelle tentative dans ${attente} ms`,
      err
    );

    definirStatut(navigator.onLine ? 'attente' : 'horsligne');
    clearTimeout(entree.minuteur);
    entree.minuteur = setTimeout(() => envoyer(code), attente);
  }
}

/**
 * Force l'envoi immédiat de tout ce qui attend, sans attendre les 800 ms.
 * À appeler avant une action importante — par exemple avant de lancer le
 * tirage, ou quand l'utilisateur quitte l'écran.
 */
export async function flushNow() {
  const codes = [...enAttente.keys()];
  for (const code of codes) {
    const entree = enAttente.get(code);
    if (entree) clearTimeout(entree.minuteur);
    await envoyer(code);
  }
  return statut;
}

/* ----------------------------------------------------------------------------
   4. SURVEILLER LES MODIFICATIONS D'UN AUTRE APPAREIL
   ----------------------------------------------------------------------------
   L'ordinateur de la table de marque et le téléphone qui court sur le terrain
   doivent voir la même chose. On interroge donc le serveur toutes les 15 s.

   Pourquoi pas le temps réel de Supabase ? Parce qu'il demande d'activer la
   réplication côté base, qu'il tient mal les coupures réseau à répétition, et
   que 15 s de latence sur un concours de pétanque, personne ne les voit passer.
   ---------------------------------------------------------------------------- */

/**
 * Surveille un tournoi. `callback(etatDistant)` est appelé uniquement quand le
 * serveur détient une version plus récente que la copie locale.
 * Renvoie une fonction pour arrêter la surveillance.
 */
export function watchTournament(code, callback) {
  const codeNet = normaliserCode(code);
  if (!codeNet) return () => {};

  let actif = true;

  async function verifier() {
    if (!actif || !navigator.onLine) return;

    // On ne va rien chercher tant que nos propres modifications n'ont pas été
    // envoyées : sinon on risquerait d'écraser le travail en cours.
    if (enAttente.has(codeNet)) return;

    // Inutile de solliciter le réseau si l'onglet est en arrière-plan.
    if (document.visibilityState === 'hidden') return;

    try {
      const sb = await client();
      const { data, error } = await sb
        .from(TABLE)
        .select('*')
        .eq('code', codeNet)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;

      const distant = ligneVersEtat(data);
      const local = lireLocal(cleTournoi(codeNet));

      if (!local || Date.parse(distant.updatedAt) > Date.parse(local.updatedAt || 0)) {
        ecrireLocal(cleTournoi(codeNet), distant);
        majIndex(distant, false);
        callback(distant);
      }
      definirStatut(enAttente.size ? 'attente' : 'synchronise');
    } catch (err) {
      console.warn('[storage] veille : serveur injoignable', err);
      definirStatut('horsligne');
    }
  }

  const minuteur = setInterval(verifier, INTERVALLE_VEILLE_MS);
  verifier();

  return () => {
    actif = false;
    clearInterval(minuteur);
  };
}

/* ----------------------------------------------------------------------------
   5. EXPORT DE SECOURS
   ----------------------------------------------------------------------------
   Le filet de sécurité : si Supabase est indisponible le jour J, on repart du
   fichier JSON téléchargé.
   ---------------------------------------------------------------------------- */

/** Déclenche le téléchargement de l'état complet du tournoi en JSON. */
export function exportTournament(etat) {
  const contenu = JSON.stringify(etat, null, 2);
  const blob = new Blob([contenu], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const jour = (etat.updatedAt || new Date().toISOString()).slice(0, 10);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `open-saint-come-${etat.code}-${jour}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();

  // On libère la mémoire, mais pas avant que le téléchargement soit parti.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ----------------------------------------------------------------------------
   RÉACTIONS AUX ÉVÉNEMENTS DU NAVIGATEUR
   ---------------------------------------------------------------------------- */

// Retour du réseau : on vide la file d'attente sans attendre.
window.addEventListener('online', () => {
  console.info('[storage] réseau retrouvé, envoi des modifications en attente');
  definirStatut(enAttente.size ? 'attente' : 'synchronise');
  for (const code of enAttente.keys()) envoyer(code);
});

window.addEventListener('offline', () => {
  console.info('[storage] réseau perdu, passage en mode local');
  definirStatut('horsligne');
});

// L'app passe en arrière-plan (l'organisateur verrouille son téléphone) :
// on tente un dernier envoi tant que la page est encore vivante.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && enAttente.size) flushNow();
});

/* ----------------------------------------------------------------------------
   NOTE POUR PLUS TARD — remplacer Supabase
   ----------------------------------------------------------------------------
   Six endroits, et six seulement, connaissent Supabase :
     · la fonction client()
     · ligneVersEtat() et etatVersLigne()
     · le insert de createTournament()
     · le select de loadTournament()
     · le upsert de envoyer()
     · le select de watchTournament()

   Pour brancher votre propre serveur, remplacez ces six appels par des fetch()
   vers vos routes. Toute la mécanique d'anti-rebond, de file d'attente, de
   retentative, de statut et d'arbitrage local/distant reste valable telle
   quelle : elle ne dépend d'aucune technologie particulière.
   ---------------------------------------------------------------------------- */
