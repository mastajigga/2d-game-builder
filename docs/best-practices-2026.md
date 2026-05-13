# Phaser 3/4 TypeScript Game Dev — Best Practices 2026

Recherche compilée depuis genieee.com, generalistprogrammer.com, digitsensitive/phaser3-typescript,
docs.phaser.io, anthropics/skills, et l'expérience de projets 2D professionnels.

---

## 1. Architecture & Structure de projet

### Folder structure canonique (2026)

```
project/
├── src/
│   ├── main.ts              # Game config & entry point
│   ├── scenes/              # Phaser scenes (une par écran)
│   │   ├── BootScene.ts     # Preload assets + manifest
│   │   ├── MenuScene.ts     # UI menus
│   │   ├── GameScene.ts     # Gameplay principal
│   │   └── EditorScene.ts   # Éditeur de niveau
│   ├── entities/            # Game objects (Player, Enemy, Projectile...)
│   ├── systems/             # Systèmes (physics, combat, AI, spawn...)
│   ├── ui/                  # HUD, menus, overlays
│   ├── data/                # Level formats, asset catalogs, configs
│   └── utils/               # Helpers: math, constants, storage
├── public/assets/           # Assets organisés par pack
│   ├── manifest.json        # Manifeste central (si pas de catalogue TS)
│   └── <pack-name>/
├── tests/                   # Tests (Playwright pour canvas, Vitest pour logique)
├── .claude/                 # Claude Code skills
├── .agents/                 # Agent skills (Hermes, Cursor, etc.)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Règle cardinale** : séparer la logique métier des scènes. Les scènes sont des controlleurs légers.

---

## 2. Game Config & Résolution

### Configuration recommandée (2026)

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,            // WebGL prioritaire, fallback Canvas
  width: 1600,
  height: 900,
  parent: "game-container",
  backgroundColor: "#1a1a1a",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1800 },
      debug: false,             // true en dev, false en prod
    },
  },
  scene: [BootScene, MenuScene, GameScene],
};
```

### Points d'attention

- **Phaser.AUTO** > Phaser.CANVAS : WebGL offre de meilleures perfs pour tilemaps et particules
- **Définir les constantes de résolution** (`GAME_W`, `GAME_H`) dans un fichier `constants.ts`, pas en dur dans les scènes
- **Pixel art** : `pixelArt: true` + `roundPixels: true` + CSS `image-rendering: pixelated`

---

## 3. Asset Management

### Pattern : BootScene + Manifest/Catalog

Deux approches coexistent en 2026 :

**A) Manifest JSON** (Oak Woods original)
```json
{
  "meta": { "basePath": "assets/oakwoods" },
  "images": { "backgrounds": [...], "decorations": [...] },
  "spritesheets": { "character": {...} },
  "tilesets": { "main": {...} }
}
```
→ Avantage : data-driven, pas de recompilation

**B) Asset Catalog TypeScript** (Oak Woods actuel)
```typescript
export const ASSET_CATALOG: AssetDef[] = [
  { id: "platform-mossy", label: "Mossy A", category: "platform", ... },
  { id: "enemy-mushroom", label: "Champignon", category: "enemy", ... },
];
```
→ Avantage : type-safe, autocomplétion, pas de parsing JSON

### Règles

1. **Compresser les assets** avec TinyPNG/Squoosh avant intégration
2. **Sprite sheets > images individuelles** pour les perfs
3. **Preload dans BootScene** — ne jamais charger pendant le gameplay
4. **Lazy-load** les assets de scènes non immédiates (menu, crédits)
5. **Pas d'assets dans le repo Git** — documenter les sources (itch.io, packs, etc.)

---

## 4. Scene Management

### Scene lifecycle

```
BootScene (preload) → MenuScene → GameScene
                                   ↓
                              PauseScene → GameScene (resume)
                                   ↓
                              GameOverScene → GameScene (restart) / MenuScene (quit)
```

### Patterns clés

- **registry pour le cross-scene data** : `this.registry.set("level", levelData)`
- **Pas de `scene.restart()` pour reset** : préférer une méthode `reset()` qui reconstruit l'état
- **`scene.start()` vs `scene.launch()`** : start = switch (stop current), launch = overlay
- **`scene.sleep()` / `scene.wake()`** pour les menus pause

---

## 5. Physics & Collision

### Arcade Physics (standard 2D platformer)

```typescript
// Groupes statiques pour les plateformes
this.platforms = this.physics.add.staticGroup();

// Groupes dynamiques pour les ennemis, projectiles
this.enemies = this.physics.add.group();

// Colliders
this.physics.add.collider(this.player, this.platforms);
this.physics.add.overlap(this.player, this.enemies, this.onHitEnemy);
```

### Optimisations

- **`staticGroup`** pour tout ce qui ne bouge pas (plateformes, murs)
- **Désactiver les bodies inutilisés** : `body.setEnable(false)` pour les entités hors-écran
- **Object pooling** : `this.physics.add.group({ maxSize: 20 })` pour projectiles/particules
- **Hitbox plus petite que le sprite** : `body.setSize(w, h).setOffset(x, y)`

### Combat system (pattern actuel du projet)

```typescript
// Zone d'attaque invisible
this.atkZone = this.physics.add.image(0, 0, "__DEFAULT");
atkZone.body.setEnable(false);

// Activation pendant l'attaque
atkZone.body.setEnable(true);
// Vérification frame par frame
Phaser.Geom.Rectangle.Overlaps(atkZone.getBounds(), enemy.sprite.getBounds());
```

→ C'est un pattern solide, utilisé dans Hollow Knight, Dead Cells.

---

## 6. Entity System & State Machines

### Pattern recommandé : Entity classes avec state machine

```typescript
type EnemyState = "patrol" | "chase" | "attack" | "hurt" | "dead";

class Enemy {
  state: EnemyState = "patrol";
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;

  update(delta: number, playerX: number): void {
    switch (this.state) {
      case "patrol":  this._patrol(); break;
      case "chase":   this._chase(playerX); break;
      case "attack":  this._attack(); break;
      case "hurt":    break; // animation en cours
      case "dead":    return;
    }
  }
}
```

**Avantage** : chaque état est isolé, pas de `if (isAttacking && onGround && !isHurt && ...)`.

---

## 7. Level Editor (Éditeur de niveau)

### Architecture recommandée (2026)

```
EditorScene ←→ GymScene (test mode)
     ↕              ↕
  LevelData (shared via registry ou localStorage)
```

### Fonctionnalités standard d'un éditeur 2D (niveau professionnel)

| Fonctionnalité | Implémentée dans Oakwoods | À ajouter |
|---|---|---|
| Palette par catégories | ✅ | - |
| Snap-to-grid | ✅ | - |
| Drag & drop | ✅ | - |
| Suppression (clic droit) | ✅ | - |
| Flip horizontal | ✅ | - |
| Redimensionnement | ✅ (scale) | ✅ (width/height plateformes) |
| Undo/Redo | ❌ | Commande stack |
| Multi-sélection | ❌ | Shift+click |
| Copier/Coller | ❌ | Ctrl+C/V |
| Calques visibles/masquables | ❌ | Layer toggle |
| Export/Import JSON | ❌ | File download/upload |
| Preview avec collision visible | ❌ | Debug mode toggle |
| Tilemap painting (brush) | ❌ | Pour le tileset Mossy |

---

## 8. Tests

### Stratégie de test (2026)

1. **Tests unitaires** (Vitest) : LevelData, AssetCatalog, helpers math
2. **Tests canvas** (Playwright) : Vérifier que les scènes se lancent sans crash console
3. **Tests de régression visuelle** (Playwright + screenshots) : Comparer avant/après
4. **Tests de gameplay** : Input simulation (flèches, attaque), vérifier HP, positions

### Exemple Playwright pour Phaser

```python
page.goto("http://localhost:5173")
page.wait_for_timeout(2000)
page.keyboard.press("ArrowRight")
page.wait_for_timeout(500)
page.keyboard.press("KeyZ")  # attaque
# Vérifier qu'un ennemi a perdu des HP
errors = page.evaluate("() => window.__phaser_errors || []")
assert len(errors) == 0
```

---

## 9. Performance

### Checklist performance (par ordre d'impact)

1. **Object pooling** — réutiliser au lieu de create/destroy (projectiles, particules)
2. **Culling** — désactiver les entités hors caméra
3. **staticGroup** > **group** pour les plateformes
4. **TileSprite** pour les fonds parallax (déjà fait ✅)
5. **BitmapText** > **Text** pour HUD (gain ~30% draw calls)
6. **Sprite sheets > PNG individuels** (déjà fait ✅)
7. **Pas de `console.log` en prod**
8. **`setDepth()` cohérent** — éviter de changer le depth en boucle

---

## 10. Mobile & Responsive

### Obligatoire en 2026

- `scale.mode: Phaser.Scale.FIT`
- Touch input : `this.input.on("pointerdown", ...)`
- UI ancrée : `.setScrollFactor(0)` pour HUD, menus
- Pas de `alert()` / `prompt()` / `confirm()` — utiliser des overlays UI in-game
- Viewport meta tag correct dans index.html

---

## 11. Outils & Tooling

### Stack recommandée (2026)

| Outil | Usage |
|---|---|
| Vite 7+ | Bundler (déjà ✅) |
| TypeScript 5.9+ | Typage strict (déjà ✅) |
| Phaser 3.90+ | Moteur de jeu (Phaser 4 dispo mais 3.90 mature) |
| Prettier | Formattage |
| ESLint | Linting |
| Vitest | Tests unitaires |
| Playwright | Tests E2E canvas |
| Tiled | Éditeur de tilemaps externe (alternative à l'éditeur built-in) |
| Leshy SpriteSheet Tool | Découpage de spritesheets |

---

## 12. Références

- **digitsensitive/phaser3-typescript** : Le repo de référence avec 50+ exemples
- **genieee.com** : Guide best practices 2025
- **generalistprogrammer.com** : Tutorial complet 2025
- **anthropics/skills** : Format standard pour les skills AI agents
- **agentskills.io** : Spec du standard Agent Skills
- **docs.phaser.io** : Documentation officielle (Phaser v4.1.0 dispo)

---

*Document généré le 2026-05-09 — à mettre à jour tous les 6 mois.*
