# Philosophie de design — Open de Saint-Côme

Ce document précède l'affiche et gouverne le CSS de l'application. Tout ce qui
sera dessiné ensuite — la page de garde, le chapeau, les tableaux — s'y réfère.
Quand un doute apparaît sur une décision visuelle, la réponse se trouve ici.

---

## 1. Le point de départ

Une contrainte, et elle n'est pas négociable : **l'app s'utilise à bout de bras,
au soleil de midi, sur un terrain en terre.** Pas assis, pas au calme, pas sur un
grand écran. Souvent d'une seule main. Parfois avec les doigts poussiéreux.

Tout découle de là. Ce n'est pas une app qu'on contemple, c'est un outil qu'on
consulte trois secondes entre deux mènes. La beauté, ici, c'est d'être lisible.

Le second point de départ est la palette : **combinaison n° 296 du dictionnaire
de Sanzo Wada, 1933.** Quatre encres, pas une de plus. Cette date compte : nous
sommes à l'époque de l'impression en aplats, où chaque couleur supplémentaire
coûtait un passage sous presse. C'est cette économie-là qu'on imite.

---

## 2. Les cinq principes

### 2.1 Quatre encres, en aplats

Crème `#f5ecc2`, argile `#d8a37b`, terre d'ombre `#71502f`, basalte `#34454c`.

**Aucun dégradé. Aucune transparence. Aucune ombre colorée.** Une surface a une
couleur, et elle l'a entièrement. Là où l'on serait tenté d'atténuer une teinte,
on change plutôt d'épaisseur de trait ou de taille : un filet fin lit clair, un
aplat lit dense, sans qu'aucune cinquième couleur soit apparue.

Cette règle a un bénéfice pratique inattendu : en plein soleil, les nuances
intermédiaires disparaissent de toute façon. Ne rester qu'avec des valeurs
franches, c'est rester lisible.

### 2.2 Le trait plutôt que la boîte

L'interface n'est pas faite de cartes empilées avec des ombres portées. Elle est
faite de **filets** — des lignes fines qui séparent, encadrent, alignent.

Un match est un bloc cerné d'un filet, pas une carte flottante. Une section se
distingue par une règle horizontale, pas par un fond gris. C'est plus proche
d'une feuille de match imprimée que d'un tableau de bord, et c'est voulu :
l'objet de référence de ce projet est le papier, pas le logiciel.

### 2.3 La hiérarchie par la taille, jamais par la couleur

Un seul texte est gros sur un écran : celui qui compte. Le nom qu'on vient de
tirer. Le score. L'équipe qui a gagné.

Tout le reste est au calme, dans une seule taille de corps. On ne colore pas un
mot pour l'accentuer, on ne met pas de gras partout. **Le regard doit tomber sur
la bonne chose sans qu'on l'ait décidé.**

Corollaire : l'argile ne surligne jamais du texte courant — d'abord parce qu'elle
n'a pas le contraste pour (4,49:1, sous le seuil), ensuite parce que surligner
c'est renoncer à hiérarchiser.

### 2.4 Le vide est une matière

Les marges sont larges, les respirations franches. Un écran de cette app affiche
peu de choses, mais il les affiche grand.

C'est un pari assumé : plutôt faire défiler que compresser. Quand quelqu'un
demande « on joue qui, là ? », la réponse doit se lire d'un coup d'œil à
soixante centimètres, pas se chercher dans une liste dense.

Rythme : **une unité de 8 pixels**, et tous les espacements en sont des
multiples. Aucune valeur intermédiaire, jamais. C'est ce qui fait qu'une
interface « tombe juste » sans qu'on sache dire pourquoi.

### 2.5 Deux voix typographiques, et pas trois

- **Une serif à fort caractère** (Hoefler Text, Didot) pour les titres et pour
  les noms tirés au chapeau. Elle porte la solennité du moment. Elle n'est
  jamais employée en petit : sa modulation de trait se perd en dessous de 24 px,
  et au soleil elle deviendrait illisible.
- **La sans-serif du système** pour absolument tout le reste, y compris les
  scores, avec les chiffres en chasse fixe pour que les colonnes ne dansent pas.

Rien n'est téléchargé. Sur un terrain sans réseau, une police distante qui ne
charge pas, c'est une mise en page qui s'effondre au pire moment.

---

## 3. Le sujet, traité comme une idée

La pétanque se prête au pire : boules dessinées, cochonnet souriant, guirlandes,
Provence de carte postale. Rien de tout cela ici.

Ce qui est retenu du jeu, c'est **sa géométrie** :

- **le cercle** de lancement, d'où tout part ;
- **la trajectoire**, un arc unique entre la main et le sol ;
- **le but**, un point minuscule qui organise tout l'espace autour de lui ;
- **la distance**, la seule chose que ce jeu mesure vraiment.

Une partie de pétanque, réduite à l'essentiel, c'est un diagramme de distances
autour d'un point. C'est ce diagramme qui sert de motif — sur l'affiche
directement, dans l'app par citation : le cercle du bouton de tirage, les filets
qui relient les tours d'un tableau, le point qui marque l'équipe qui mène.

**Règle d'application** : le motif ne doit jamais devenir une illustration. S'il
faut expliquer que c'est une boule, c'est raté ; s'il fonctionne comme une forme
juste et qu'on y reconnaît le jeu après coup, c'est réussi.

---

## 4. Les deux moments à soigner

Le reste de l'application peut être fonctionnel et sobre. Deux écrans doivent
être justes.

### Le chapeau

C'est le moment de suspense de la journée : trente personnes autour d'une table,
et un nom qui sort. L'écran doit être **presque vide** : un bouton, et le nom.

Le tirage dure environ une seconde et demie. Les noms défilent vite, ralentissent
selon une courbe de freinage — celle d'une roue qui s'arrête, pas d'une
temporisation logicielle — et **le nom s'arrête net**. Pas de fondu, pas de
rebond, pas de confetti. Le silence après le tirage fait partie de l'effet.

Entre les deux tirages d'une même équipe, l'écran affiche sans ambiguïté que ce
joueur attend son coéquipier. C'est là que se joue la compréhension du format.

### Le tableau

Un bracket lisible sur 380 px de large, c'est un problème réel : la vue
« arborescence » classique est illisible sur téléphone dès le deuxième tour.

**Décision : une vue tour par tour**, avec une navigation entre les tours, plutôt
qu'un défilement horizontal dans lequel on se perd. Un tour à la fois, en pleine
largeur, chaque match assez grand pour être lu debout. La progression d'une
équipe se comprend en avançant d'un tour, comme on tourne une page.

---

## 5. Ce qu'on s'interdit

Une liste courte, à relire avant chaque écran :

- Pas de dégradé, nulle part.
- Pas de violet, pas de bleu électrique, pas d'esthétique de tableau de bord.
- Pas d'ombre portée décorative — uniquement pour signaler qu'un élément est
  saisi sous le doigt.
- Pas d'icône décorative. Une icône n'existe que si elle remplace un mot plus
  long, jamais pour égayer.
- Pas de coins très arrondis : 2 à 8 px maximum. Les bulles appartiennent à la
  messagerie, pas à une feuille de match.
- Pas de majuscules pour crier. Les capitales sont réservées aux petites
  mentions, espacées, discrètes.
- Pas d'animation sans raison. La seule animation qui raconte quelque chose,
  c'est le tirage.
- Pas d'emoji.

---

## 6. Le critère de réussite

Une seule question, posée à chaque écran :

> **Est-ce que quelqu'un qui n'a jamais vu cette app, debout au soleil, comprend
> en trois secondes ce qu'il regarde et ce qu'il doit toucher ?**

Si oui, c'est bon. Si non, il faut enlever quelque chose — pas en ajouter.
