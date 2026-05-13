# Phase 2 — Refonte complète de l'UI du builder

> **Durée estimée** : 4–6h  
> **Dépendances** : Phase 1 terminée (bridge validé, PropertiesPanelUI fonctionnel)  
> **Objectif** : Migrer les 3 modules UI restants du builder en DOM natif.

---

## 2.1 Objectif

Migrer la **Toolbar**, la **Palette** et le **TestMenu** de Phaser vers DOM natif.  
Le canvas Phaser ne conserve que : caméra, grille, rendu sprites, sélection visuelle, drag & drop, undo/redo interne.

---

## 2.2 Fichiers à créer

```
src/editor-ui/
├─ ToolbarUI.ts
├─ PaletteUI.ts
├─ TestMenuUI.ts
└─ styles/
   ├─ toolbar.css
   ├─ palette.css
   └─ test-menu.css
```

## 2.3 Fichiers à modifier

```
src/scenes/EditorScene.ts      # Alléger : supprimer ToolbarManager, PaletteManager, TestMenu
src/main.ts                    # Instancier les nouveaux modules UI
index.html                     # Ajouter les containers #toolbar, #palette, #test-menu
```

---

## 2.4 Tâches détaillées

### Tâche 2.1 : Migrer la Toolbar — `ToolbarUI.ts`

- [ ] Créer `ToolbarUI.ts`
- [ ] HTML : barre horizontale en haut de l'écran (`position: absolute; top: 0; left: 0; width: 100%; height: 48px`)
- [ ] Groupes visuels : `[Modes] | [Actions] | [View] | [Tests]`
- [ ] Modes : `Stage`, `Entity`, `Background`, `Collision`, `Select`, `Delete`, `Pan`
  - Boutons avec icônes SVG (ou emoji faute d'icônes)
  - État actif : fond `--accent`, texte `--bg-primary`
  - `pointer-events: auto` sur toute la barre
- [ ] Actions : `Undo`, `Redo`, `Save`, `Playtest`
  - Undo/Redo grisés quand `canUndo=false` / `canRedo=false`
- [ ] View : `Grid toggle`, `Fit to screen`
- [ ] Tests : bouton `M` (ouvre TestMenu)
- [ ] Écouter `mode-changed` depuis le bridge pour mettre à jour l'état actif
- [ ] Émettre `set-mode`, `trigger-undo`, `trigger-redo`, `save-level`, `playtest` vers le bridge

**Critère d'acceptation** : Changer de mode via la toolbar DOM met à jour le canvas instantanément. Le mode actif est visuellement souligné.

### Tâche 2.2 : Migrer la Palette — `PaletteUI.ts`

- [ ] Créer `PaletteUI.ts`
- [ ] HTML : sidebar à gauche (`position: absolute; top: 60px; left: 10px; width: 180px; bottom: 20px`)
- [ ] Barre de recherche en haut : `<input type="text" placeholder="Rechercher...">`
  - Filtre les assets en temps réel
- [ ] Tabs par catégorie : `Tous`, `Plateformes`, `Ennemis`, `Décors`, `Hazards`, `Background`
  - Utiliser le `AssetCatalog` pour grouper
- [ ] Grille d'assets : miniatures carrées 48x48px avec label en dessous
  - Image réelle de l'asset (si chargée) ou placeholder coloré
  - Hover : bordure `--accent`
  - Sélection : fond `--accent` à 20% opacité
- [ ] Scroll natif (`overflow-y: auto`)
- [ ] Émettre `place-asset` vers le bridge quand on clique (le canvas gère le placement au curseur)

**Critère d'acceptation** : La palette scrollable en DOM est plus fluide que l'ancienne version Phaser. La recherche filtre en < 50ms.

### Tâche 2.3 : Migrer le TestMenu — `TestMenuUI.ts`

- [ ] Créer `TestMenuUI.ts`
- [ ] HTML : modal centré (`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%)`)
- [ ] Fond overlay sombre semi-transparent (`background: rgba(0,0,0,0.6)`)
- [ ] Contenu :
  - Liste de tests : Jump, Attack, Patrol, Collision
  - Checkboxes : `Auto-run on load`, `Show hitboxes`, `Show patrol zones`
  - Bouton `Fermer`
- [ ] Émettre les commandes de test vers le bridge

**Critère d'acceptation** : Le menu s'ouvre/ferme avec une transition CSS. Les checkboxes persistent leur état dans `localStorage`.

### Tâche 2.4 : Alléger `EditorScene.ts`

- [ ] Supprimer les imports et usages de :
  - `ToolbarManager`
  - `PaletteManager`
  - `TestMenu` (l'ancien en Phaser)
- [ ] Conserver uniquement :
  - `EntityManager` (logique monde)
  - `BackgroundBuilder` (rendu shapes)
  - `CollisionEditor` (overlay hitboxes)
  - Caméra, inputs souris, grille
- [ ] S'assurer que tous les événements bridge sont bien écoutés
- [ ] Réduire `EditorScene.ts` de ~860 lignes à ~400 lignes

**Critère d'acceptation** : EditorScene.ts ne contient plus aucun code de rendu UI. Il ne gère que le monde.

### Tâche 2.5 : Styles globaux et cohérence

- [ ] Fusionner les CSS partiels dans `editor-ui.css` (ou les importer depuis un index)
- [ ] S'assurer que z-index sont cohérents :
  - Canvas Phaser : z-index 0
  - Overlay UI : z-index 10
  - Modals (Confirm, Test) : z-index 100
- [ ] Ajouter une classe `.hidden { display: none !important; }` pour masquer rapidement

### Tâche 2.6 : Build et validation

- [ ] `npm run build`
- [ ] Tester chaque mode toolbar
- [ ] Tester la palette (recherche, tabs, scroll)
- [ ] Tester le cycle complet : sélectionner asset dans palette → placer dans monde → éditer propriétés → sauvegarder

**Critère d'acceptation** : Build OK. Le builder est entièrement fonctionnel avec UI DOM. Zéro régression.

---

## 2.5 Définition de fini

- [ ] Toolbar, Palette, TestMenu sont en DOM natif
- [ ] EditorScene.ts est allégé (plus de UI Phaser)
- [ ] Les anciens modules Phaser (ToolbarManager, PaletteManager, etc.) sont conservés dans un dossier `src/editor/legacy/` (ou commentés) pour référence
- [ ] Build OK
- [ ] UX fluide : pas de latence perceptible entre clic DOM et réaction canvas
