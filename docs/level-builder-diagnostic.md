# Diagnostic Level Builder — Oakwoods

Analyse croisée utilisant les 3 skills : `phaser-gamedev`, `game-level-design`, `pixel-art-game-assets`.
Date : 2026-05-09

---

## BUG #1 ⚠️ — La palette n'affiche pas tous les assets

### Cause racine : overflow vertical, pas de scroll

La palette est rendue à des positions Y absolues dans un container. Avec 30 assets répartis en 4 catégories,
le contenu total fait **1378px** alors que l'écran n'en fait que **900px**.

```
Catégorie        Items   Y début   Y fin     Visible ?
─────────────────────────────────────────────────────
▣ Plateformes      14      42px     572px    ✅ OUI
✿ Décor            14     592px    1122px    ⚠️  300px coupés
☠ Ennemis           1    1142px    1248px    ❌ NON (hors écran)
★ Spawn             1    1268px    1374px    ❌ NON (hors écran)
```

**Conséquence** : les catégories Ennemis (Champignon) et Spawn (Spawn joueur) sont **totalement invisibles**.
La moitié des décorations aussi. L'utilisateur ne peut placer ni ennemis ni spawn, rendant l'éditeur inutilisable
pour créer un niveau jouable.

### Solution

Rendre la palette scrollable indépendamment. Deux approches :

**A) Scroll container (recommandé)** — Ajouter une zone scrollable dans la palette :
- Limiter la hauteur visible de la palette à `H - 20px`
- Ajouter un masque (`setMask`) sur le contenu
- Gérer `wheel` event pour scroller verticalement
- Ajouter une scrollbar visuelle (optionnel mais UX++)

**B) Pagination par onglets** — Afficher une seule catégorie à la fois avec des onglets en haut :
- Onglet Plateformes | Décor | Ennemis | Spawn
- Chaque onglet n'affiche que sa catégorie
- Hauteur max par onglet : ~600px → tout tient

### Bug secondaire : la palette n'est pas fixée à la caméra

Le `uiContainer` est ajouté au monde mais sans `setScrollFactor(0)`. Quand on scrolle avec les flèches,
la palette défile avec le monde et disparaît à gauche. Il faut :

```typescript
this.uiContainer.setScrollFactor(0);  // Fixe la palette à l'écran
```

---

## BUG #2 ⚠️ — Performance : 780 PNGs de plantes chargés individuellement

### Analyse (pixel-art-game-assets)

Les 13 types de plantes sont dans des dossiers avec ~60 frames PNG individuelles chacun.
Le catalogue charge UNE frame par plante via `this.load.image()`, donc seulement 13 images.
Mais les 780 fichiers existent dans `public/assets/`. Même si Phaser ne les charge pas,
le simple fait d'avoir 780 fichiers dans l'arborescence est un problème :

- **Vite HMR** : surveille tous les fichiers dans `public/`, 780 fichiers = démarrage lent
- **Déploiement** : 780 fichiers à copier/servir
- **Future-proof** : si on voulait animer les plantes, il faudrait charger 780 sprites

**Solution** (priorité moyenne) : Convertir en spritesheets avec ImageMagick
```bash
montage Plant1_000*.png -tile 10x6 -geometry 96x96+0+0 plant1-spritesheet.png
```
13 spritesheets au lieu de 780 PNGs. Ou ne garder que la frame utilisée et supprimer le reste.

---

## BUG #3 ⚠️ — L'asset "Plantes suspendues" (hanging-plants) n'a pas de vignette correcte

Dans AssetCatalog, `hanging-plants` a `originY: 0` (accroché en haut) et `tileOffsetX: 0, tileOffsetY: 0`.
Dans la palette, le code essaie de créer une vignette avec `this.add.image()` (car pas de `sheetPath`).
Mais l'image source est `Mossy - Hanging Plants.png` qui est une grande texture avec plusieurs plantes.
Le `tileOffsetX/Y` n'est pas appliqué pour les vignettes image → on voit la texture entière écrasée
dans 96×96px, ce qui est illisible.

**Solution** : Pour les assets de type `image` qui ont un `tileOffsetX/Y`, utiliser un `TileSprite`
en vignette aussi (comme pour les plateformes).

---

## ÉTAT ACTUEL DE L'ÉDITEUR — Ce qui fonctionne ✅

| Fonctionnalité | Statut |
|---|---|
| Palette par catégories | ✅ |
| Snap-to-grid 16px | ✅ |
| Placement clic gauche | ✅ |
| Suppression clic droit | ✅ |
| Drag & drop pour déplacer | ✅ |
| Preview fantôme au curseur | ✅ |
| Outlines colorés (vert=sélection, bleu=plateforme, rouge=ennemi, jaune=spawn) | ✅ |
| Zone de patrouille visible | ✅ |
| Flip horizontal (F) | ✅ |
| Redimensionnement scale ([ ])  | ✅ |
| Grille toggle (G) | ✅ |
| Save localStorage (S) | ✅ |
| Reset (R) | ✅ |
| Test mode (TAB) | ✅ |
| Raccourcis clavier | ✅ |

---

## CE QUI MANQUE — Level builder complet & intuitif

### Priorité 1 — Critique (bloquant)

| # | Fonctionnalité | Justification (skill) |
|---|---|---|
| 1 | **Palette scrollable** | BUG : la moitié des assets sont invisibles. Sans ça, l'éditeur est cassé. |
| 2 | **Palette fixée à la caméra** | BUG : la palette disparaît quand on scrolle le monde. |
| 3 | **Undo/Redo** (Ctrl+Z / Ctrl+Y) | game-level-design : itérer vite est le principe n°1 du design de niveaux. Sans undo, chaque erreur coûte cher. |

### Priorité 2 — Essentiel (expérience fluide)

| # | Fonctionnalité | Justification |
|---|---|---|
| 4 | **Copier/Coller** (Ctrl+C / Ctrl+V) | game-level-design : grouper des ennemis, répliquer une structure de plateformes. |
| 5 | **Multi-sélection** (Shift+clic / drag-select) | game-level-design : déplacer un groupe de décorations ou une section entière. |
| 6 | **Panel de propriétés** pour l'entité sélectionnée | Afficher et éditer : HP ennemi, zone de patrouille (min/max), scale, largeur/hauteur plateforme. Actuellement tout est au clavier, rien n'est visible. |
| 7 | **Supprimer la sélection** avec un bouton visible (pas seulement DEL) | game-level-design : découvrabilité. Un nouvel utilisateur ne sait pas que DEL supprime. |
| 8 | **Confirmation dialog in-game** (pas `confirm()` navigateur) | pixel-art-game-assets : cohérence visuelle. Le `confirm()` HTML casse l'immersion. |

### Priorité 3 — Confort (UX pro)

| # | Fonctionnalité | Justification |
|---|---|---|
| 9 | **Playtest from cursor** (pas seulement du spawn) | game-level-design : tester une section spécifique sans rejouer tout le niveau. |
| 10 | **Barre d'outils visuelle** avec modes : Placer / Sélectionner / Supprimer / Panoramique | Aujourd'hui les modes sont implicites. Un bouton "mode suppression" serait plus clair que "clic droit". |
| 11 | **Curseurs de souris contextuels** (croix de placement, main de drag, gomme) | Feedback visuel immédiat sur le mode actif. |
| 12 | **Raccourcis visibles en permanence** (barre en bas ou panneau latéral) | game-level-design : ne pas mémoriser les touches. |
| 13 | **Zoom/Panoramique** (molette = zoom, clic milieu = pan) | game-level-design : travailler sur des détails fins. |
| 14 | **Sauvegarde automatique** avec indicateur visuel | game-level-design : sécurité. Un crash ne devrait pas faire perdre 30 min de travail. |
| 15 | **Export/Import JSON** (fichier .json téléchargeable) | game-level-design : partager des niveaux, backup externe. |
| 16 | **Filtre/recherche dans la palette** | Avec beaucoup d'assets, trouver "Plante 7" dans 14 décorations est lent. |

### Priorité 4 — Polish (qualité pro)

| # | Fonctionnalité | Justification |
|---|---|---|
| 17 | **Outil règle/mesure** (afficher la distance entre deux clics) | game-level-design : mesurer les gaps de saut. Le skill recommande 0.85× hauteur max. |
| 18 | **Aperçu de la hitbox** pendant le placement d'ennemis | game-level-design : voir la zone où l'ennemi va patrouiller/détecter. |
| 19 | **Calques** (background, platforms, entities, decor) avec toggle visibilité | game-level-design : travailler sur un calque sans être gêné par les autres. |
| 20 | **Grille aimantée configurable** (8px, 16px, 32px, off) | Certains assets ont besoin de précision différente. |
| 21 | **Numérotation automatique des entités** | Debug : "ennemi 3 buggé" → lequel ? |
| 22 | **Preview des animations** dans la palette (pas juste frame 0) | pixel-art-game-assets : voir l'animation idle du champignon avant de le placer. |
| 23 | **Loading screen** avec barre de progression | pixel-art-game-assets : le Mossy 3584×3584 prend du temps à charger. L'utilisateur voit un écran noir. |
| 24 | **World bounds handles** (poignées pour ajuster la largeur du monde) | game-level-design : changer la taille du niveau sans éditer le code. |

---

## PLAN D'ACTION RECOMMANDÉ

### Phase 1 — Réparer (aujourd'hui)
```
1. Palette scrollable (overflow fix)
2. Palette fixée à la caméra (setScrollFactor(0))
```

### Phase 2 — Solidifier (cette semaine)
```
3. Undo/Redo (Ctrl+Z/Y)
4. Panel de propriétés (HP, patrol, scale visibles et éditables)
5. Dialog in-game pour reset (remplacer confirm())
6. Bouton "Supprimer" visible + amélioration toolbar
```

### Phase 3 — Enrichir (ce mois)
```
7. Copier/Coller + multi-sélection
8. Playtest from cursor
9. Zoom/Panoramique
10. Auto-save indicator
11. Export/Import JSON
```

### Phase 4 — Polir (quand le cœur est solide)
```
12. Calques
13. Outil règle
14. Filtre palette
15. Preview animations
16. Loading screen
17. Curseurs contextuels
```

---

## DÉTAIL D'IMPLEMENTATION — Palette scrollable

```typescript
// Dans EditorScene, après _buildPalette()

// 1. Fixer le container à la caméra
this.uiContainer.setScrollFactor(0);

// 2. Ajouter un masque pour cacher le débordement
const maskShape = this.make.graphics();
maskShape.fillRect(0, 0, PALETTE_W, H);
const mask = maskShape.createGeometryMask();
this.uiContainer.setMask(mask);

// 3. Gérer le scroll
this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[]) => {
  const delta = _gy[0] ?? _gz[0]; // Y scroll (trackpad) ou Z (souris)
  if (delta === 0) return;
  this.uiContainer.y = Phaser.Math.Clamp(
    this.uiContainer.y - delta * 0.5,
    -(this.paletteTotalHeight - H),  // scroll max vers le haut
    0                                  // scroll min (haut de la palette)
  );
});

// 4. Scrollbar visuelle (optionnel)
// Barre à droite de la palette, hauteur proportionnelle
```

---

## DÉTAIL D'IMPLEMENTATION — Undo/Redo

```typescript
// src/level/UndoManager.ts
interface UndoAction {
  type: "place" | "delete" | "move" | "modify";
  entity: PlacedEntity;
  previous?: PlacedEntity;  // état avant modification
}

class UndoManager {
  private stack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxSize = 50;

  push(action: UndoAction): void {
    this.stack.push(action);
    this.redoStack = []; // nouveau chemin = effacer redo
    if (this.stack.length > this.maxSize) this.stack.shift();
  }

  undo(): UndoAction | null {
    const action = this.stack.pop();
    if (action) this.redoStack.push(action);
    return action ?? null;
  }

  redo(): UndoAction | null {
    const action = this.redoStack.pop();
    if (action) this.stack.push(action);
    return action ?? null;
  }
}
```

---

*Rapport généré avec `phaser-gamedev` + `game-level-design` + `pixel-art-game-assets`.*
