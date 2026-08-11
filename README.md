# Open de Saint-Côme

Application web pour organiser un concours de pétanque **en doublettes à la mêlée**
(« au chapeau ») : inscription des joueurs, tirage au sort des équipes, tableau
principal à élimination directe et tableau de consolante.

Conçue pour l'Open de Saint-Côme, le week-end du 15 août, à Saint-Côme-d'Olt (Aveyron).

L'app est pensée pour être utilisée **au doigt, sur un téléphone, en plein soleil,
au bord du terrain** : gros boutons, contrastes forts, et fonctionnement même quand
le réseau saute.

---

## Sommaire

1. [Ce dont vous avez besoin](#1-ce-dont-vous-avez-besoin)
2. [Installer le projet sur votre ordinateur](#2-installer-le-projet-sur-votre-ordinateur)
3. [Configurer Supabase (la base de données)](#3-configurer-supabase-la-base-de-données)
4. [Faire tourner le site en local](#4-faire-tourner-le-site-en-local)
5. [Mettre le site en ligne avec GitHub Pages](#5-mettre-le-site-en-ligne-avec-github-pages)
6. [Utiliser l'application le jour du tournoi](#6-utiliser-lapplication-le-jour-du-tournoi)
7. [Lancer les tests](#7-lancer-les-tests)
8. [Comment le projet est organisé](#8-comment-le-projet-est-organisé)
9. [Questions fréquentes et pannes courantes](#9-questions-fréquentes-et-pannes-courantes)

---

## 1. Ce dont vous avez besoin

| Outil | À quoi ça sert | Comment vérifier |
| --- | --- | --- |
| **Git** | Enregistrer les versions du code et l'envoyer sur GitHub | `git --version` dans le Terminal |
| **Un compte GitHub** | Héberger le code et publier le site gratuitement | https://github.com |
| **Un compte Supabase** | La base de données qui synchronise les appareils | https://supabase.com |
| **Node.js** (facultatif) | Uniquement pour lancer les tests | `node --version` |

**Aucun autre outil n'est nécessaire.** Ce projet est en HTML, CSS et JavaScript
« vanilla » (c'est-à-dire sans framework) : il n'y a **rien à installer, rien à
compiler, aucune commande `npm`**. Les fichiers que vous voyez sont exactement
ceux qu'exécute le navigateur.

> **Vocabulaire**
> - **Dépôt** (*repository*) : le dossier du projet, suivi par Git, avec tout son historique.
> - **Commit** : une photo du projet à un instant donné, avec un message décrivant le changement.
> - **Branche** : une ligne d'historique. Ici, tout se passe sur la branche `main`.
> - **Push** : envoyer vos commits vers GitHub.

---

## 2. Installer le projet sur votre ordinateur

Ouvrez le Terminal et tapez, ligne par ligne :

```bash
cd ~/Projets
git clone https://github.com/leccof/open-saint-come.git
cd open-saint-come
```

- `cd` : se déplacer dans un dossier.
- `git clone` : télécharger une copie complète du dépôt, avec son historique.

---

## 3. Configurer Supabase (la base de données)

Supabase héberge un ordinateur qui garde l'état du tournoi, pour que le téléphone
et l'ordinateur voient la même chose.

### 3.1 Récupérer vos deux valeurs de connexion

1. Allez sur https://supabase.com/dashboard et ouvrez votre projet.
2. Menu de gauche, tout en bas : **Project Settings** (l'engrenage).
3. Cliquez sur **API Keys**.
4. Notez la **Project URL** (`https://xxxxxxxx.supabase.co`).
5. Notez la clé **publishable** (`sb_publishable_...`) ou **anon / public** (`eyJ...`).

> ⚠️ **Ne copiez jamais la clé `secret` / `service_role`.** Celle-là contourne
> toutes les règles de sécurité. Elle n'a sa place que sur un serveur, jamais
> dans un site web ni dans un dépôt Git.

### 3.2 Écrire ces valeurs dans `config.js`

Copiez `config.example.js` sous le nom `config.js` et remplacez les deux valeurs :

```bash
cp config.example.js config.js
```

Puis ouvrez `config.js` et collez votre URL et votre clé.

> **Pourquoi `config.js` est-il publié sur GitHub ?**
> Parce que le site est **statique** : il n'y a pas de serveur pour cacher quoi que
> ce soit. Le navigateur de chaque visiteur doit lire ces valeurs pour joindre la
> base. C'est prévu ainsi : la clé publiable est publique par conception, et la
> sécurité est assurée par les règles **RLS** décrites juste en dessous.
>
> **RLS** (*Row Level Security*) : des règles définies dans Supabase qui décident,
> ligne par ligne, qui a le droit de lire ou d'écrire quoi.

### 3.3 Créer la table `tournaments`

1. Dans le dashboard Supabase, menu de gauche : **SQL Editor**.
2. Cliquez sur **New query**.
3. Collez le bloc ci-dessous et cliquez sur **Run**.

```sql
-- Une ligne = un tournoi. Tout l'état (joueurs, équipes, tableaux, scores)
-- tient dans une seule colonne JSON, ce qui rend le schéma très simple.
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  name        text not null,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Recherche rapide d'un tournoi par son code à 6 caractères.
create index if not exists tournaments_code_idx on public.tournaments (code);

-- Activation des règles de sécurité ligne par ligne.
alter table public.tournaments enable row level security;

-- Il n'y a pas de comptes utilisateurs : qui connaît le code à 6 caractères
-- peut consulter et modifier le tournoi. Le code joue le rôle de mot de passe.
create policy "lecture publique"   on public.tournaments for select using (true);
create policy "creation publique"  on public.tournaments for insert with check (true);
create policy "modification publique" on public.tournaments for update using (true);
```

> **Ce que ce SQL veut dire, en clair** : on crée un tableau à 5 colonnes, on
> ajoute un index pour retrouver vite un tournoi par son code, puis on autorise
> tout le monde à lire, créer et modifier. C'est un choix assumé : l'app n'a pas
> de système de comptes, et le code à 6 caractères sert de clé d'accès. Pour un
> concours de village, c'est le bon compromis entre simplicité et sécurité.

---

## 4. Faire tourner le site en local

On ne peut pas se contenter de double-cliquer sur `index.html` : le projet utilise
les **modules ES** (le mécanisme standard qui permet à un fichier JavaScript d'en
importer un autre), et les navigateurs les refusent quand la page est ouverte
directement depuis le disque. Il faut un petit serveur local.

```bash
cd ~/Projets/open-saint-come
python3 -m http.server 8000
```

Puis ouvrez http://localhost:8000 dans votre navigateur.

Pour arrêter le serveur : `Ctrl + C` dans le Terminal.

> `python3 -m http.server` est fourni d'origine avec macOS : rien à installer.

---

## 5. Mettre le site en ligne avec GitHub Pages

**GitHub Pages** publie gratuitement les fichiers d'un dépôt sous forme de site web.

1. Envoyez votre code : `git add .` puis `git commit -m "message"` puis `git push`
2. Allez sur https://github.com/leccof/open-saint-come
3. Cliquez sur l'onglet **Settings** (en haut à droite du dépôt)
4. Dans le menu de gauche, cliquez sur **Pages**
5. Section **Build and deployment** → **Source** : choisissez **Deploy from a branch**
6. **Branch** : sélectionnez `main`, et le dossier `/ (root)`
7. Cliquez sur **Save**
8. Attendez une à deux minutes, puis rechargez la page

L'adresse publique du site sera :

```
https://leccof.github.io/open-saint-come/
```

> **Important pour les chemins** : le site n'est pas à la racine du domaine mais
> dans un sous-dossier `/open-saint-come/`. Tous les liens du projet sont donc
> **relatifs** (`./css/app.css` et non `/css/app.css`). Un chemin commençant par
> `/` chercherait à la racine de `leccof.github.io` et donnerait une page blanche.

---

## 5 bis. La fiche à imprimer

`design/fiche.pdf` est une feuille A4 à scotcher sur la table de marque : le
QR code du tournoi, le code à six caractères, et les trois étapes pour
rejoindre. Scanner le QR ouvre le tournoi directement, sans rien saisir.

Pour la refaire avec un autre tournoi :

```bash
python3 design/fiche.py ABC123      # ou sans code : cases vides à remplir au feutre
cd design
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --no-pdf-header-footer --print-to-pdf=fiche.pdf "file://$PWD/fiche.html"
```

> `design/qr.py` et `design/fiche.py` sont des **outils de conception**. Rien
> de tout cela ne part dans le navigateur : l'application reste sans aucune
> dépendance. L'encodeur QR a été écrit d'après la norme ISO 18004 et vérifié
> en relisant les codes produits avec le décodeur du système.

---

## 6. Utiliser l'application le jour du tournoi

1. **Créer le tournoi** depuis l'accueil. L'app génère un **code à 6 caractères**
   (par exemple `K7M2XQ`), affiché en gros.
2. **Partager ce code** aux autres personnes qui aident à la table de marque.
   Elles le saisissent sur l'accueil de leur téléphone et voient le même tournoi.
   Le lien direct fonctionne aussi : `https://leccof.github.io/open-saint-come/#/t/K7M2XQ`
3. **Saisir les joueurs** au fur et à mesure des arrivées.
4. **Lancer le chapeau** : le bouton « Tirer un nom » sort les joueurs un par un.
   Deux noms consécutifs forment une équipe.
5. **Jouer les tours** et saisir les scores. Le vainqueur monte tout seul au tour
   suivant ; les perdants du premier tour basculent en consolante.

### Et si le réseau tombe ?

L'app continue de fonctionner. Tout est enregistré dans le navigateur
(**localStorage** : la petite mémoire que chaque site possède dans votre
navigateur) et renvoyé vers Supabase dès le retour du réseau. Un indicateur
en haut de l'écran affiche en permanence : **synchronisé**, **en attente**
ou **hors ligne**.

> Conseil : gardez un seul appareil « maître » pour la saisie des scores.
> Deux personnes qui saisissent le même match au même moment, chacune sur son
> téléphone, la dernière écriture l'emporte.

Depuis l'écran **Résultats**, vous pouvez **télécharger tout le tournoi en JSON**.
Faites-le en fin de journée : c'est votre filet de sécurité.

---

## 7. Lancer les tests

Les tests vérifient automatiquement les deux endroits où ce genre d'application
casse en silence : **la construction des tableaux** (notamment quand le nombre
d'équipes ne tombe pas juste — 3, 5, 11…) et **le tirage du chapeau**.

```bash
cd ~/Projets/open-saint-come
node --test
```

Une ligne verte par test réussi, et un décompte à la fin. En cas d'échec, Node
affiche ce qui était attendu et ce qui a été obtenu.

> ⚠️ N'écrivez pas `node --test tests/`. Depuis Node 22, ce qui suit `--test`
> est interprété comme un **motif de fichiers**, plus comme un dossier : la
> commande échouerait avec « Cannot find module ». Sans rien après, Node trouve
> tout seul les fichiers `*.test.js`. Si vous voulez être explicite :
> `node --test tests/*.test.js`.

**Ce que les 71 tests couvrent :**

| Domaine | Exemples de ce qui est vérifié |
| --- | --- |
| Forme du tableau | 3, 5, 8, 11 et 16 équipes : bonne taille, bon nombre de tours |
| Placement | chaque équipe placée une fois et une seule, aucun match vide |
| Byes | bon nombre, jamais deux fois la même équipe, répartis dans les deux moitiés |
| Progression | le vainqueur se retrouve bien au tour suivant, jusqu'à la finale |
| Cascade | corriger un score efface la suite — et **seulement** ce qui en dépendait |
| Scores | le vainqueur d'une manche doit être à 13 ; une 3ᵉ manche après un 2-0 est ignorée |
| Consolante | composition, création au bon moment, détection d'incohérence |
| Chapeau | chaque joueur sort une fois, équipes deux par deux, triplette en dernier |
| Annulation | le nom revient dans le chapeau sans perdre personne |
| Hasard | tirage sans biais, mélange qui ne perd ni ne duplique |

---

## 8. Comment le projet est organisé

```
open-saint-come/
├── index.html            Page unique de l'application
├── config.js             Vos identifiants Supabase (publié, voir §3.2)
├── config.example.js     Modèle à recopier pour un autre tournoi
├── css/
│   ├── theme.css         Uniquement des variables de couleur et de typographie
│   └── app.css           La mise en page, qui n'utilise que ces variables
├── design/               Affiche officielle et philosophie de design
├── js/
│   ├── app.js            Point d'entrée : navigation entre les écrans
│   ├── state.js          Forme de l'objet tournoi et opérations dessus
│   ├── storage.js        TOUT l'accès à Supabase passe par ici
│   ├── draw.js           Le tirage au sort du chapeau
│   ├── bracket.js        Construction des tableaux, byes, progression
│   ├── rules-data.js     Texte de la page Règles
│   └── views/            Un fichier par écran
└── tests/                Tests exécutés par « node --test »
```

Deux principes structurent le code :

- **Toute la persistance est dans `storage.js`.** Ce fichier expose trois
  fonctions — `loadTournament(code)`, `saveTournament(state)`,
  `createTournament(name)` — et rien d'autre du projet ne parle à Supabase.
  Pour remplacer Supabase par votre propre serveur, il n'y a que ce fichier à
  réécrire.
- **Aucune couleur n'est écrite en dur** ailleurs que dans `theme.css`.

---

## 9. Questions fréquentes et pannes courantes

**La page est blanche en local.**
Vous avez sans doute ouvert `index.html` par double-clic. Passez par
`python3 -m http.server 8000` puis http://localhost:8000 (voir §4).

**La page est blanche en ligne, juste après le push.**
GitHub Pages met une à deux minutes à publier. Rechargez en forçant le
rafraîchissement : `Cmd + Maj + R`.

**L'app dit « hors ligne » alors que j'ai du réseau.**
Vérifiez l'URL et la clé dans `config.js`, et que la table `tournaments` a bien
été créée (§3.3). Ouvrez la console du navigateur (`Cmd + Option + I`) : le
message d'erreur exact s'y trouve.

**« new row violates row-level security policy »**
Les règles RLS du §3.3 n'ont pas été appliquées. Rejouez le bloc SQL.

**J'ai perdu le code du tournoi.**
Il apparaît dans la liste des tournois de l'écran d'accueil, sur l'appareil qui
l'a créé. Sinon, retrouvez-le dans la table `tournaments` du dashboard Supabase
(**Table Editor**).

**Je me suis trompé dans un score déjà validé.**
Rouvrez le match et corrigez-le. Si les tours suivants sont déjà remplis, l'app
demandera confirmation avant de recalculer la suite du tableau.

---

## Licence

Projet personnel, librement réutilisable pour votre propre concours.
