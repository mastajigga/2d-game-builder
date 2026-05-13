# Phase 3 — Menu principal (DOM natif)

> **Durée estimée** : 2–3h  
> **Dépendances** : Phase 2 terminée (UI DOM stable)  
> **Objectif** : Remplacer le démarrage direct sur l'éditeur par un écran titre professionnel.

---

## 3.1 Objectif

Créer un écran titre 100% HTML/CSS qui permet :
- **Jouer** → lance GymScene avec le niveau courant
- **Reprendre** → affiche les 5 dernières sauvegardes (grisé si vide)
- **Développement** → lance EditorScene
- **Quitter** → ferme l'onglet / l'application

Le canvas Phaser est **caché** sur le menu principal. Il n'est monté que quand on entre dans EditorScene ou GymScene.

---

## 3.2 Fichiers à créer

```
src/editor-ui/
└─ MainMenuUI.ts
src/editor-ui/styles/
└─ main-menu.css
```

## 3.3 Fichiers à modifier

```
index.html                     # Container #main-menu
src/main.ts                    # Logique de bootstrap : menu vs game
src/scenes/EditorScene.ts      # Émettre événement quand on quitte l'éditeur
src/scenes/GymScene.ts         # Émettre événement quand on quitte le jeu
```

---

## 3.4 Tâches détaillées

### Tâche 3.1 : Créer `MainMenuUI.ts`

- [ ] Classe `MainMenuUI` avec méthodes `show()`, `hide()`
- [ ] HTML injecté dans `#main-menu` :
  - Titre "OAKWOODS" (grand, stylisé, éventuellement avec un effet gradient CSS)
  - Sous-titre version
  - Liste verticale de boutons centrés :
    - `[ Jouer ]`
    - `[ Reprendre ]` — grisé + `disabled` si aucune sauvegarde
    - `[ Développement ]`
    - `[ Quitter ]`
  - Boutons : largeur 240px, hauteur 48px, espacement 16px
  - Hover : scale(1.02), glow `--accent`
  - Active : scale(0.98)
- [ ] Écouter les clics et émettre vers le bridge :
  - `menu-play`
  - `menu-resume` (avec slotId si sélectionné depuis sous-menu)
  - `menu-develop`
  - `menu-quit`

**Critère d'acceptation** : Le menu s'affiche au lancement. Les boutons réagissent au hover/active.

### Tâche 3.2 : Sous-menu "Reprendre"

- [ ] Quand on clique "Reprendre" et qu'il y a des sauvegardes :
  - Le bouton s'étend ou un panel apparaît en dessous
  - Liste des 5 slots avec :
    - N° du slot
    - Nom du niveau / checkpoint
    - Date et heure formatées (`10/05/2026 14:32`)
    - Durée de jeu (si trackée)
- [ ] S'il n'y a aucune sauvegarde :
  - Le bouton est `disabled` avec opacité 0.4
  - Tooltip : "Aucune sauvegarde"

**Critère d'acceptation** : Les sauvegardes sont listées avec date/heure lisibles.

### Tâche 3.3 : Adapter `main.ts` pour le bootstrap

- [ ] `main.ts` ne crée plus directement le `Phaser.Game`
- [ ] Au lieu :
  1. Instancier `MainMenuUI`
  2. Montrer le menu
  3. Écouter les événements bridge :
     - `menu-develop` → créer le jeu Phaser avec `EditorScene` en première scène
     - `menu-play` → créer le jeu Phaser avec `GymScene`
     - `menu-resume` → créer le jeu + charger la sauvegarde
     - `menu-quit` → `window.close()` ou message
  4. Quand le jeu démarre, cacher `#main-menu` et montrer `#game-container`
  5. Quand on quitte le jeu/éditeur (event `return-to-menu`), détruire l'instance Phaser et remontrer le menu

**Critère d'acceptation** : Le jeu démarre uniquement quand on clique un bouton. Pas de canvas inutile au démarrage.

### Tâche 3.4 : Bouton "Retour au menu" dans EditorScene et GymScene

- [ ] Ajouter un petit bouton ← en haut à gauche du canvas (ou DOM overlay)
- [ ] Émettre `return-to-menu` via le bridge
- [ ] `GymScene` : pause le jeu, sauvegarde l'état si demandé, puis retourne au menu
- [ ] `EditorScene` : sauvegarde automatiquement le niveau, puis retourne au menu

**Critère d'acceptation** : On peut quitter le jeu ou l'éditeur et revenir au menu sans recharger la page.

### Tâche 3.5 : Style et polish

- [ ] Fond du menu : image de fond du jeu (ou dégradé CSS animé)
- [ ] Animation d'entrée : fade-in + translateY(20px → 0) en 400ms
- [ ] Animation des boutons au hover : transition CSS `transform 0.15s ease`
- [ ] Musique de fond (optionnel, si Audio API prête)

### Tâche 3.6 : Build et validation

- [ ] `npm run build`
- [ ] Tester : lancer → voir menu → clic Développement → voir builder → retour menu → clic Jouer → voir jeu

**Critère d'acceptation** : Build OK. Le cycle Menu → Jeu/Éditeur → Menu fonctionne sans rechargement.

---

## 3.5 Définition de fini

- [ ] Le menu principal est en DOM natif, stylé, responsive
- [ ] Les 4 boutons fonctionnent (Jouer, Reprendre, Développement, Quitter)
- [ ] Le sous-menu Reprendre liste les sauvegardes avec date/heure
- [ ] On peut entrer/sortir du jeu et de l'éditeur sans recharger
- [ ] Le canvas Phaser n'est créé qu'à la demande
- [ ] Build OK
