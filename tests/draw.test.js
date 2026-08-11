/* ============================================================================
   tests/draw.test.js — le chapeau.
   ----------------------------------------------------------------------------
   Le tirage est public : il se fait devant trente personnes, et son résultat
   engage la journée entière. Ces tests vérifient qu'il est honnête (tout le
   monde peut sortir, personne deux fois) et qu'une fausse manip se rattrape
   proprement.

   Pour les lancer :   node --test tests/
   ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  creerEtatInitial, ajouterJoueur, supprimerJoueur, renommerJoueur,
  doublons, demarrerTirage, peutTirer, problemeEffectif, definirTriplette,
  nomEquipe, renommerEquipe, cleNom,
} from '../js/state.js';
import {
  tirerUnNom, annulerDernierTirage, tirageTermine, manquePourCompleter,
  joueurEnAttente,
} from '../js/draw.js';
import { entierAleatoire, melangerCrypto } from '../js/bracket.js';

/* ----------------------------------------------------------------------------
   OUTILS
   ---------------------------------------------------------------------------- */

function avecJoueurs(noms) {
  let e = creerEtatInitial({ date: '2026-08-15' });
  for (const n of noms) e = ajouterJoueur(e, n).etat;
  return e;
}

const DIX = ['Anne', 'Bruno', 'Chloé', 'David', 'Élise', 'Franck', 'Gilles', 'Hélène', 'Inès', 'Jules'];

/* ============================================================================
   LE HASARD
   ============================================================================ */

test('le tirage d’un entier reste dans les bornes et couvre tout l’intervalle', () => {
  const vus = new Set();
  for (let i = 0; i < 3000; i++) {
    const v = entierAleatoire(7);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 7, `valeur hors bornes : ${v}`);
    vus.add(v);
  }
  // Sur 3000 tirages, les 7 valeurs doivent toutes être sorties. Si une seule
  // manque, c'est qu'il y a un biais grossier.
  assert.equal(vus.size, 7, 'certaines valeurs ne sortent jamais');
});

test('le mélange conserve exactement les mêmes éléments', () => {
  const depart = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let i = 0; i < 200; i++) {
    const melange = melangerCrypto(depart);
    assert.equal(melange.length, depart.length);
    assert.deepEqual([...melange].sort(), [...depart].sort(), 'un élément a été perdu ou dupliqué');
  }
});

test('le mélange ne renvoie pas toujours le même ordre', () => {
  const depart = [1, 2, 3, 4, 5, 6, 7, 8];
  const ordres = new Set();
  for (let i = 0; i < 60; i++) ordres.add(melangerCrypto(depart).join(','));
  assert.ok(ordres.size > 20, `seulement ${ordres.size} ordres différents sur 60 tirages`);
});

/* ============================================================================
   LA SAISIE DES JOUEURS
   ============================================================================ */

test('un nom vide est refusé, les espaces superflus sont retirés', () => {
  let e = creerEtatInitial({});

  const vide = ajouterJoueur(e, '   ');
  assert.ok(vide.erreur, 'un nom vide devrait être refusé');
  assert.equal(vide.etat.players.length, 0);

  e = ajouterJoueur(e, '  Jean-Michel   Durand  ').etat;
  assert.equal(e.players[0].name, 'Jean-Michel Durand');
});

test('les doublons sont repérés malgré les accents et la casse', () => {
  assert.equal(cleNom('Jean-Michel'), cleNom('JEAN MICHEL'));
  assert.equal(cleNom('Chloé'), cleNom('chloe'));
  assert.notEqual(cleNom('Marie'), cleNom('Maria'));

  let e = avecJoueurs(['Chloé', 'chloe', 'Bruno']);
  const trouves = doublons(e);
  assert.equal(trouves.length, 1);
  assert.equal(trouves[0].ids.length, 2);
});

test('renommer un joueur le renomme partout, y compris dans son équipe', () => {
  let e = avecJoueurs(['Jean-Micel', 'Sophie', 'Paul', 'Marie']);
  e = demarrerTirage(e);
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  const cible = e.players[0];
  e = renommerJoueur(e, cible.id, 'Jean-Michel');

  const sonEquipe = e.teams.find((t) => t.players.includes(cible.id));
  assert.ok(nomEquipe(e, sonEquipe).includes('Jean-Michel'),
    'le nom de l’équipe n’a pas suivi la correction');
});

test('l’effectif impair est signalé, et la triplette le résout', () => {
  let e = avecJoueurs(['A', 'B', 'C', 'D', 'E']);

  const souci = problemeEffectif(e);
  assert.equal(souci.type, 'impair');
  assert.ok(!peutTirer(e), 'le tirage ne devrait pas être possible');

  e = definirTriplette(e, true);
  assert.equal(problemeEffectif(e), null);
  assert.ok(peutTirer(e));
});

test('en dessous de quatre joueurs, il n’y a pas de tournoi', () => {
  const e = avecJoueurs(['A', 'B']);
  assert.equal(problemeEffectif(e).type, 'trop-peu');
  assert.ok(!peutTirer(e));
});

/* ============================================================================
   LE TIRAGE
   ============================================================================ */

test('chaque joueur sort une fois et une seule', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  const attendus = e.players.map((j) => j.id).sort();

  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  assert.deepEqual([...e.draw.order].sort(), attendus, 'l’ordre de sortie ne correspond pas');
  assert.equal(new Set(e.draw.order).size, 10, 'un joueur est sorti deux fois');
  assert.equal(e.draw.remaining.length, 0);
  assert.ok(tirageTermine(e));
});

test('les équipes se forment deux par deux, dans l’ordre de sortie', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  assert.equal(e.teams.length, 5);
  e.teams.forEach((equipe, i) => {
    assert.deepEqual(equipe.players, e.draw.order.slice(i * 2, i * 2 + 2));
    assert.ok(equipe.complete);
  });
});

test('entre deux tirages, le joueur attend clairement son coéquipier', () => {
  let e = demarrerTirage(avecJoueurs(DIX));

  e = tirerUnNom(e).etat;
  assert.equal(manquePourCompleter(e), 1, 'il devrait manquer un coéquipier');
  assert.equal(joueurEnAttente(e), e.draw.order[0]);
  assert.equal(e.draw.pending, e.draw.order[0]);
  assert.ok(!e.teams[0].complete);

  e = tirerUnNom(e).etat;
  assert.equal(manquePourCompleter(e), 0);
  assert.equal(e.draw.pending, null);
  assert.ok(e.teams[0].complete);
});

test('la triplette est complétée en dernier, avec trois joueurs', () => {
  let e = avecJoueurs(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  e = definirTriplette(e, true);
  e = demarrerTirage(e);
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  assert.equal(e.teams.length, 3);
  assert.deepEqual(e.teams.map((t) => t.players.length), [2, 2, 3]);
  assert.ok(tirageTermine(e));
});

/* ============================================================================
   ANNULER
   ============================================================================ */

test('annuler remet le dernier nom dans le chapeau', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  e = tirerUnNom(e).etat;
  e = tirerUnNom(e).etat;
  e = tirerUnNom(e).etat;

  const avant = e.draw.order[2];
  e = annulerDernierTirage(e);

  assert.equal(e.draw.order.length, 2);
  assert.ok(e.draw.remaining.includes(avant), 'le joueur n’est pas revenu dans le chapeau');
  assert.equal(e.draw.remaining.length, 8);
  assert.equal(e.teams.length, 1, 'l’équipe entamée aurait dû disparaître');
});

test('annuler défait une équipe complète sans en perdre les joueurs', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  e = tirerUnNom(e).etat;
  e = tirerUnNom(e).etat;
  assert.ok(e.teams[0].complete);

  e = annulerDernierTirage(e);
  assert.equal(e.teams.length, 1);
  assert.ok(!e.teams[0].complete, 'l’équipe devrait être redevenue incomplète');
  assert.equal(e.draw.order.length + e.draw.remaining.length, 10, 'un joueur a disparu');
});

test('annuler après la fin rouvre le chapeau', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;
  assert.equal(e.draw.status, 'termine');

  e = annulerDernierTirage(e);
  assert.equal(e.draw.status, 'encours');
  assert.ok(!tirageTermine(e));
  assert.equal(e.draw.remaining.length, 1);
});

test('annuler quand rien n’a été tiré ne casse rien', () => {
  const e = demarrerTirage(avecJoueurs(DIX));
  const apres = annulerDernierTirage(e);
  assert.deepEqual(apres.draw.order, []);
  assert.equal(apres.draw.remaining.length, 10);
});

test('un nom d’équipe personnalisé survit aux tirages suivants', () => {
  let e = demarrerTirage(avecJoueurs(DIX));
  e = tirerUnNom(e).etat;
  e = tirerUnNom(e).etat;

  e = renommerEquipe(e, e.teams[0].id, 'Les Cousins');
  const idEquipe = e.teams[0].id;

  e = tirerUnNom(e).etat;
  e = tirerUnNom(e).etat;

  assert.equal(e.teams[0].id, idEquipe, 'l’identifiant de l’équipe a changé');
  assert.equal(nomEquipe(e, e.teams[0]), 'Les Cousins', 'le nom personnalisé a été perdu');
});

/* ============================================================================
   LA LISTE EST CLOSE PENDANT LE TIRAGE
   ============================================================================ */

test('on ne peut plus ajouter ni retirer un joueur une fois le tirage lancé', () => {
  let e = demarrerTirage(avecJoueurs(DIX));

  const ajout = ajouterJoueur(e, 'Retardataire');
  assert.ok(ajout.erreur, 'l’ajout aurait dû être refusé');
  assert.equal(ajout.etat.players.length, 10);

  const apres = supprimerJoueur(e, e.players[0].id);
  assert.equal(apres.players.length, 10, 'la suppression aurait dû être refusée');
});

test('démarrer le tirage est refusé si l’effectif ne convient pas', () => {
  const impair = avecJoueurs(['A', 'B', 'C', 'D', 'E']);
  assert.equal(demarrerTirage(impair).draw.status, 'idle');

  const troisJoueurs = avecJoueurs(['A', 'B', 'C']);
  assert.equal(demarrerTirage(troisJoueurs).draw.status, 'idle');
});
