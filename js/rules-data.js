/* ============================================================================
   rules-data.js — le texte de la page Règles.
   ----------------------------------------------------------------------------
   Une SYNTHÈSE rédigée pour l'occasion, pas une copie du règlement officiel.
   Le texte de la FFPJP n'est pas reproduit ici : la page se termine par un lien
   vers lui, et c'est lui qui fait foi en cas de litige.

   Le contenu est séparé de son affichage (views/regles.js) : on peut corriger
   une formulation sans toucher à une ligne de code d'interface.
   ============================================================================ */

export const INTRO =
  'De quoi trancher une discussion au bord du terrain. C’est une synthèse, ' +
  'volontairement ramassée : en cas de désaccord sérieux, c’est le règlement ' +
  'officiel de la FFPJP qui tranche.';

export const LIEN_FFPJP = {
  libelle: 'Règlement officiel de la FFPJP',
  url: 'https://www.ffpjp.info/',
  note: 'Le texte de référence, dans son intégralité. Rien n’en est reproduit ici.',
};

export const SECTIONS = [
  {
    id: 'terrain',
    titre: 'Le terrain et le cercle',
    paragraphes: [
      'On joue sur n’importe quel sol suffisamment praticable — la terre battue est le classique, mais l’herbe rase ou le gravier font l’affaire pour un concours de village.',
      'Tout part d’un cercle tracé au sol, de 35 à 50 cm de diamètre. Il doit se trouver à au moins un mètre de tout obstacle et de la limite du terrain.',
    ],
    points: [
      'Les deux pieds entièrement à l’intérieur du cercle, et posés au sol.',
      'On ne décolle ni ne déplace un pied, et on ne sort pas du cercle, tant que la boule lancée n’a pas touché le sol.',
      'Le cercle du coup suivant se trace à l’endroit où se trouvait le but.',
    ],
  },
  {
    id: 'but',
    titre: 'Le but',
    paragraphes: [
      'Le but — le bouchon, le cochonnet, le petit : les trois mots se disent — est la petite boule de bois que l’on cherche à approcher.',
      'Il est lancé depuis le cercle par un joueur de l’équipe qui commence.',
    ],
    points: [
      'Entre 6 et 10 mètres du cercle.',
      'À un mètre au moins de tout obstacle et de la limite du terrain.',
      'Il doit être visible du joueur debout dans le cercle, pieds joints.',
      'Trois lancers ratés, et c’est à l’équipe adverse de le placer — mais elle ne joue pas la première pour autant.',
    ],
  },
  {
    id: 'boules',
    titre: 'Combien de boules',
    paragraphes: [
      'Le nombre dépend de la formation, et c’est ce qui change le rythme d’une partie.',
    ],
    points: [
      'Tête-à-tête : 3 boules par joueur.',
      'Doublette : 3 boules par joueur — c’est notre formule.',
      'Triplette : 2 boules par joueur.',
    ],
  },
  {
    id: 'materiel',
    titre: 'Les boules',
    paragraphes: [
      'Une boule de compétition est en métal, marquée par son fabricant, et tient dans une fourchette assez étroite.',
    ],
    points: [
      'Poids : de 650 à 800 grammes.',
      'Diamètre : de 70,5 à 80 millimètres.',
      'Ni plombée, ni sablée, ni retouchée. Une gravure du nom du joueur est admise.',
    ],
  },
  {
    id: 'mene',
    titre: 'Le déroulement d’une mène',
    paragraphes: [
      'Une mène, c’est une manche courte : on joue toutes les boules, on compte, et on recommence ailleurs. La partie est une suite de mènes.',
      'L’équipe qui a lancé le but joue la première boule. Ensuite, la règle tient en une phrase : c’est toujours l’équipe qui n’a pas le point qui joue.',
      'Elle rejoue autant de fois qu’il faut, jusqu’à reprendre le point ou épuiser ses boules. Si elle n’a plus de boules, l’autre équipe joue les siennes.',
    ],
    points: [
      'Pointer : poser sa boule au plus près du but.',
      'Tirer : frapper une boule adverse pour l’écarter. Un « carreau » est un tir qui chasse la boule visée et laisse la sienne à sa place.',
      'On attend qu’une boule lancée soit complètement immobilisée avant de jouer la suivante.',
    ],
  },
  {
    id: 'comptage',
    titre: 'Le comptage',
    paragraphes: [
      'À la fin de la mène, une seule équipe marque : celle dont la boule est la plus proche du but.',
      'Elle compte toutes ses boules mieux placées que la meilleure boule adverse. Une seule, parfois ; six, dans les bons jours.',
    ],
    points: [
      'En cas d’égalité parfaite entre les deux meilleures boules, personne ne marque et la mène se rejoue depuis le même endroit.',
      'Mesurer est un droit : on peut demander la mesure à tout moment, avec un mètre, un compas, ou ce qu’on a sous la main.',
      'C’est à l’équipe qui prétend avoir le point de mesurer.',
    ],
  },
  {
    id: 'partie',
    titre: 'La partie',
    paragraphes: [
      'Une partie se joue en 13 points. La première équipe qui les atteint a gagné, quel que soit le nombre de mènes qu’il aura fallu.',
    ],
    points: [
      'Chaque mène rapporte de 1 à 6 points à une seule équipe.',
      'Il n’y a pas de « deux points d’écart » : 13 à 12 est un score parfaitement valide.',
    ],
  },
  {
    id: 'morts',
    titre: 'Boules et but morts',
    paragraphes: [
      'Une boule ou un but qui quitte le terrain autorisé sort du jeu. C’est la source de la moitié des discussions, d’où l’intérêt de fixer les limites avant de commencer.',
    ],
    points: [
      'Une boule sortie des limites est morte : elle est retirée et ne compte pas, même si elle revient en roulant.',
      'Si le but est chassé hors des limites et qu’aucune équipe n’a plus de boules, la mène est nulle et se rejoue.',
      'Si le but sort alors qu’une seule équipe a encore des boules, cette équipe marque autant de points qu’il lui reste de boules.',
      'Une boule déplacée par accident est remise à sa place. Déplacée par un joueur de son propre camp, elle est morte.',
    ],
  },
  {
    id: 'fautes',
    titre: 'Les fautes courantes',
    paragraphes: [
      'Rien ici n’est grave, et presque tout se règle à l’amiable. La progression des sanctions est la même partout : on avertit, puis on annule la boule, puis on exclut le joueur de la mène.',
    ],
    points: [
      'Sortir du cercle ou décoller un pied avant que la boule ne touche le sol.',
      'Jouer avant que la boule précédente ne soit immobilisée.',
      'Déplacer, aplanir ou creuser le sol du terrain avant de jouer — le terrain se prend tel qu’il est.',
      'Humidifier une boule ou le but.',
      'Faire durer : on dispose d’une minute pour jouer sa boule, à partir du moment où la précédente s’est arrêtée.',
    ],
  },
  {
    id: 'open',
    titre: 'Les règles de cet Open',
    paragraphes: [
      'Ce que le concours de Saint-Côme ajoute au règlement général — et qui vaut pour tout le monde, sans exception.',
    ],
    points: [
      'En doublette : deux joueurs par équipe, 3 boules chacun. Si l’effectif est impair, une seule équipe compte trois joueurs, avec 2 boules chacun.',
      'À la mêlée, dite « au chapeau » : on s’inscrit seul, les équipes sont formées par tirage au sort. Chaque nom est tiré au hasard ; deux noms consécutifs forment une équipe.',
      'Chaque rencontre se joue en deux manches gagnantes, chaque manche en 13 points. Une troisième manche n’est jouée qu’en cas d’égalité à une manche partout.',
      'Élimination directe. Quand le nombre d’équipes ne tombe pas juste, des exemptions sont tirées au sort au premier tour.',
      'Consolante : toute équipe qui perd son premier match joué bascule dans un second tableau. Tout le monde joue donc au moins deux fois.',
      'Il n’y a qu’un seul terrain, le terrain du Potager : les rencontres s’enchaînent l’une après l’autre.',
    ],
  },
];
