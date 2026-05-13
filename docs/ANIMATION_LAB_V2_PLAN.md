# Animation Lab V2 — Plan d'implémentation

**Objectif** : Transformer l'Animation Lab en un studio d'animation 2D complet avec édition de sprites, clonage de personnages et gestion d'assets.

---

## 📝 Table des matières

1. [Phase 1 — Clonage de personnage](#phase-1--clonage-de-personnage)
2. [Phase 2 — Éditeur de sprites (style MS Paint)](#phase-2--éditeur-de-sprites-style-ms-paint)
3. [Phase 3 — Gestion des frames & séquences](#phase-3--gestion-des-frames--séquences)
4. [Phase 4 — Intégration & tests](#phase-4--intégration--tests)

---

## Phase 1 — Clonage de personnage

### 1.1 But
Permettre de dupliquer un asset existant (ex: "Champignon" → "Champignon_v2") pour en créer une variante sans toucher l'original.

### 1.2 UI — Bouton "Cloner"
- Dans la toolbar de l'Animation Lab, ajouter un bouton **🖼️ Cloner** à côté du sélecteur d'asset.
- Au clic : popup modale demandant le **nouveau nom** et le **nouveau dossier de destination**.

### 1.3 Logique de clonage
```
Asset source :
  - sheetPath  : assets/Mushroom-Run.png
  - frameW/H   : 80x64
  - totalFrames: 8

Clone crée :
  - Nouvelle entrée dans AssetCatalog (runtime uniquement, persistante via localStorage)
  - Copie du fichier PNG dans public/assets/clones/<nouveau-nom>.png
  - Nouveau textureKey unique (ex: mush-run-clone-1)
  - Mêmes frameW, frameH, totalFrames, defaultAnim
```

### 1.4 Persistance
- Stocker les clones dans `localStorage` sous la clé `oakwoods-asset-clones`.
- Au démarrage de l'app, merger ces clones dans `ASSET_CATALOG`.

### 1.5 Fichiers touchés
- `src/editor-ui/AnimationPageUI.ts` — UI bouton + modale
- `src/level/AssetCatalog.ts` — fonction `loadClones()` + `saveClone()`
- `src/editor-ui/styles/editor-ui.css` — styles modale + filmstrip clone tag

---

## Phase 2 — Éditeur de sprites (style MS Paint)

### 2.1 But
Offrir un éditeur de dessin intégré pour modifier une frame ou créer une nouvelle image pixel-art.

### 2.2 Layout de l'éditeur
```
┌──────────────────────────────────────────────────────────────────┐
│  🖌️ 🖊️ 🧴 🖼️ 🗑️ │  Outils (pinceau, gomme, pot de peinture, pipette, effacer)      │
├──────────────────────────────────────────────────────────────────┤
│                                              │  │ Couleurs :       │
│                                              │  │ ◼◼◼◼◼◼◼◼    │
│          CANVAS D'ÉDITION                    │  │ palette 16       │
│         (zoom 1x–8x)                         │  │                  │
│                                              │  │ Taille : [2px]   │
│                                              │  │                  │
│                                              │  │ Opacité :        │
│                                              │  │ [=======] 100%   │
│                                              │  │                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Outils implémentés

| Outil | Icône | Comportement |
|-------|-------|--------------|
| **Pinceau** | 🖌️ | Clic + drag = dessine des pixels |
| **Gomme** | 🖊️ | Efface (rend transparent ou couleur de fond) |
| **Pot de peinture** | 🧴 | Flood-fill (remplissage d'une zone de même couleur) |
| **Pipette** | 💡 | Clic = capture la couleur du pixel sous le curseur |
| **Formes** | □○ | Rectangle / Cercle pleins ou en contour |
| **Ligne** | ─ | Ligne droite avec shift pour angles multiples de 45° |
| **Sélection** | ◻ | Rect-select + déplacer/copier/coller la zone |

### 2.4 Canvas édition
- **Backend** : un `<canvas>` HTML5 avec `image-rendering: pixelated`
- **Zoom** : zoom virtuel (affichage zoomé, coordonnées logiques)
- **Grid** : option grille pixel (1px visible au zoom ≥ 4x)
- **Undo/Redo** : pile d'états `ImageData` (limité à 50 étapes)

### 2.5 Palette de couleurs
- Palette de **16 couleurs** par défaut (EGA-style)
- Possibilité d'ajouter une couleur custom via `<input type="color">`
- Historique des 8 dernières couleurs utilisées

### 2.6 Export
- Bouton **💾 Sauver la frame** → remplace la frame courante dans la spritesheet
- Bouton **📤 Exporter PNG** → télécharge le canvas comme PNG

### 2.7 Fichiers touchés
- **Nouveau** : `src/editor-ui/SpriteEditorUI.ts` — logique complète de l'éditeur
- **Nouveau** : `src/editor-ui/SpriteEditorTools.ts` — outils (brush, flood fill, shapes)
- `src/editor-ui/styles/editor-ui.css` — styles de l'éditeur
- `src/editor-ui/AnimationPageUI.ts` — bouton "Éditer" pour chaque frame

---

## Phase 3 — Gestion des frames & séquences

### 3.1 But
Permettre d'ajouter, supprimer, réordonner des frames dans une animation, et de créer de nouvelles animations.

### 3.2 Filmstrip amélioré
- **Drag & drop** pour réordonner les frames
- **Clic droit** sur une frame : menu contextuel
  - → **Insérer une frame vide** après
  - → **Dupliquer** cette frame
  - → **Supprimer** cette frame
  - → **Éditer** (ouvre le Sprite Editor)

### 3.3 Ajout d'une nouvelle image
**Processus complet :**
1. L'utilisateur clique **"+ Ajouter une image"**
2. Modal avec deux options :
   - **Importer un fichier** : `<input type="file" accept="image/png">`
   - **Créer une frame vide** : ouvre le Sprite Editor avec un canvas vide de la taille des frames existantes
3. L'image importée ou créée est ajoutée à la fin de la spritesheet
4. La spritesheet est reconstruite côté client :
   ```
   Nouveau canvas = ancienne spritesheet + nouvelle frame à droite
   Si dépassement de ligne → ajouter une ligne en bas
   ```
5. `totalFrames` du catalogue est incrémenté
6. Le filmstrip est mis à jour

### 3.4 Nouvelle animation
- Bouton **"+ Nouvelle animation"** dans la sidebar
- Modal : nom de l'animation, frame de début, frame de fin, frameRate, repeat
- La nouvelle animation est ajoutée à la `states` list

### 3.5 Fichiers touchés
- `src/editor-ui/AnimationPageUI.ts` — drag & drop, context menu, bouton ajout
- **Nouveau** : `src/editor-ui/SpriteSheetBuilder.ts` — reconstruction de spritesheet côté client
- `src/editor-ui/styles/editor-ui.css` — drag ghost, context menu

---

## Phase 4 — Intégration & tests

### 4.1 Architecture finale
```
AnimationPageUI
├── SpriteEditorUI (modal overlay)
│   ├── SpriteEditorTools (brush, flood fill, shapes, select)
│   └── Palette de couleurs
├── Filmstrip (frames + drag & drop + context menu)
├── SpriteSheetBuilder (reconstruction client-side)
└── AssetCatalog (clones persistant localStorage)
```

### 4.2 Tests
1. **Build** : `npm run build` → 0 erreur
2. **TypeScript** : `npx tsc --noEmit` → clean
3. **Manuels** :
   - Cloner un personnage → apparait dans le sélecteur
   - Éditer une frame → les changements persistent
   - Ajouter une image → nouvelle frame visible dans le filmstrip
   - Drag & drop frames → réordonnement effectif

### 4.3 Livrables
| Fichier | Description |
|---------|-------------|
| `src/editor-ui/AnimationPageUI.ts` | Page principale (modifiée) |
| `src/editor-ui/SpriteEditorUI.ts` | Éditeur de sprites (nouveau) |
| `src/editor-ui/SpriteEditorTools.ts` | Outils de dessin (nouveau) |
| `src/editor-ui/SpriteSheetBuilder.ts` | Builder de spritesheet (nouveau) |
| `src/level/AssetCatalog.ts` | Clones + persistance (modifié) |
| `src/editor-ui/styles/editor-ui.css` | Styles (modifié) |

---

## ⏰ Estimation

| Phase | Durée estimée |
|-------|--------------|
| Phase 1 — Clonage | 2h |
| Phase 2 — Éditeur MS Paint | 6h |
| Phase 3 — Gestion frames | 4h |
| Phase 4 — Intégration | 2h |
| **Total** | **~14h** |

---

*Document généré le 2026-05-11 pour le projet Orion & Sirius.*
