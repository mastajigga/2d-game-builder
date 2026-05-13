# Phase 6 — Mini-carte + World Settings

> **Durée estimée** : 3–4h  
> **Dépendances** : Phase 2 (UI DOM complète)  
> **Objectif** : Ajouter une mini-carte du niveau et un panel de réglages du monde.

---

## 6.1 Objectif

- **Mini-carte** : Petit rectangle en haut à droite montrant tout le niveau en miniature + rectangle indiquant la vue actuelle
- **World Settings** : Panel DOM permettant d'éditer :
  - Taille du monde (W, H)
  - Couleur de fond
  - Gravité globale
  - (Optionnel) Musique de fond

---

## 6.2 Fichiers à créer

```
src/editor-ui/
├─ MiniMapUI.ts
└─ WorldSettingsUI.ts
```

## 6.3 Fichiers à modifier

```
src/scenes/EditorScene.ts      # Émettre camera-moved vers le bridge
src/level/LevelData.ts         # S'assurer que worldW/worldH sont éditables
```

---

## 6.4 Tâches détaillées

### Tâche 6.1 : MiniMapUI — rendu CSS/Canvas secondaire

**Option A (retenue)** : Rendu dans un `<canvas>` secondaire de 200x150px, géré par Phaser.

**Pourquoi pas CSS pur** : Pour des niveaux de 5000x2000px avec centaines d'assets, recréer tous les éléments DOM miniatures est lourd. Un canvas secondaire est plus simple.

**Pourquoi pas un deuxième jeu Phaser** : Trop lourd. On utilise un simple `Phaser.GameObjects.Graphics` mis à jour dans `EditorScene.update()`.

Implémentation :
- [ ] Dans `index.html`, ajouter `<canvas id="minimap" width="200" height="150"></canvas>`
- [ ] `MiniMapUI.ts` gère le positionnement CSS (top-right)
- [ ] `EditorScene` reçoit une référence vers `#minimap`
- [ ] Dans `EditorScene.update()` :
  - Effacer le mini-canvas
  - Dessiner un rectangle pour le monde entier (bordure)
  - Dessiner un petit rectangle pour chaque entité (1-2px, couleur selon catégorie)
  - Dessiner un rectangle rouge translucide pour la vue actuelle de la caméra
- [ ] Écouter le clic sur le mini-canvas → convertir coordonnées mini → monde → téléporter la caméra

**Critère d'acceptation** : La mini-carte montre toutes les entités. Clic → téléportation instantanée.

### Tâche 6.2 : WorldSettingsUI

- [ ] Bouton "⚙️" (engrenage) dans la toolbar → ouvre le panel
- [ ] Panel modal DOM (à droite ou centré) avec :
  - `World Width` : input number (min 800, max 20000, step 100)
  - `World Height` : input number (min 600, max 5000, step 100)
  - `Background Color` : `<input type="color">`
  - `Gravity Y` : input number (min 0, max 5000, step 100)
  - Boutons : `Appliquer`, `Annuler`
- [ ] Émettre `update-world-settings` vers le bridge
- [ ] `EditorScene` écoute et ajuste :
  - `this.cameras.main.setBounds(0, 0, newW, newH)`
  - `this.physics.world.setBounds(0, 0, newW, newH)`
  - `this.cameras.main.setBackgroundColor(newColor)`
- [ ] `LevelData` est mis à jour et sera persisté au prochain save

**Critère d'acceptation** : Modifier la taille du monde étend/retrécit les bounds. La couleur de fond change immédiatement.

### Tâche 6.3 : Build et validation

- [ ] `npm run build`
- [ ] Tester : éditer worldW → placer un asset au bord → zoom out → voir que le monde est plus grand

---

## 6.5 Définition de fini

- [ ] La mini-carte affiche le monde, les entités, et la vue caméra
- [ ] Clic sur la mini-carte téléporte la caméra
- [ ] Le panel World Settings permet d'éditer W, H, couleur, gravité
- [ ] Build OK
