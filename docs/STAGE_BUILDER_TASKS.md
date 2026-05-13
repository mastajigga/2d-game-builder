# Stage Builder — Task List

> Date: 2026-05-12  
> Status: 8/8 completed ✅

---

## Tâches terminées

### T1 ✅ Structure HTML + CSS
- **Fichiers**: `index.html`, `src/editor-ui/styles/editor-ui.css`
- Container `#stage-builder` avec toolbar, canvas, panneaux gauche/droite, barre de statut
- CSS: full-screen (z-index:250), dark theme, flexbox layout
- Panneau gauche 200px, panneau droit 240px, toolbar 42px, status 24px

### T2 ✅ StageBuilderCanvas — Phaser embarqué
- **Fichier**: `src/editor-ui/StageBuilderCanvas.ts` (nouveau)
- Instance Phaser.Game séparée dans `#sb-canvas`
- Grille de snap (16px mineure, 64px majeure)
- Scroll caméra (flèches), zoom (molette), pan (clic milieu)
- Rendu des entités par catégorie (couleurs distinctes)
- Méthodes: `init()`, `renderEntities()`, `setWorldSize()`, `destroy()`

### T3 ✅ Panneau gauche — Prefabs
- **Fichier**: intégré dans `StageBuilderUI.ts`
- Liste des 8 prefabs intégrés chargée depuis `PrefabManager`
- Chaque carte affiche icône + nom + compteur d'entités
- Clic = sélection (bordure verte), re-clic = désélection
- Rafraîchi au changement de mode

### T4 ✅ Placement de prefabs sur canvas
- **Fichier**: `StageBuilderUI.ts` + `StageBuilderCanvas.ts`
- En mode "Prefabs", clic sur canvas → `instantiatePrefab()` → entités placées
- Coordonnées écran → monde → snap 16px
- Sauvegarde automatique après chaque placement
- Barre de statut mise à jour (compteur d'entités)

### T5 ✅ Panneau droit — Propriétés
- **Fichier**: intégré dans `StageBuilderUI.ts`
- Inputs Largeur (W) / Hauteur (H) avec min/max
- Presets: S (1600×900), M (3200×900), L (5000×1200), XL (6400×1600)
- Input couleur de fond (type color)
- Bouton "Appliquer" → met à jour `level.worldW/H` + canvas + save

### T6 ✅ Mode Resize — Poignées visuelles
- **Fichier**: `StageBuilderCanvas.ts`
- 4 poignées bleues aux milieux des bords (droite, bas, gauche, haut)
- Visibles uniquement en mode "Resize"
- Drag poignée → worldW/H change en temps réel (snap 16px)
- Callback remonte vers StageBuilderUI pour sync level + status
- Min: 800×600

### T7 ✅ Exporter vers l'éditeur
- **Fichier**: `StageBuilderUI.ts`
- Bouton "Exporter → Éditeur" dans la toolbar
- `saveLevel()` → ferme le builder → retour à l'éditeur principal
- L'éditeur charge le niveau sauvegardé dans localStorage

### T8 ✅ Intégration menu principal
- **Fichiers**: `main.ts`, `MainMenuUI.ts`, `EditorBridge.ts`
- Bouton "🏗 Stage Builder" dans le menu principal
- Lazy-load: `import("./editor-ui/StageBuilderUI")`
- Navigation: hide/show réciproque avec les autres pages (test, animation)
- Event `menu-stage-builder` dans EditorBridge

---

## Fichiers créés

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/editor-ui/StageBuilderCanvas.ts` | ~300 | Phaser embarqué + grid + handles resize |
| `src/editor-ui/StageBuilderUI.ts` | ~350 | Controller page (toolbar, panels, placement, export) |
| `public/prefabs/prefabs.json` | ~100 | 8 prefabs intégrés |
| `src/editor/PrefabManager.ts` | ~70 | Chargement + instantiation prefabs |

## Fichiers modifiés

| Fichier | Changements |
|---|---|
| `index.html` | Container `#stage-builder` (toolbar, main, canvas, panels, status) |
| `src/editor-ui/styles/editor-ui.css` | +270 lignes (stage-builder + prefab panel) |
| `src/main.ts` | Lazy-load `StageBuilderUI`, navigation, events |
| `src/editor-ui/MainMenuUI.ts` | Bouton "🏗 Stage Builder" |
| `src/editor-ui/EditorBridge.ts` | Events: `prefab-*`, `menu-stage-builder` |
| `src/scenes/EditorScene.ts` | Placement prefab one-shot dans l'éditeur |
| `src/editor-ui/ToolbarUI.ts` | Bouton "🧩 Prefabs" |

---

## Bonus possibles

- [ ] Ghost preview (entités semi-transparentes suivant la souris avant placement)
- [ ] Drag & drop des prefabs depuis le panneau vers le canvas
- [ ] Sauvegarder la sélection courante comme nouveau prefab
- [ ] Mode Zones (rectangles nommés avec rôle: spawn/combat/boss)
- [ ] Mode Auto-fill (remplir zone avec type d'entité)
- [ ] Support tactile (pinch zoom, drag handles)
