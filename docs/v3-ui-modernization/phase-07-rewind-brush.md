# Phase 7 — Rewind + Tile Brush

> **Durée estimée** : 4–6h  
> **Dépendances** : Phase 5 (checkpoints + gameplay stable)  
> **Objectif** : Ajouter deux outils de productivité pour le level design.

---

## 7.1 Objectif

- **Rewind** : En playtest (`GymScene`), touche `Backspace` = retour en arrière de ~3 secondes. Implémenté via un buffer circulaire d'états.
- **Tile Brush** : En mode `Stage` de l'éditeur, drag-glisse pour "peindre" des plateformes/tuiles continues au lieu de placer un asset à la fois.

---

## 7.2 Fichiers à créer

```
src/
├─ editor/
│   └─ TileBrush.ts         # Logique de peinture en drag
└─ gameplay/
    └─ RewindBuffer.ts      # Buffer circulaire d'états joueur
```

## 7.3 Fichiers à modifier

```
src/scenes/GymScene.ts         # Intégrer RewindBuffer
src/scenes/EditorScene.ts      # Intégrer TileBrush en mode Stage
src/editor-ui/ToolbarUI.ts     # Toggle Tile Brush
```

---

## 7.4 Tâches détaillées

### Tâche 7.1 : RewindBuffer

```typescript
interface GameStateFrame {
  timestamp: number;
  playerX: number;
  playerY: number;
  playerVelocityX: number;
  playerVelocityY: number;
  playerHp: number;
  deadEnemies: string[];
}
```

- [ ] `RewindBuffer` : tableau circulaire de 180 frames (≈ 3 secondes à 60fps)
- [ ] Méthode `push(state: GameStateFrame)` — ajoute un état, éjecte le plus ancien si plein
- [ ] Méthode `rewind(seconds: number): GameStateFrame` — retourne l'état à `now - seconds`

### Tâche 7.2 : Intégrer Rewind dans GymScene

- [ ] Dans `GymScene.update()` :
  - Toutes les frames (ou tous les 3 ticks pour perf), pousser un `GameStateFrame` dans le buffer
- [ ] Écouter la touche `Backspace`
  - Si buffer non vide : récupérer l'état à -3s
  - Téléporter le joueur
  - Restaurer velocity et HP
  - Optionnel : respawn les ennemis tués entre temps (complexe, v2)
  - Effet visuel : flash blanc + son

**Critère d'acceptation** : En plein saut raté, appuyer sur Backspace remet le joueur 3 secondes en arrière instantanément.

### Tâche 7.3 : TileBrush

- [ ] `TileBrush` classe avec :
  - `active: boolean`
  - `selectedAssetId: string`
  - `brushSize: number` (1x1, 2x2, 3x3 tiles)
  - `snapToGrid: boolean` (toujours true pour l'instant)
- [ ] Dans `EditorScene` en mode `Stage` :
  - Si TileBrush actif + clic maintenu :
    - Calculer la position souris → monde → grille
    - Si aucun asset du même type n'est déjà à cette position (tolérance 4px) :
      - Placer l'asset
    - Continuer tant que le bouton est maintenu
  - Débouce : max 1 placement tous les 100ms pour éviter le spam

**Critère d'acceptation** : Glisser la souris en mode Stage avec TileBrush pose une rangée continue de plateformes.

### Tâche 7.4 : UI du TileBrush

- [ ] Dans `ToolbarUI`, quand le mode est `Stage` :
  - Afficher un sous-toolbar : `[Tile Brush: ON/OFF] [Taille: 1x1 ▼]`
- [ ] Toggle et dropdown en DOM natif
- [ ] Émettre `set-tile-brush` vers le bridge

### Tâche 7.5 : Build et validation

- [ ] `npm run build`
- [ ] Tester Rewind : tomber dans un trou → Backspace → retour en haut
- [ ] Tester TileBrush : drag horizontal → mur continu de 10 plateformes

---

## 7.5 Définition de fini

- [ ] Rewind fonctionne en playtest (Backspace = -3s)
- [ ] TileBrush fonctionne en mode Stage (drag = peinture continue)
- [ ] Build OK
