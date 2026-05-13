# Stage Builder — Page Full-Screen de Construction de Niveaux

> Document de conception — Oakwoods Phase 6  
> Date : 2026-05-12

---

## 1. Vision

Une page dédiée full-screen, sur le modèle de l'Animation Lab, permettant de **construire rapidement des niveaux** sans passer par l'éditeur de précision. L'utilisateur pose des prefabs, définit des zones, ajuste la taille du monde visuellement, puis exporte vers l'éditeur pour le polish.

### Pourquoi une page séparée ?

| Approche | Avantage | Inconvénient |
|---|---|---|
| Mode dans l'éditeur existant | Intégration naturelle | L'éditeur est déjà complexe (6 modes, collision, undo…) |
| Sidebar escamotable | Toujours visible | Réduit l'espace canvas |
| **Page full-screen** ✅ | UI dédiée, espace maximal, séparation claire | Une page de plus à maintenir |

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ TOOLBAR : [← Menu] [Resize] [Prefabs] [Zones] [Auto-fill]       │
│           [Undo] [Redo] [Exporter vers Éditeur]                  │
├────────────┬────────────────────────────────┬────────────────────┤
│ PREFABS    │                                │  STAGE PROPS       │
│ (200px)    │     CANVAS PHASER              │  (240px)           │
│            │     (le niveau en              │                    │
│ 🟫 Sol 5   │      construction)             │  Largeur: [3000]   │
│ 🟫🟫 Sol 8│                                │  Hauteur: [900]    │
│ 🍄 Patrol. │     Navigation :              │                    │
│ 👑 Boss    │       ← → ↑ ↓ = scroll        │  Presets:          │
│ 🚪 Spawn   │       Molette = zoom          │  [S] [M] [L] [XL] │
│ 🕳️ Gap     │       Clic = placer           │                    │
│ 🪜 Vert.   │       Drag = peindre zone     │  Fond: [#1a1a1a]   │
│            │                                │  Gravité: [1800]   │
│ + Nouveau  │                                │                    │
│            │                                │  [Appliquer]       │
├────────────┴────────────────────────────────┴────────────────────┤
│ STATUS : 42 entités | 3200×900 | Mode: Prefabs | Zoom: 1.5x     │
└──────────────────────────────────────────────────────────────────┘
```

- **Barre supérieure** : 48px, fond `--bg-secondary`
- **Panneau gauche** : 200px, fond `--bg-secondary`, scrollable
- **Panneau droit** : 240px, fond `--bg-secondary`
- **Canvas** : occupe l'espace restant, fond `--bg-primary`
- **Barre de statut** : 28px, fond `--bg-tertiary`

---

## 3. Architecture Technique

### 3.1 Composants

| Fichier | Rôle |
|---|---|
| `src/editor-ui/StageBuilderUI.ts` | Controller principal de la page. Gère la visibilité, les modes, les panneaux DOM |
| `src/editor-ui/StageBuilderCanvas.ts` | Gestion du canvas Phaser embarqué : init, rendu, scroll, zoom, grid |
| `src/editor-ui/StageBuilderPrefabs.ts` | Panneau gauche : liste des prefabs, sélection, drag |
| `src/editor-ui/StageBuilderProps.ts` | Panneau droit : inputs W/H, presets, fond, gravité |
| `src/editor-ui/PrefabManager.ts` | (existe déjà) Chargement + instantiation des prefabs |
| `src/editor-ui/EditorBridge.ts` | Events de communication StageBuilder ↔ Editor |

### 3.2 Flux de données

```
prefabs.json ──→ PrefabManager.loadPrefabs()
                        │
                        ▼
              StageBuilderPrefabs (liste DOM)
                        │
                   clic sélection
                        │
                        ▼
              StageBuilderCanvas (mode "prefab")
                        │
                   clic sur canvas
                        │
                        ▼
              instantiatePrefab() → PlacedEntity[]
                        │
                        ▼
              StageBuilderCanvas.renderEntities()
                        │
                        ▼
              [Exporter] → saveLevel() → localStorage
                        │
                        ▼
              EditorScene.loadLevel() → polish fin
```

### 3.3 Modes de la page

| Mode | Icône | Comportement |
|---|---|---|
| **Prefabs** | 🧩 | Défaut. Clic sur canvas = place le prefab sélectionné. Drag = paint zone |
| **Resize** | ↔️ | Affiche les poignées de bord. Drag poignée = étend/réduit le monde |
| **Zones** | 🔲 | Dessin de rectangles nommés. Chaque zone a un rôle (spawn/combat/boss) |
| **Auto-fill** | 🪄 | Remplit la zone sélectionnée avec le type d'entité choisi |
| **Select** | 🖱️ | Sélectionner/déplacer des entités existantes |

### 3.4 Canvas Phaser embarqué

Le canvas utilise une instance Phaser.Game séparée (comme `AnimationLivePreview`) :

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: container.clientWidth,
  height: container.clientHeight,
  parent: "stage-builder-canvas",
  backgroundColor: "#1a1a1a",
  pixelArt: true,
  roundPixels: true,
  scene: StageBuilderScene,
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
};
```

La scène `StageBuilderScene` :
- Affiche la grille (snap 16px)
- Rend les entités du niveau en construction
- Gère le scroll (caméra) et le zoom
- Affiche un curseur preview pour le prefab sélectionné (ghost semi-transparent)
- Gère les poignées de resize

### 3.5 Resize handles visuels

Quatre poignées (triangles ou carrés) positionnées aux milieux des bords :
- **Droite** → drag horizontal → modifie `worldW`
- **Bas** → drag vertical → modifie `worldH`
- **Gauche** → décale toutes les entités existantes + ajoute espace
- **Haut** → décale toutes les entités + ajoute espace

Les poignées sont des Phaser.GameObjects (rectangles avec `setInteractive()`) rendus à depth 1000 au-dessus de la grille.

---

## 4. Liste des Tâches (ordre d'exécution)

### Tâche 1 : Structure HTML + CSS
**Fichiers** : `index.html`, `editor-ui.css`  
**Description** :
- Ajouter `<div id="stage-builder">` dans `index.html`
- À l'intérieur : `#sb-toolbar`, `#sb-left-panel`, `#sb-canvas`, `#sb-right-panel`, `#sb-status`
- CSS : full-screen (position:fixed, inset:0, z-index:250), flexbox layout, dark theme
- Page masquée par défaut (`display:none`), classe `.visible` pour l'afficher

**Validation** : La structure apparaît en console (`document.getElementById("stage-builder")`)

---

### Tâche 2 : StageBuilderCanvas — Phaser embarqué
**Fichier** : `src/editor-ui/StageBuilderCanvas.ts` (nouveau)  
**Description** :
- Créer une classe `StageBuilderCanvas` qui initialise une instance Phaser.Game dans `#sb-canvas`
- Créer une `StageBuilderScene` interne (classe privée ou fichier séparé)
- La scène affiche :
  - Un fond coloré (via `this.cameras.main.setBackgroundColor`)
  - Une grille de snap (lignes tous les 16px, tous les 64px en plus épais)
  - Gestion du scroll caméra avec les flèches
  - Gestion du zoom avec la molette (`this.input.on("wheel")`)
- Exposer `loadLevel(levelData)`, `renderEntities()`, `setMode()`, `getCamera()`

**Validation** : Canvas visible avec grille, scroll et zoom fonctionnels

---

### Tâche 3 : Panneau gauche — Prefabs
**Fichier** : intégré dans `StageBuilderUI.ts`  
**Description** :
- Charger les prefabs via `loadPrefabs()`
- Afficher chaque prefab comme une carte (icône + nom + compteur)
- Clic = sélectionne le prefab (bordure verte), désélectionne les autres
- Re-clic = désélectionne
- Bouton "+ Nouveau" en bas → modal pour nommer et sauvegarder la sélection courante
- Drag & drop (optionnel, v2)

**Validation** : Les 8 prefabs intégrés apparaissent, clic les sélectionne visuellement

---

### Tâche 4 : Placement de prefabs sur le canvas
**Fichier** : `StageBuilderUI.ts` + `StageBuilderCanvas.ts`  
**Description** :
- Quand un prefab est sélectionné ET qu'on clique sur le canvas :
  - Convertir les coordonnées écran → monde (via la caméra Phaser)
  - Snapper à la grille (multiple de 16)
  - Appeler `instantiatePrefab(prefab, wx, wy)`
  - Ajouter les entités au niveau courant
  - Les rendre sur le canvas
  - Mettre à jour le compteur dans la barre de statut
- Afficher un ghost preview (entités en semi-transparent) qui suit la souris

**Validation** : Cliquer sur le canvas avec un prefab sélectionné place les entités

---

### Tâche 5 : Panneau droit — Propriétés
**Fichier** : intégré dans `StageBuilderUI.ts`  
**Description** :
- Inputs numériques : Largeur (W), Hauteur (H)
- Presets rapides sous forme de boutons :
  - S : 1600×900
  - M : 3200×900
  - L : 5000×1200
  - XL : 6400×1600
- Input couleur de fond (type color)
- Input gravité (nombre)
- Bouton "Appliquer" → met à jour le niveau + canvas

**Validation** : Changer la taille et cliquer Appliquer redimensionne le canvas

---

### Tâche 6 : Mode Resize — poignées visuelles
**Fichier** : `StageBuilderCanvas.ts`  
**Description** :
- Créer 4 poignées (rectangles 16×48 ou 48×16) positionnées aux milieux des bords
- Poignées visibles UNIQUEMENT en mode "Resize"
- Drag sur une poignée :
  - **Droite** : `worldW += delta` (clampé au min 800)
  - **Gauche** : `worldW += delta`, toutes les entités décalées de `-delta` en X
  - **Bas** : `worldH += delta`
  - **Haut** : `worldH += delta`, entités décalées de `-delta` en Y
- Mise à jour en temps réel de la grille et des bounds caméra

**Validation** : Tirer la poignée droite agrandit le monde, la grille s'étend

---

### Tâche 7 : Exporter vers l'éditeur
**Fichier** : `StageBuilderUI.ts` + `EditorBridge.ts`  
**Description** :
- Bouton "Exporter vers Éditeur" dans la toolbar
- Action :
  1. Sauvegarder le niveau via `saveLevel(levelData)`
  2. Émettre un event `stage-builder-export` avec le LevelData
  3. Fermer le Stage Builder
  4. L'éditeur principal charge le niveau sauvegardé
- Ajouter l'event `stage-builder-export` dans EditorBridge

**Validation** : Export → retour à l'éditeur → le niveau construit est chargé

---

### Tâche 8 : Intégration menu principal
**Fichier** : `src/main.ts` + `MainMenuUI.ts`  
**Description** :
- Ajouter un bouton "Stage Builder" dans le menu principal
- Lazy-load : `import("./editor-ui/StageBuilderUI").then(...)`
- Le bouton affiche la page Stage Builder
- Bouton "Retour" dans le Stage Builder → retour au menu

**Validation** : Menu → Stage Builder → Menu (aller-retour fonctionnel)

---

### Tâche 9 : Mode Auto-fill (bonus)
**Fichier** : `StageBuilderCanvas.ts`  
**Description** :
- En mode Auto-fill, sélectionner une zone rectangulaire
- Choisir un type d'entité (sol, plateforme, ennemi)
- Cliquer "Remplir" → les entités sont placées en grille dans la zone
- Paramètres : espacement horizontal, espacement vertical, décalage aléatoire

**Validation** : Sélection zone → Remplir avec "platform-mossy" → grille de plateformes

---

## 5. Ordre d'implémentation

| # | Tâche | Temps estimé | Dépendances |
|---|---|---|---|
| 1 | Structure HTML + CSS | 30 min | — |
| 2 | StageBuilderCanvas — Phaser embarqué | 1h30 | #1 |
| 3 | Panneau gauche — Prefabs | 45 min | #1 |
| 4 | Placement de prefabs sur canvas | 1h | #2, #3 |
| 5 | Panneau droit — Propriétés | 30 min | #1 |
| 6 | Mode Resize — poignées visuelles | 1h | #2, #5 |
| 7 | Exporter vers l'éditeur | 30 min | #4 |
| 8 | Intégration menu principal | 20 min | #7 |
| 9 | Mode Auto-fill (bonus) | 1h | #2 |

**Total estimé** : ~7h (6h sans le bonus)

---

## 6. Points d'attention

- **Performance** : Une seconde instance Phaser = mémoire additionnelle (~50-100 MB). Détruire l'instance quand on quitte la page (`game.destroy(true)`).
- **Cohérence des données** : Le Stage Builder travaille sur une copie du niveau. L'export écrase le niveau dans localStorage.
- **Undo/Redo** : Réutiliser `UndoManager` existant. Chaque placement de prefab = 1 action undo.
- **Snap grid** : Cohérent avec l'éditeur principal (16px). Les prefabs doivent respecter le snap.
