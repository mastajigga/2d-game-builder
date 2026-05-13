# Oakwoods Builder V2 — Plan de refonte complète

> **Projet :** `C:\Users\Fortuné\Projects\mon-jeux-2D\vibejam-starter-pack\projects\oakwoods`
> **Date :** 2026-05-10
> **But :** Refonte du level builder avec UX/UI améliorée + nouvelles features gameplay

---

## Contexte actuel

Le builder existant (`EditorScene.ts` 1400 lignes, `GymScene.ts` 750 lignes) fonctionne mais est monolithique. L'unique ennemi est un champignon (`enemy-mushroom`). Pas de système de collision éditable, pas de rotation, pas de teintes, pas de stats personnage.

---

## Phase 1 — Architecture & Fondations (réfacto structurel)

### 1.1 Modulariser EditorScene.ts

**Problème :** 1400 lignes dans un seul fichier = impossible à maintenir.
**Solution :** Extraire en modules spécialisés.

| Module | Responsabilité | Fichier |
|---|---|---|
| `PaletteManager` | Rendu scrollable, sélection asset, highlight | `editor/PaletteManager.ts` |
| `EntityManager` | Spawn, destroy, undo/redo, sélection, drag | `editor/EntityManager.ts` |
| `PropertiesPanel` | Panel droit avec champs éditables | `editor/PropertiesPanel.ts` |
| `ToolbarManager` | Barre d'outils haute, changement de mode | `editor/ToolbarManager.ts` |
| `BackgroundBuilder` | Couleurs, shapes, parallax, layers | `editor/BackgroundBuilder.ts` |
| `CollisionEditor` | Gestion des hitboxes visuelles | `editor/CollisionEditor.ts` |
| `InputManager` | Tous les inputs clavier/souris | `editor/InputManager.ts` |
| `ConfirmDialog` | Dialog in-game (déjà fait, extraire) | `editor/ConfirmDialog.ts` |

### 1.2 Nouveau schéma de données (`LevelData.ts` v6)

```typescript
export interface PlacedEntity {
  uid: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  rotation: number;        // NOUVEAU : 0, 90, 180, 270
  width?: number;
  height?: number;
  // --- Collision éditable ---
  collision?: {
    enabled: boolean;
    x: number;      // offset relatif au sprite
    y: number;
    width: number;
    height: number;
  };
  // --- Ennemi ---
  name?: string;            // NOUVEAU : nom affiché au-dessus
  hp?: number;
  maxHp?: number;           // NOUVEAU
  damage?: number;          // NOUVEAU : dégâts infligés
  tint?: string;            // NOUVEAU : hex couleur teinte
  patrolMin?: number;
  patrolMax?: number;
  // --- Background ---
  backgroundLayerId?: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  jumpForce: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
}

export interface LevelData {
  version: number;        // bump to 6
  worldW: number;
  worldH: number;
  backgroundColor: string;
  backgroundLayers: BackgroundLayer[];
  backgroundShapes: BackgroundShape[];
  entities: PlacedEntity[];
  playerStats: PlayerStats;   // NOUVEAU
}
```

### 1.3 Migrations

- `STORAGE_KEY = "gym-level-v6"`
- Fonction `migrateV5toV6(level)` qui ajoute les defaults

---

## Phase 2 — Collision Editor (feature principale)

### 2.1 Mode "Collision"

Nouveau mode d'édition accessible via la toolbar ou raccourci `C`.

**Comportement :**
- Quand un asset est sélectionné + mode Collision actif, un rectangle semi-transparent rouge/vert s'affiche autour de l'asset
- Le rectangle est draggable par ses coins/bords pour redimensionner
- Shift+drag = snap à la grille
- Click droit sur la hitbox = menu : Reset / Disable / Copy to all same type
- Hitbox visible même en mode Play si `debug=true`

### 2.2 Rendu visuel

```typescript
// Graphics overlay par entity
hitboxGfx.lineStyle(2, collision.enabled ? 0x44ff44 : 0xff4444, 0.7);
hitboxGfx.strokeRect(entity.x + collision.x, entity.y + collision.y, collision.width, collision.height);
// Coins draggables
hitboxGfx.fillStyle(0xffffff, 0.9);
hitboxGfx.fillCircle(entity.x + collision.x, entity.y + collision.y, 4); // top-left
```

### 2.3 Application en runtime (GymScene)

Pour chaque `placedEntity` ayant `collision.enabled` :
- Si `platform` → `body.setSize(collision.width, collision.height)` avec offset
- Si `enemy` → `sprite.body.setSize()` + `setOffset()`
- Si `decoration` / `hazard` → créer un body statique invisible

---

## Phase 3 — Rotation par 90°

### 3.1 Editor

Raccourci `R` (remplace l'actuel "Reset" → migré vers `Ctrl+R`).
- `R` sans Ctrl = rotation +90°
- `Shift+R` = rotation -90°

L'asset pivote visuellement. Le `origin` Phaser suit la rotation.

### 3.2 Persistence

`rotation: 0 | 90 | 180 | 270` dans `PlacedEntity`.

### 3.3 Runtime

```typescript
obj.setAngle(entity.rotation);
```

Pour les plateformes : la hitbox physique doit aussi tourner (swap width/height si 90°/270°).

---

## Phase 4 — Stage Builder Mode

### 4.1 Séparation claire des modes

Nouveaux modes dans la toolbar :
- `Stage` — construction du monde (plateformes, décors, hazards)
- `Entities` — placement des personnages/ennemis/spawn
- `Background` — édition des couches de fond (comme actuel)
- `Collision` — édition des hitboxes

**En mode Stage :** les entités `enemy`/`spawn` sont masquées (alpha 0.1, non-interactives) pour ne pas gêner.

**En mode Entities :** les plateformes sont semi-transparentes (alpha 0.4), les décors masqués.

**En mode Background :** tout le gameplay est masqué, seuls les layers BG visibles.

### 4.2 Profondeur (Depth) explicite

Panel latéral montrant les layers de profondeur :
```
Depth -100  [Far BG     ]
Depth -50   [Mid BG     ]
Depth 0     [Platforms  ]  ← Stage
Depth 5     [Player     ]  ← Entities
Depth 10    [Enemies    ]  ← Entities
Depth 20    [Decor      ]  ← Stage
Depth 50    [Hazards    ]  ← Stage
Depth 100   [Foreground ]  ← Stage
```

Chaque layer a un toggle visibility indépendant.

---

## Phase 5 — Feature Ennemi enrichie

### 5.1 Nom au-dessus de la tête

```typescript
// Dans GymScene
private nameLabel!: Phaser.GameObjects.Text;
// Update every frame
nameLabel.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.sprite.height - 10);
```

Dans l'éditeur : champ texte "Nom" dans le panel propriétés.

### 5.2 Taille (échelle) dédiée

L'actuel `scale` est générique. Pour les ennemis, séparer :
- `scaleX` / `scaleY` dans le panel (ou un ratio locké)
- Slider 0.5 → 3.0 avec step 0.1

### 5.3 Teinte / Couleur

Picker couleur HTML5 dans le panel propriétés :
```typescript
sprite.setTint(Phaser.Display.Color.HexStringToColor(tint).color);
```

Valeur `"#ffffff"` = pas de teinte (défaut).

### 5.4 Vitalité

Slider HP (1-20) et Max HP (1-20).
Barre de vie proportionnelle en runtime.

### 5.5 Dégâts infligés

Champ numérique "Damage" (1-10).
Utilisé dans `GymScene._damagePlayer(enemyDamage)`.

---

## Phase 6 — Stats du personnage éditables

### 6.1 Nouveau bouton "Player Stats"

Ouvre un panel modal (dialog) avec :
- HP Max (1-20)
- Jump Force (400-1500)
- Move Speed (100-600)
- Attack Damage (1-10)
- Attack Range (50-300)
- Attack Cooldown (ms)

### 6.2 Persistence

Sauvegardé dans `LevelData.playerStats`.

### 6.3 Runtime

`GymScene` lit `level.playerStats` au lieu des constantes hardcodées.

---

## Phase 7 — Test Menu & Auto-Tests

### 7.1 Menu in-game (touche `M`)

```
┌─ Test Menu ───────────────┐
│ ▶ Test de saut            │
│ ▶ Test d'attaque          │
│ ▶ Test de patrouille      │
│ ▶ Test de collision       │
│ ▶ Test de boss (si créé)  │
│                           │
│ [✓] Auto-run on load      │
│ [✓] Show hitboxes         │
│ [✓] Show patrol zones     │
└───────────────────────────┘
```

### 7.2 Auto-tests

Chaque test = séquence automatisée :
- **Jump test :** place le joueur sur une plateforme, simule un saut, mesure si le joueur atteint une hauteur cible
- **Attack test :** place un dummy ennemi à portée, simule attaque, vérifie que l'ennemi prend des dégâts
- **Patrol test :** vérifie que l'ennemi ne sort pas de sa zone min/max
- **Collision test :** trace des rayons pour vérifier que les hitboxes sont cohérentes

Résultat affiché en overlay : ✅ / ❌ avec détail.

---

## Phase 8 — UX/UI Améliorations

### 8.1 Palette améliorée
- Barre de recherche par nom
- Tabs par catégorie (au lieu de scroll infini)
- Favoris (étoile sur chaque asset)
- Preview tooltip au hover

### 8.2 Toolbar modernisée
- Icônes au lieu de texte brut
- Sélection visuelle plus forte
- Groupes logiques : [Modes] | [Actions] | [Tests] | [View]

### 8.3 Raccourcis clavier
| Touche | Action |
|---|---|
| 1-4 | Switch mode Stage/Entity/BG/Collision |
| Tab | Playtest |
| R | Rotate +90° |
| Shift+R | Rotate -90° |
| F | Flip X |
| C | Toggle Collision mode |
| H | Toggle hitbox visibility |
| P | Toggle patrol zones |
| M | Open Test Menu |
| Ctrl+S | Save |
| Ctrl+E | Export |
| Ctrl+Z/Y | Undo/Redo |

### 8.4 Zoom amélioré
- Zoom centré sur le curseur (pas sur le centre écran)
- Zoom min/max indicators
- Fit-to-screen bouton

---

## Phase 9 — Idées bonus (si temps)

### 9.1 Layer system complet
- Renommer les layers
- Ajouter/supprimer des layers
- Opacité par layer
- Lock layer (non éditable)

### 9.2 Snap options
- Snap 1, 8, 16, 32, 64 px
- Snap à la grille visible/invisible
- Snap aux autres objets (smart guides)

### 9.3 Asset Replacement
- Sélectionner un asset → click sur un autre dans la palette = remplacement
- Garde position/scale/rotation/hitbox

### 9.4 Level Settings
- Taille du monde (W/H)
- Gravité globale
- Musique de fond (choix fichier)

### 9.5 Mini-map
- Petit rectangle en haut à droite
- Affiche tout le niveau en miniature
- Rectangle indiquant la vue actuelle
- Click pour téléporter la caméra

### 9.6 Boss Editor
- Ajouter un type "boss" au catalogue
- Phases éditables (HP threshold → nouvel état)
- Patterns d'attaque éditables
- Taille/couleur comme demandé initialement

---

## Phase 10 — Exécution & Structure

### Ordre d'implémentation

1. **Infrastructure** : créer les dossiers `editor/`, extraire les modules
2. **Data** : bump schema v6, migrations, `PlayerStats`
3. **Rotation** : champ + raccourci + rendu
4. **Collision Editor** : mode, rendu visuel, drag, persistence, runtime
5. **Stage/Entity/BG modes** : filtrage visuel, toolbar
6. **Ennemi features** : nom, taille, teinte, vitalité, dégâts
7. **Player Stats** : panel modal, persistence, runtime
8. **Test Menu** : UI, auto-tests basiques
9. **UX polish** : palette tabs, recherche, mini-map, shortcuts

### Fichiers à créer/modifier

**Créer :**
```
src/editor/
  ├── PaletteManager.ts
  ├── EntityManager.ts
  ├── PropertiesPanel.ts
  ├── ToolbarManager.ts
  ├── BackgroundBuilder.ts
  ├── CollisionEditor.ts
  ├── InputManager.ts
  ├── ConfirmDialog.ts
  └── TestMenu.ts
```

**Modifier :**
```
src/level/LevelData.ts          → v6 schema + PlayerStats
src/level/AssetCatalog.ts       → ajout boss, metadata
src/scenes/EditorScene.ts       → refactor orchestrateur
src/scenes/GymScene.ts          → PlayerStats, tint, name labels, hitboxes
src/main.ts                     → rien (scenes déjà enregistrées)
```

---

## Vérification finale

- [ ] Build passe sans erreur TS (`npm run build`)
- [ ] Editor démarre, palette scrollable
- [ ] Rotation 90° fonctionne sur plateforme + décor
- [ ] Collision box éditable visuellement
- [ ] Mode Stage masque les ennemis
- [ ] Mode Entities masque les plateformes
- [ ] Ennemi a nom + teinte + HP custom en runtime
- [ ] Player stats modifiables et appliquées en test
- [ ] Test menu s'ouvre et les auto-tests passent
- [ ] Undo/redo fonctionne sur toutes les nouvelles actions
