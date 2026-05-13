# Oakwoods — Modernisation de l'interface Builder V3

> **Projet** : Oakwoods Level Builder  
> **Date** : 2026-05-10  
> **Auteur** : Assistant Hermes — Plan architectural et justification des choix  
> **Statut** : Approuvé en attente d'implémentation  

---

## Résumé exécutif

Le builder de niveau Oakwoods (V2) fonctionne mais son interface est entièrement rendue dans le canvas Phaser. Cette approche atteint ses limites : inputs primitifs, absence de color picker natif, scroll bugué, et reconstruction DOM coûteuse à chaque interaction. Ce document propose une refonte architecturale en **système hybride Canvas + DOM natif** qui garde le moteur de rendu Phaser pour le monde du niveau, tout en déportant toute l'interface utilisateur vers du HTML/TypeScript/CSS standard. Le résultat est un outil moderne, rapide à développer, et extensible sans friction.

---

## 1. Contexte et problématique actuelle

### 1.1 L'état du builder V2

Le builder V2 a été modulaire avec succès (`PaletteManager`, `EntityManager`, `PropertiesPanel`, `ToolbarManager`, etc.). Cependant, tous ces modules utilisent exclusivement l'API graphique de Phaser (`Phaser.GameObjects.Text`, `Phaser.GameObjects.Rectangle`, `Phaser.GameObjects.Container`) pour rendre l'interface.

### 1.2 Les frustrations identifiées

| Problème | Impact | Exemple concret |
|---|---|---|
| **Pas de vrai input texte** | Impossible de copier/coller, pas de curseur clignotant | Éditer le nom d'un ennemi : on doit cliquer sur un prompt `window.prompt()` |
| **Pas de color picker natif** | Sélection de teinte manuelle, hexadécimal approximatif | Le champ "tint" demande de taper `#ff0000` à la main |
| **Scroll codé à la main** | Saccades, pas d'inertie, gestion de la molette complexe | La palette d'assets a un scroll interne Phaser qui conflit avec le zoom monde |
| **Reconstruction UI coûteuse** | Le panneau disparaît et se recrée à chaque modification | Modifier les HP d'un ennemi → `rebuild()` du PropertiesPanel entier |
| **Pas de responsive layout** | Positionnement en coordonnées absolues pixel par pixel | Le panel est en x=1360, y=60. Sur un écran 1366px, il déborde |
| **Accessibilité nulle** | Pas de tabindex, pas de labels ARIA, pas de raccourcis OS | Un utilisateur ne peut pas naviguer au clavier dans l'éditeur |
| **Styling limité** | Pas de CSS, pas de transitions, pas de hover élégant | Les boutons sont des rectangles colorés sans animation |

### 1.3 Le constat fondamental

Phaser est un **moteur de jeu**, pas un framework d'interface utilisateur. L'utiliser pour des formulaires, des listes scrollables, des arborescences et des panneaux modaux est une **contre-utilisation** qui consomme du temps de développement et produit une expérience sous-optimale.

---

## 2. Vision cible

### 2.1 Architecture hybride

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COUCHE UI (DOM natif — HTML / TS / CSS)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ TOOLBAR   [Stage] [Entity] [BG] [Collision] [Select] [Delete]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌──────────┐  ┌─────────────────────────────────────────────────────┐    │
│  │          │  │                                                     │    │
│  │ PALETTE  │  │                                                     │    │
│  │  🌲🍄🏠  │  │        CANVAS PHASER                                │    │
│  │  ░░░░░░  │  │        (monde du niveau uniquement)                 │    │
│  │          │  │        caméra, zoom, grille, sprites,               │    │
│  │  rech.   │  │        sélection visuelle, drag & drop              │    │
│  │  tabs    │  │                                                     │    │
│  │          │  │                                                     │    │
│  └──────────┘  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PROPERTIES PANEL (DOM natif)                                        │    │
│  │  Nom: [________]    HP:  [--][ 8][+]                               │    │
│  │  Teinte: [🎨______]  Taille: [slider━━━━●━━]                        │    │
│  │  Rotation: [0° ▼]   Collision: [✓ ON]  X:[_0_] Y:[_0_] W:[_64_]   │    │
│  │                                                                     │    │
│  │  [OK]                                    [Supprimer]               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Séparation des responsabilités

| Responsabilité | Technologie | Justification |
|---|---|---|
| Rendu du monde (sprites, caméra, grille, sélection) | **Phaser Canvas** | Phaser excelle à cela. Garder. |
| Formulaires, inputs, boutons, listes | **HTML/TS/CSS** | Le navigateur excelle à cela. Utiliser. |
| Communication bidirectionnelle | **EventTarget bridge** | Découplage strict, testable, zero dépendance. |

---

## 3. Choix architecturaux et justifications

### 3.1 Pourquoi garder Phaser pour le monde ?

**Option rejetée : moteur de rendu 100% DOM (div + CSS transforms)**

Un rendu DOM pur pour le monde du niveau (sprites comme `<img>` avec `transform: translate3d`) est techniquement possible, mais nécessite de réimplémenter :

- Caméra 2D avec deadzone, lerp, bounds
- Zoom centré sur le curseur (pas anodin en CSS)
- Grille de rendu optimisée (ne pas rendre les objets hors viewport)
- Drag & drop avec snapping à la grille
- Rectangle de sélection multi-objets (rubber band)
- Gestion du z-index / depth des centaines de sprites
- Parallax et layers de background

**Coût estimé** : 2 à 3 mois de développement pour égaler les capacités actuelles de Phaser.

**Verdict** : Rejeté. Le canvas Phaser est un atout, pas un problème.

### 3.2 Pourquoi passer l'UI en DOM natif ?

**Option rejetée : UI 100% Phaser (statu quo)**

Comme documenté en section 1.2, les limitations sont bloquantes pour une expérience "moderne". Chaque nouvelle feature UI (color picker, slider, dropdown, autocomplete) demande de coder un widget from scratch en Phaser. C'est du travail répétitif, fragile, et jamais aussi poli que le navigateur natif.

**Option rejetée : Framework frontend (React, Vue, Svelte)**

React/Vue/Svelte apporteraient une réactivité élégante, mais imposent :
- Une nouvelle dépendance lourde (`react`, `react-dom`, bundler config)
- Un modèle de pensée différent (virtual DOM vs canvas imperatif)
- Un cycle de vie à synchroniser avec Phaser (le canvas n'est pas le DOM)
- Un coût d'apprentissage si le projet est repris plus tard
- Un surcoît de bundle (ReactDOM minifié ≈ 120KB gzippé)

**Option choisie : DOM natif pur avec TypeScript**

Avantages :
- **Zero dépendance supplémentaire** : Vite + TypeScript suffisent déjà.
- **API stable** : Le DOM ne change pas. Pas de breaking change comme React 18→19.
- **Performance** : Pas de virtual DOM, pas de reconciliation. Les updates sont directes.
- **Intégration transparente** : `document.getElementById('properties-panel')` fonctionne partout.
- **Debugging trivial** : Chrome DevTools montre le HTML, les styles, les event listeners directement.
- **Poids** : Zéro kilo-octet ajouté au bundle.

Pattern utilisé : Classes TypeScript qui encapsulent la création/manipulation DOM.

```typescript
class PropertiesPanelUI {
  private root: HTMLElement;
  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
  }
  show(entity: PlacedEntity) {
    this.root.innerHTML = ''; // ou mieux, mise à jour ciblée
    // ... construire le DOM
  }
}
```

### 3.3 Pourquoi un bridge EventTarget plutôt que des callbacks directs ?

**Option rejetée : Références directes (EditorScene appelle PropertiesPanelUI)**

```typescript
// ANTI-PATTERN : couplage fort
this.propertiesPanel.show(entity); // EditorScene connait PropertiesPanelUI
```

Problèmes :
- Le canvas Phaser (EditorScene) doit importer des modules DOM → création d'une dépendance circulaire potentielle.
- Difficile de tester unitairement : il faut instancier Phaser pour tester l'UI.
- Impossible d'avoir plusieurs écouteurs sans ajouter du code.

**Option choisie : Bus d'événements via EventTarget natif**

```typescript
// src/editor-ui/EditorBridge.ts
export const editorBus = new EventTarget();

// Emission (depuis le canvas Phaser)
editorBus.dispatchEvent(new CustomEvent('entity-selected', {
  detail: { uid, x, y, assetId, rotation, tint, hp, ... }
}));

// Écoute (depuis le DOM UI)
editorBus.addEventListener('entity-selected', (e: CustomEvent) => {
  propertiesPanel.render(e.detail);
});
```

Avantages :
- **Découplage total** : Le canvas ne sait pas que le DOM existe. Le DOM ne sait pas comment fonctionne le canvas.
- **Testabilité** : On peut tester l'UI DOM en simulant des événements `editorBus.dispatchEvent(...)` sans instancier Phaser.
- **Extensibilité** : Un troisième module (ex: plugin de statistiques) peut s'accrocher au même bus sans modifier les autres.
- **Zero librairie** : `EventTarget` est natif depuis ES6.

### 3.4 Pourquoi pas de gestion d'état globale (Redux, Zustand, Pinia) ?

L'état du builder est principalement localisé :
- L'entité sélectionnée n'intéresse que le PropertiesPanel.
- Le mode toolbar n'intéresse que la toolbar et le canvas.
- La palette n'a pas besoin de connaître la caméra.

Introduire un store global ajouterait une abstraction inutile pour un projet de cette taille (~10 modules UI). Chaque module garde son propre état interne et communique via événements ponctuels.

**Verdict** : Pas de state manager global. État local + events.

---

## 4. Structure du projet après migration

```
src/
├── editor/                    # Modules Phaser (monde uniquement)
│   ├── EditorCamera.ts        # Gestion caméra, zoom, pan
│   ├── EditorGrid.ts          # Grille de rendu
│   ├── EntityRenderer.ts      # Rendu sprites + sélection + drag
│   ├── BackgroundRenderer.ts  # Rendu shapes background
│   ├── CollisionRenderer.ts   # Overlay hitboxes
│   └── EditorScene.ts         # Orchestrateur Phaser (allégé)
│
├── editor-ui/                 # Modules DOM natifs (interface)
│   ├── EditorBridge.ts        # Bus EventTarget global
│   ├── ToolbarUI.ts           # Barre d'outils
│   ├── PaletteUI.ts           # Palette d'assets
│   ├── PropertiesPanelUI.ts   # Panneau de propriétés
│   ├── ConfirmDialogUI.ts     # Dialogs modals
│   ├── TestMenuUI.ts          # Menu de tests
│   ├── MiniMapUI.ts           # Mini-carte
│   └── MainMenuUI.ts          # Écran titre
│
├── scenes/
│   ├── EditorScene.ts         # Canvas Phaser du builder
│   ├── GymScene.ts            # Runtime jeu
│   └── BootScene.ts           # Chargement assets
│
├── level/
│   ├── LevelData.ts           # Schéma v6+
│   └── AssetCatalog.ts        # Catalogue d'assets
│
└── main.ts                    # Bootstrap : montre MainMenuUI ou EditorScene
```

---

## 5. Détail de la communication Bridge

### 5.1 Événements Canvas → DOM

| Événement | Payload | Destinataire |
|---|---|---|
| `entity-selected` | `PlacedEntity` | PropertiesPanelUI |
| `entity-deselected` | — | PropertiesPanelUI |
| `multi-selection` | `PlacedEntity[]` | PropertiesPanelUI (mode batch) |
| `mode-changed` | `{ mode: EditorMode }` | ToolbarUI |
| `camera-moved` | `{ x, y, zoom }` | MiniMapUI |
| `level-loaded` | `LevelData` | Tous les panneaux |
| `asset-placed` | `{ uid, assetId, x, y }` | PaletteUI (feedback visuel) |
| `undo-state-changed` | `{ canUndo, canRedo }` | ToolbarUI |

### 5.2 Événements DOM → Canvas

| Événement | Payload | Action dans EditorScene |
|---|---|---|
| `set-mode` | `{ mode: EditorMode }` | Change le mode d'édition |
| `place-asset` | `{ assetId, x, y }` | Spawn l'asset au monde |
| `update-entity` | `{ uid, changes: Partial<PlacedEntity> }` | Applique les modifs |
| `delete-entity` | `{ uid }` | Supprime l'entité |
| `set-zoom` | `{ zoom: number }` | Ajuste le zoom caméra |
| `pan-camera` | `{ x, y }` | Déplace la caméra |
| `trigger-undo` | — | Undo |
| `trigger-redo` | — | Redo |
| `save-level` | — | Sauvegarde localStorage |
| `playtest` | — | Lance GymScene |

### 5.3 Exemple de flux complet

**Scénario** : L'utilisateur clique sur un ennemi dans le canvas, modifie ses HP dans le panel, et voit la mise à jour en temps réel.

```
1. [Canvas] Clic sur sprite ennemi
   → EditorScene sélectionne l'entité
   → editorBus.dispatchEvent('entity-selected', { detail: entity })

2. [DOM] PropertiesPanelUI écoute 'entity-selected'
   → Récupère l'entité
   → Affiche le formulaire avec input HP = 8

3. [DOM] Utilisateur clique sur [+] à côté de HP
   → PropertiesPanelUI met à jour son état local : HP = 9
   → editorBus.dispatchEvent('update-entity', { detail: { uid, changes: { hp: 9 } } })

4. [Canvas] EditorScene écoute 'update-entity'
   → Applique la modification à l'entité en mémoire
   → Met à jour l'affichage (barre de vie au-dessus du sprite si visible)
   → Ne reconstruit PAS l'UI

5. [DOM] PropertiesPanelUI affiche désormais HP = 9
   → Le panel est resté ouvert, fluide, instantané.
```

---

## 6. Bénéfices attendus

### 6.1 Développement

| Tâche | Avant (Phaser UI) | Après (DOM UI) | Gain |
|---|---|---|---|
| Ajouter un champ texte | 30 lignes + gestion clavier manuelle | `<input type="text">` | 10x plus rapide |
| Ajouter un color picker | Impossible (coder un widget from scratch) | `<input type="color">` | Possible en 1 ligne |
| Ajouter un slider | 40 lignes (rectangle + drag + valeur) | `<input type="range">` | 10x plus rapide |
| Scroll dans une liste | 50 lignes + bugs | `overflow-y: auto` | Gratuit, parfait |
| Style hover/focus | Codé manuel frame par frame | `:hover { background: ... }` | CSS natif |

### 6.2 Utilisateur final

- **Color picker natif** : clic sur un champ, le sélecteur OS apparaît.
- **Copier/coller** : Ctrl+C/V fonctionne dans tous les inputs.
- **Undo texte** : Ctrl+Z dans un input annule la frappe, pas l'action monde.
- **Accessibilité** : Tab pour naviguer, labels pour screen readers.
- **Responsive** : Flexbox ajuste automatiquement la disposition.

---

## 7. Risques et stratégies d'atténuation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Le bridge EventTarget crée des fuites mémoire** | Moyenne | Élevé | Tous les `addEventListener` seront encapsulés dans des classes avec méthode `destroy()` qui fait `removeEventListener`. Audit avec Chrome DevTools Heap. |
| **Les coordonnées écran ↔ monde deviennent complexes** | Moyenne | Moyen | EditorScene expose une méthode `screenToWorld(x, y)` via le bridge. Le DOM n'a jamais besoin de connaître le zoom ou la caméra. |
| **Le DOM overlay cache les événements souris du canvas** | Élevée | Élevé | `pointer-events: none` sur les zones transparentes du DOM overlay. Seuls les inputs et boutons ont `pointer-events: auto`. |
| **L'index.html devient monolithique** | Faible | Faible | Le HTML est minimal (containers vides). Tout est injecté par TypeScript. |
| **La migration est trop longue et bloque les nouvelles features** | Moyenne | Très élevé | Migration **incrémentale** : un panneau à la fois. On ne touche pas au canvas tant que le DOM n'est pas prêt. Le build reste fonctionnel à chaque étape. |

---

## 8. Spécification technique du rendu

### 8.1 Positionnement du canvas Phaser

Le canvas de Phaser occupe 100% de la fenêtre (`width: 100vw; height: 100vh`). Les UI DOM sont en `position: absolute` par-dessus.

```css
#game-container canvas {
  display: block;
  width: 100vw;
  height: 100vh;
}

.editor-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; /* Laisse passer les clics vers le canvas */
}

.editor-overlay > * {
  pointer-events: auto; /* Réactive pour les éléments interactifs */
}
```

### 8.2 Gestion du focus

Quand un input DOM a le focus, les raccourcis clavier Phaser (R, F, Ctrl+Z) doivent être désactivés pour éviter les conflits.

```typescript
// Dans EditorScene
this.input.keyboard?.enabled = !document.querySelector('input:focus');
```

Ou plus finement : le DOM émet `ui-focus-start` / `ui-focus-end` via le bridge.

### 8.3 Dark theme

L'UI adopte un thème sombre cohérent avec le jeu :

```css
:root {
  --bg-primary: #1e1e2e;
  --bg-secondary: #2a2a3c;
  --bg-tertiary: #363654;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --accent: #89b4fa;
  --accent-hover: #b4befe;
  --danger: #f38ba8;
  --success: #a6e3a1;
  --border: #45475a;
  --radius: 6px;
  --font: 'Segoe UI', system-ui, sans-serif;
}
```

---

## 9. Stratégie de migration incrémentale

La migration ne se fait **pas** en coupant le builder pendant des jours. Elle se fait panneau par panneau :

```
Étape 1 : PropertiesPanelUI (DOM) + Bridge
          → Le reste reste en Phaser
          → Build OK, testable immédiatement

Étape 2 : ToolbarUI (DOM)
          → Remplace ToolbarManager Phaser
          → Build OK

Étape 3 : PaletteUI (DOM)
          → Remplace PaletteManager Phaser
          → Build OK

Étape 4 : MainMenuUI (DOM)
          → Écran titre natif
          → Build OK

Étape 5+ : Les autres modules
```

À chaque étape, le fichier Phaser legacy est **conservé** jusqu'à validation complète de la version DOM. Puis suppression.

---

## 10. Conclusion

La modernisation de l'interface par passage au DOM natif est la décision architecturale la plus impactante pour la productivité future du projet Oakwoods. Elle transforme un outil "moteur de jeu détourné" en un outil "application web professionnelle" sans sacrifier les capacités de rendu du canvas Phaser.

**Les 8 étapes d'implémentation détaillées sont dans les fichiers `phase-01.md` à `phase-08.md` dans ce même dossier.**

---

## Glossaire

| Terme | Définition |
|---|---|
| **Bridge** | Bus d'événements reliant le canvas Phaser et le DOM HTML. |
| **Canvas** | Surface de dessin 2D rendue par Phaser (WebGL ou Canvas 2D). |
| **DOM** | Document Object Model — la structure HTML de la page. |
| **EditorScene** | Scène Phaser qui affiche le monde du niveau à éditer. |
| **GymScene** | Scène Phaser qui joue le niveau (runtime). |
| **Hybride** | Architecture combinant deux technologies complémentaires. |
| **Phaser** | Moteur de jeu 2D utilisé pour Oakwoods. |
| **PlacedEntity** | Objet de données représentant un asset posé dans le niveau. |
| **PropertiesPanel** | Panneau latéral d'édition des propriétés d'une entité. |
| **UI** | User Interface — interface utilisateur. |
