/* ============================================================================
   tests/bracket.test.js — la construction et la vie des tableaux.
   ----------------------------------------------------------------------------
   POURQUOI CES TESTS EXISTENT.
   Le placement des byes et la progression en cascade sont les deux endroits où
   les applications de tournoi cassent, et elles cassent SILENCIEUSEMENT : le
   tableau s'affiche, il a l'air normal, et c'est seulement en demi-finale que
   quelqu'un s'aperçoit qu'une équipe joue deux fois ou a disparu.

   Ces tests vérifient donc des PROPRIÉTÉS, pas des positions exactes : le
   placement est tiré au sort à chaque exécution, il ne peut pas être comparé à
   un résultat figé. Ce qui doit rester vrai, en revanche, l'est à tous les
   coups.

   Pour les lancer :   node --test tests/
   ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  creerEtatInitial, ajouterJoueur, definirTriplette, demarrerTirage, planEquipes,
} from '../js/state.js';
import { tirerUnNom } from '../js/draw.js';
import {
  puissanceDeDeuxSuperieure, nombreDeTours, ordreDesTetes, construireTableau,
  creerTableauPrincipal, matchsDuTour, idMatch, filAttente, enregistrerManches,
  podium, validerManche, resultatMatch, matchsAvalDejaJoues,
  perdantsPremierMatch, consolantePrete, consolanteObsolete, nomDuTour,
} from '../js/bracket.js';

/* ----------------------------------------------------------------------------
   OUTILS
   ---------------------------------------------------------------------------- */

/** Un tournoi prêt à jouer, avec n équipes déjà formées et le tableau tiré. */
function tournoiA(n) {
  let e = creerEtatInitial({ date: '2026-08-15' });
  for (let i = 0; i < n; i++) {
    e.teams.push({ id: `t${i + 1}`, players: [], name: `Éq.${i + 1}`, complete: true });
  }
  return creerTableauPrincipal(e);
}

/** Joue tous les matchs disponibles ; `gagnantA` décide qui l'emporte. */
function jouerTout(etat, gagnantA = () => true) {
  let e = etat;
  let garde = 0;
  while (garde++ < 200) {
    const m = filAttente(e)[0];
    if (!m) break;
    const manches = gagnantA(m)
      ? [{ a: 13, b: 7 }, { a: 13, b: 9 }]
      : [{ a: 7, b: 13 }, { a: 9, b: 13 }];
    e = enregistrerManches(e, m.id, manches);
  }
  return e;
}

const TAILLES = [3, 5, 8, 11, 16];

/* ============================================================================
   LES OUTILS DE BASE
   ============================================================================ */

test('la puissance de 2 supérieure', () => {
  assert.equal(puissanceDeDeuxSuperieure(1), 1);
  assert.equal(puissanceDeDeuxSuperieure(3), 4);
  assert.equal(puissanceDeDeuxSuperieure(5), 8);
  assert.equal(puissanceDeDeuxSuperieure(8), 8);
  assert.equal(puissanceDeDeuxSuperieure(11), 16);
  assert.equal(puissanceDeDeuxSuperieure(16), 16);
  assert.equal(puissanceDeDeuxSuperieure(17), 32);
});

test('le nombre de tours', () => {
  assert.equal(nombreDeTours(4), 2);
  assert.equal(nombreDeTours(8), 3);
  assert.equal(nombreDeTours(16), 4);
});

test('l’ordre de bracket oppose toujours le premier au dernier', () => {
  for (const taille of [2, 4, 8, 16, 32]) {
    const ordre = ordreDesTetes(taille);

    assert.equal(ordre.length, taille, `taille ${taille}`);
    assert.equal(new Set(ordre).size, taille, `taille ${taille} : numéros en double`);

    // C'est LA propriété dont tout le placement des byes découle : dans chaque
    // match du premier tour, la somme des deux numéros vaut taille + 1.
    for (let p = 0; p < taille / 2; p++) {
      assert.equal(
        ordre[p * 2] + ordre[p * 2 + 1],
        taille + 1,
        `taille ${taille}, match ${p}`
      );
    }
  }
});

/* ============================================================================
   LA CONSTRUCTION DU TABLEAU
   ============================================================================ */

for (const n of TAILLES) {
  test(`${n} équipes — le tableau a la bonne forme`, () => {
    const e = tournoiA(n);
    const b = e.brackets.main;
    const attendu = puissanceDeDeuxSuperieure(n);

    assert.equal(b.size, attendu);
    assert.equal(b.tours, nombreDeTours(attendu));
    assert.equal(b.byes, attendu - n);
    assert.equal(b.seeds.length, attendu);
  });

  test(`${n} équipes — chaque équipe est placée une fois et une seule`, () => {
    const e = tournoiA(n);
    const placees = e.brackets.main.seeds.filter(Boolean);

    assert.equal(placees.length, n, 'des équipes manquent ou sont en trop');
    assert.equal(new Set(placees).size, n, 'une équipe apparaît deux fois');

    for (const equipe of e.teams) {
      assert.ok(placees.includes(equipe.id), `${equipe.name} n’est pas dans le tableau`);
    }
  });

  test(`${n} équipes — le bon nombre de byes, et aucun match vide`, () => {
    const e = tournoiA(n);
    const b = e.brackets.main;
    const tour1 = matchsDuTour(e, 'main', 1);

    const byes = tour1.filter((m) => m.status === 'bye');
    const vrais = tour1.filter((m) => m.status === 'pret');

    assert.equal(byes.length, b.byes, 'nombre de byes incohérent');
    assert.equal(byes.length + vrais.length, tour1.length, 'un match sans statut clair');

    // Un match sans personne des deux côtés serait une case perdue.
    for (const m of tour1) {
      assert.ok(m.teamA || m.teamB, `le match ${m.id} n’a aucune équipe`);
    }

    // Une équipe exemptée est qualifiée d'office, sans score à saisir.
    for (const m of byes) {
      assert.ok(m.winner, 'un bye sans vainqueur');
      assert.equal(m.sets.length, 0, 'un bye ne se saisit pas');
    }
  });

  test(`${n} équipes — les byes sont répartis dans les deux moitiés`, () => {
    const e = tournoiA(n);
    const tour1 = matchsDuTour(e, 'main', 1);
    const byes = tour1.filter((m) => m.status === 'bye');

    const moitie = tour1.length / 2;
    const haut = byes.filter((m) => m.position < moitie).length;
    const bas = byes.length - haut;

    // C'est le cœur du sujet : sans cette propriété, une demi-tableau se vide
    // pendant que l'autre s'épuise.
    assert.ok(
      Math.abs(haut - bas) <= 1,
      `répartition déséquilibrée : ${haut} en haut, ${bas} en bas`
    );
  });

  test(`${n} équipes — aucune équipe n’est exemptée deux fois`, () => {
    const e = tournoiA(n);
    const exemptees = matchsDuTour(e, 'main', 1)
      .filter((m) => m.status === 'bye')
      .map((m) => m.winner);
    assert.equal(new Set(exemptees).size, exemptees.length);
  });
}

/* ============================================================================
   LA PROGRESSION
   ============================================================================ */

for (const n of TAILLES) {
  test(`${n} équipes — le tournoi va jusqu’à la finale et donne un podium`, () => {
    const e = jouerTout(tournoiA(n));
    const b = e.brackets.main;

    const finale = e.matches[idMatch('main', b.tours, 0)];
    assert.equal(finale.status, 'termine', 'la finale n’a pas été jouée');

    const p = podium(e, 'main');
    assert.ok(p, 'pas de podium');
    assert.ok(p.premier && p.deuxieme, 'podium incomplet');
    assert.notEqual(p.premier, p.deuxieme, 'la même équipe est 1re et 2e');

    // Il ne doit plus rien rester à jouer dans le tableau principal.
    for (let r = 1; r <= b.tours; r++) {
      for (const m of matchsDuTour(e, 'main', r)) {
        assert.notEqual(m.status, 'pret', `${m.id} reste à jouer`);
      }
    }
  });

  test(`${n} équipes — le vainqueur d’un match se retrouve bien au tour suivant`, () => {
    const e = jouerTout(tournoiA(n));
    const b = e.brackets.main;

    for (let r = 1; r < b.tours; r++) {
      for (const m of matchsDuTour(e, 'main', r)) {
        if (!m.winner) continue;
        const suivant = e.matches[idMatch('main', r + 1, Math.floor(m.position / 2))];
        const place = m.position % 2 === 0 ? suivant.teamA : suivant.teamB;
        assert.equal(place, m.winner, `${m.id} : le vainqueur n’est pas remonté`);
      }
    }
  });
}

test('une équipe ne peut pas jouer contre elle-même', () => {
  for (const n of TAILLES) {
    const e = jouerTout(tournoiA(n));
    for (const m of Object.values(e.matches)) {
      if (m.teamA && m.teamB) {
        assert.notEqual(m.teamA, m.teamB, `${m.id} : la même équipe des deux côtés`);
      }
    }
  }
});

/* ============================================================================
   LA CORRECTION EN CASCADE
   ============================================================================ */

test('corriger un score du premier tour recalcule la suite', () => {
  const depart = tournoiA(8);            // 8 équipes : aucun bye, tout est net
  const joue = jouerTout(depart);

  const premier = matchsDuTour(joue, 'main', 1)[0];
  const ancienVainqueur = premier.winner;

  // Avant correction : des matchs en aval contiennent des scores.
  const aval = matchsAvalDejaJoues(joue, premier.id);
  assert.ok(aval.length > 0, 'le test suppose des matchs joués en aval');

  // On inverse le résultat.
  const corrige = enregistrerManches(joue, premier.id, [{ a: 7, b: 13 }, { a: 9, b: 13 }]);
  const nouveau = corrige.matches[premier.id].winner;

  assert.notEqual(nouveau, ancienVainqueur, 'le vainqueur n’a pas changé');

  // Le match suivant doit accueillir le NOUVEAU vainqueur, et son score doit
  // avoir été effacé : il opposait deux autres équipes.
  const suivant = corrige.matches[idMatch('main', 2, Math.floor(premier.position / 2))];
  const place = premier.position % 2 === 0 ? suivant.teamA : suivant.teamB;
  assert.equal(place, nouveau);
  assert.equal(suivant.sets.length, 0, 'le score du tour suivant n’a pas été effacé');
});

test('corriger un match n’efface pas les matchs qui ne le concernent pas', () => {
  const joue = jouerTout(tournoiA(8));
  const tour1 = matchsDuTour(joue, 'main', 1);

  // Le match 0 alimente la demi-finale 0 ; le match 3 alimente la demi-finale 1.
  const temoin = joue.matches[idMatch('main', 2, 1)];
  assert.ok(temoin.sets.length > 0, 'le test suppose ce match joué');

  const corrige = enregistrerManches(joue, tour1[0].id, [{ a: 7, b: 13 }, { a: 9, b: 13 }]);
  const temoinApres = corrige.matches[idMatch('main', 2, 1)];

  assert.deepEqual(temoinApres.sets, temoin.sets, 'un match sans rapport a été effacé');
});

test('réenregistrer le même score ne change rien', () => {
  const joue = jouerTout(tournoiA(8));
  const premier = matchsDuTour(joue, 'main', 1)[0];
  const memes = premier.sets.map((m) => ({ ...m }));

  const apres = enregistrerManches(joue, premier.id, memes);
  assert.deepEqual(apres.matches, joue.matches, 'le tableau a bougé sans raison');
});

/* ============================================================================
   LES SCORES
   ============================================================================ */

test('une manche n’est valide que si le vainqueur est à 13', () => {
  assert.ok(validerManche(13, 7).ok);
  assert.ok(validerManche(0, 13).ok);
  assert.ok(validerManche(13, 12).ok);

  assert.ok(!validerManche(12, 7).ok, '12-7 devrait être refusé');
  assert.ok(!validerManche(13, 13).ok, 'une égalité devrait être refusée');
  assert.ok(!validerManche(14, 3).ok, 'on ne dépasse pas 13');
  assert.ok(!validerManche(13, -1).ok, 'pas de score négatif');
  assert.ok(!validerManche(13, null).ok, 'un score manquant devrait être refusé');
});

test('le match se joue au meilleur des trois manches', () => {
  const config = { setsToWin: 2, pointsPerSet: 13 };

  const deuxZero = resultatMatch([{ a: 13, b: 5 }, { a: 13, b: 9 }], config);
  assert.equal(deuxZero.vainqueur, 'A');
  assert.ok(deuxZero.termine);

  const enCours = resultatMatch([{ a: 13, b: 5 }], config);
  assert.equal(enCours.vainqueur, null);
  assert.ok(!enCours.termine);

  const belle = resultatMatch([{ a: 13, b: 5 }, { a: 9, b: 13 }, { a: 11, b: 13 }], config);
  assert.equal(belle.vainqueur, 'B');
  assert.equal(belle.manchesB, 2);
});

test('une troisième manche saisie par erreur après un 2-0 est ignorée', () => {
  const e = tournoiA(8);
  const m = filAttente(e)[0];
  const apres = enregistrerManches(e, m.id, [
    { a: 13, b: 5 }, { a: 13, b: 9 }, { a: 13, b: 2 },   // la 3e n'a pas lieu d'être
  ]);
  assert.equal(apres.matches[m.id].sets.length, 2, 'la manche en trop a été gardée');
});

/* ============================================================================
   LA CONSOLANTE
   ============================================================================ */

test('8 équipes — la consolante prend les 4 perdants du premier tour', () => {
  const e = tournoiA(8);
  assert.ok(!consolantePrete(e), 'prête avant d’avoir joué');

  // On joue uniquement le premier tour.
  let apres = e;
  for (const m of matchsDuTour(e, 'main', 1)) {
    apres = enregistrerManches(apres, m.id, [{ a: 13, b: 7 }, { a: 13, b: 9 }]);
  }

  const perdants = perdantsPremierMatch(apres);
  assert.equal(perdants.length, 4);
  assert.ok(apres.brackets.consolante, 'la consolante ne s’est pas créée');
  assert.equal(apres.brackets.consolante.seeds.filter(Boolean).length, 4);
});

test('11 équipes — la consolante attend le deuxième tour à cause des byes', () => {
  const e = tournoiA(11);   // tableau de 16, 5 byes, seulement 3 vrais matchs

  let apres = e;
  for (const m of matchsDuTour(e, 'main', 1)) {
    if (m.status !== 'pret') continue;
    apres = enregistrerManches(apres, m.id, [{ a: 13, b: 7 }, { a: 13, b: 9 }]);
  }

  // Trois perdants seulement : les équipes exemptées n'ont pas encore joué.
  assert.equal(perdantsPremierMatch(apres).length, 3);
  assert.ok(!consolantePrete(apres), 'la consolante ne doit pas être prête');
  assert.equal(apres.brackets.consolante, null);

  // Après le deuxième tour, tout le monde a joué au moins une fois.
  for (const m of matchsDuTour(apres, 'main', 2)) {
    if (m.status !== 'pret') continue;
    apres = enregistrerManches(apres, m.id, [{ a: 13, b: 7 }, { a: 13, b: 9 }]);
  }

  assert.ok(apres.brackets.consolante, 'la consolante aurait dû se créer');
  const inscrits = apres.brackets.consolante.seeds.filter(Boolean);
  assert.ok(inscrits.length >= 4, `seulement ${inscrits.length} équipes en consolante`);

  // Personne ne doit y figurer deux fois.
  assert.equal(new Set(inscrits).size, inscrits.length);
});

test('personne ne joue la consolante après avoir gagné un match', () => {
  const e = jouerTout(tournoiA(11));
  const consolante = e.brackets.consolante;
  assert.ok(consolante, 'pas de consolante');

  for (const idEquipe of consolante.seeds.filter(Boolean)) {
    // Chaque inscrit doit avoir perdu son premier match : il ne peut donc pas
    // apparaître comme vainqueur d'un match du premier ou du deuxième tour.
    for (const r of [1, 2]) {
      for (const m of matchsDuTour(e, 'main', r)) {
        if (m.status === 'termine' && m.winner === idEquipe) {
          // Il a gagné à ce tour : ce n'était donc pas son premier match perdu.
          const aPerduAvant = matchsDuTour(e, 'main', 1)
            .some((x) => x.status === 'termine' && x.winner !== idEquipe
              && (x.teamA === idEquipe || x.teamB === idEquipe));
          assert.ok(aPerduAvant, 'une équipe en consolante a gagné son premier match');
        }
      }
    }
  }
});

test('la consolante est signalée comme obsolète après une correction', () => {
  const joue = jouerTout(tournoiA(8));
  assert.ok(joue.brackets.consolante);
  assert.ok(!consolanteObsolete(joue), 'obsolète sans raison');

  const premier = matchsDuTour(joue, 'main', 1)[0];
  const corrige = enregistrerManches(joue, premier.id, [{ a: 7, b: 13 }, { a: 9, b: 13 }]);

  assert.ok(consolanteObsolete(corrige), 'l’incohérence n’a pas été détectée');
});

/* ============================================================================
   LES LIBELLÉS
   ============================================================================ */

test('les tours portent le bon nom', () => {
  assert.equal(nomDuTour(4, 4), 'Finale');
  assert.equal(nomDuTour(4, 3), 'Demi-finales');
  assert.equal(nomDuTour(4, 2), 'Quarts de finale');
  assert.equal(nomDuTour(4, 1), 'Huitièmes de finale');
  assert.equal(nomDuTour(2, 1), 'Demi-finales');
  assert.equal(nomDuTour(1, 1), 'Finale');
});

/* ============================================================================
   UN TOURNOI COMPLET, DEPUIS LES JOUEURS
   ============================================================================ */

test('de la saisie des joueurs au podium, sans rien casser', () => {
  let e = creerEtatInitial({ date: '2026-08-15' });
  for (const nom of ['Anne', 'Bruno', 'Chloé', 'David', 'Élise', 'Franck', 'Gilles', 'Hélène', 'Inès', 'Jules']) {
    e = ajouterJoueur(e, nom).etat;
  }

  assert.equal(planEquipes(e).nbEquipes, 5);

  e = demarrerTirage(e);
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  assert.equal(e.teams.length, 5);
  assert.ok(e.teams.every((t) => t.complete && t.players.length === 2));

  // Chaque joueur est dans une équipe, et dans une seule.
  const tousLesJoueurs = e.teams.flatMap((t) => t.players);
  assert.equal(tousLesJoueurs.length, 10);
  assert.equal(new Set(tousLesJoueurs).size, 10);

  e = creerTableauPrincipal(e);
  e = jouerTout(e);

  assert.ok(podium(e, 'main'), 'pas de podium principal');
  assert.ok(e.brackets.consolante, 'pas de consolante');
});

test('effectif impair — la triplette est la dernière équipe formée', () => {
  let e = creerEtatInitial({});
  for (const nom of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
    e = ajouterJoueur(e, nom).etat;
  }

  assert.equal(planEquipes(e), null, '9 joueurs sans triplette devrait être refusé');

  e = definirTriplette(e, true);
  const plan = planEquipes(e);
  assert.equal(plan.nbEquipes, 4);
  assert.deepEqual(plan.tailles, [2, 2, 2, 3]);

  e = demarrerTirage(e);
  while (e.draw.remaining.length) e = tirerUnNom(e).etat;

  assert.equal(e.teams.length, 4);
  assert.equal(e.teams[3].players.length, 3, 'la dernière équipe devrait être une triplette');
  assert.ok(e.teams.slice(0, 3).every((t) => t.players.length === 2));
});
