# Roadmap Orion & Sirius — Le Builder de 2026

## 1. Philosophie du Builder

**Orion & Sirius** n'est pas qu'un éditeur de niveaux. C'est un **studio de création intégré** pour jeux 2D pixel-art, conçu autour de trois piliers :

1. **Instantanéité** — Toute modification est visible en temps réel. Pas de compilation, pas de changement de contexte. Le feedback visuel est immédiat.
2. **Itération sans friction** — Undo/redo illimité, sauvegardes par slot, playtest en un clic (Tab). L'éditeur et le runtime partagent le même moteur Phaser ; ce que tu vois est ce que tu joues.
3. **Créativité guidée** — Pas de feuilles blanches. Des templates, des systèmes (ennemis, checkpoints, victory zones), des outils d'animation et de test qui suggèrent plutôt qu'ils n'imposent.

Pourquoi "Orion & Sirius" ? Orion est le chasseur, l'architecte du niveau. Sirius est l'étoile la plus brillante, la vision que le joueur verra. Le builder est le point de rencontre entre les deux.

## 2. État actuel (v2.x)

- Éditeur de niveau hybride Phaser + DOM
- Palette d'assets avec filtres et recherche
- Toolbar avec modes (Stage, Entity, BG, Collision, Select, Delete, Pan)
- Properties panel éditable (position, scale, rotation, tint, collision, HP, etc.)
- Système undo/redo
- Playtest intégré (Tab)
- Test runner interne (5 scénarios : palette, toolbar, delete, bg depth, undo/redo)
- Save/load avec 5 slots
- World hub avec sélection de niveaux
- Parallax backgrounds avec profondeur et tint
- Minimap

## 3. Features à ajouter — Priorisées

### Phase A — Fondation (semaine 1)

| # | Feature | Pourquoi |
|---|---------|----------|
| A1 | Rebranding complet "Orion & Sirius" | Identité propre, découplage de l'asset pack Oakwoods |
| A2 | Menu principal avec accès **Test** et **Animation** | Centralisation de tous les outils du studio |
| A3 | Intégration Playwright E2E dans le menu Test | Qualité continue, tests visibles pour les non-devs |
| A4 | Test dashboard (résultats, historique, couverture) | Métriques de confiance sur le build |

### Phase B — Animation (semaine 2)

| # | Feature | Pourquoi |
|---|---------|----------|
| B1 | **Animation Preview** — lecture des spritesheets avec contrôles (play, pause, frame-by-frame, vitesse) | Vérifier les assets avant placement |
| B2 | **State Machine Editor** — graphe visuel des transitions (idle → run → jump → attack) | Définir le comportement des entités sans code |
| B3 | **Timeline / Keyframe Editor** — courbes de position, scale, rotation, alpha dans le temps | Cutscenes, events scripts, cinematics |
| B4 | **Onion Skinning** — superposition des frames précédentes/suivantes | Timing d'animation précis |
| B5 | **Event Tracks** — spawn particules, sons, hitbox activation sur une frame donnée | Synchronisation gameplay/animation |

### Phase C — Polich (semaine 3)

| # | Feature | Pourquoi |
|---|---------|----------|
| C1 | **Particle Editor** — émetteurs, gravité, vie, couleur, forme | FX modernes sans sortir de l'éditeur |
| C2 | **Sound Event Mapper** — associer des sons aux animations/events | Audio design intégré |
| C3 | **Export multi-plateforme** — JSON, Tiled, PNG atlas |interopérabilité |
| C4 | **Collaboration** — export/import de chunks de niveau | Travail en équipe |

## 4. Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│                    ORION & SIRIUS STUDIO                     │
├─────────────────────────────────────────────────────────────┤
│  Main Menu  │  Editor  │  Test Center  │  Animation Lab    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ Level   │  │ Canvas  │  │ Playwright│  │ Preview     │  │
│  │ Editor  │  │ Phaser  │  │ Reports   │  │ State Mach. │  │
│  │         │  │ + DOM   │  │ E2E Log   │  │ Timeline    │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Shared: AssetCatalog | UndoManager | SaveManager | Bridge │
└─────────────────────────────────────────────────────────────┘
```

## 5. Pourquoi ces features en 2026

- **Test-first** : Les moteurs modernes (Godot, Unity 6, Unreal) intègrent des suites de tests visibles. Un builder sans test intégré est un prototype.
- **Animation as Data** : Les state machines et timelines ne sont plus du code, ce sont des assets. Cela permet aux game designers de travailler sans toucher au code.
- **Hybride DOM+Canvas** : Le skill phaser-gamedev le confirme — Phaser est un moteur de jeu, pas un framework UI. Les panels complexes (timeline, state machine) sont impossibles à maintenir en pur Phaser.
- **Instant Playtest** : Le cycle "édition → test → édition" doit être < 1 seconde. C'est le standard Godot/Unity.

## 6. Succès = quoi mesurer

- [ ] Un nouveau niveau est créable en < 5 minutes depuis le menu principal
- [ ] Les tests Playwright passent à 100% avant chaque release
- [ ] Une animation state machine est configurable sans écrire de code TypeScript
- [ ] Le build Vite compile en < 2 secondes
