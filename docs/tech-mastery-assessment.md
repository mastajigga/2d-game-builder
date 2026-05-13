# Oakwoods Project — Évaluation du Niveau de Maîtrise Technique

Analyse comparative du projet vs l'état de l'art 2026 en développement 2D Phaser/TypeScript.

---

## Échelle de notation

| Niveau | Label | Description |
|---|---|---|
| ★★★★★ | Expert | Pattern de référence, production-ready |
| ★★★★☆ | Avancé | Bien implémenté, quelques améliorations possibles |
| ★★★☆☆ | Intermédiaire | Fonctionnel mais lacunes visibles |
| ★★☆☆☆ | Débutant | Fonctionne mais à refactorer |
| ★☆☆☆☆ | Élémentaire | Proof of concept uniquement |

---

## 1. Architecture & Structure de projet

**Note : ★★★★☆ (Avancé)**

✅ Forces :
- Séparation Editor / Gym / LevelData / AssetCatalog — clean
- Scene lifecycle via registry (registry.set/get)
- AssetCatalog avec helpers type-safe (plant(), platformVariant())
- Données niveau versionnées (v2)

❌ Améliorations :
- `main.ts` importe 4 scènes mais n'en utilise que 2 (code mort)
- Constantes de résolution dupliquées (1600, 900 en dur dans chaque scène)
- Pas de `constants.ts` / `GameConfig.ts`
- `CLAUDE.md` obsolète (décrit l'ancienne version 320×180)
- Pas de séparation entities/systems/ui

---

## 2. Phaser API Mastery

**Note : ★★★★☆ (Avancé)**

✅ Forces :
- Arcade physics avec staticGroup + colliders
- TileSprite pour les plateformes (via `def.category === "platform"`)
- Camera follow avec deadzone + lerp (0.12)
- Animations avec `animationcomplete` events + state machine
- Registry cross-scene data
- `input.keyboard.addCapture("TAB")` (détail pro)
- `disableContextMenu()` pour l'éditeur (UX thoughtful)

❌ Améliorations :
- Pas d'object pooling (ennemis recréés à chaque respawn)
- `this.physics.add.sprite` puis cast `as Phaser.Physics.Arcade.Factory` — un peu hacky
- Pas de `Phaser.AUTO` (forcer WebGL ?)
- `Phaser.Geom.Rectangle.Overlaps` pour l'attaque : OK mais pourrait utiliser `physics.add.overlap` avec une zone dédiée

---

## 3. Système de Combat

**Note : ★★★★☆ (Avancé)**

✅ Forces :
- Zone d'attaque positionnée selon la direction du joueur
- Hit une fois par swing (Set<Enemy> pour éviter multi-hit)
- Dégâts par frame d'animation (ENEMY_HIT_FRAME_START/END)
- Invincibilité temporaire après hit (700ms + clignotement alpha)
- Barre de vie ennemis (Graphics) colorée selon %
- Mort avec animation complète puis destroy

❌ Améliorations :
- Les dégâts sont codés en dur (1 HP)
- Pas de knockback sur l'ennemi touché
- Pas de feedback visuel d'attaque ratée
- Le joueur ne peut pas être touché par plusieurs ennemis simultanément (hurt cooldown bloque tout)

---

## 4. Level Editor

**Note : ★★★★☆ (Avancé)**

✅ Forces :
- Palette par catégories (Plateformes, Décor, Ennemis, Spawn)
- Snap-to-grid (16px) propre
- Preview fantôme au curseur (alpha 0.6)
- Outlines colorés par catégorie (vert = sélectionné, bleu = plateforme, rouge = ennemi, jaune = spawn)
- Zone de patrouille visible pour ennemis
- Raccourcis complets (TAB test, S save, R reset, G grille, F flip, [ ] scale, DEL)
- Sauvegarde localStorage avec versioning
- Caméra scrollable aux flèches

❌ Améliorations (pour niveau pro) :
- Pas d'Undo/Redo
- Pas de multi-sélection
- Pas de copier/coller
- `confirm()` natif du navigateur pour reset — pas in-game
- Pas d'export/import fichier

---

## 5. Gestion des Assets

**Note : ★★★☆☆ (Intermédiaire)**

✅ Forces :
- AssetCatalog centralisé avec typage fort
- Helpers de création (platformVariant, plant)
- Preload dans les scènes (EditorScene.preload, GymScene.preload)

❌ Améliorations :
- Pas de BootScene unifiée pour les nouveaux assets (EditorScene et GymScene font leur propre preload)
- Pas de loading bar / progress indicator
- Assets volumineux : Mossy TileSet 3584×3584px, pas de lazy-load
- Fichiers de plantes : 13 types × ~60 PNG chacun = ~780 fichiers ! Utiliser des spritesheets
- Pas de vérification que les assets existent avant utilisation
- `assets/oakwoods/assets.json` encore présent mais inutilisé

---

## 6. Typescript & Typage

**Note : ★★★★☆ (Avancé)**

✅ Forces :
- Interfaces typées (LevelData, PlacedEntity, AssetDef, PlacedView)
- Union types (AssetCategory, EnemyState, PlayerState)
- `Record<string, AssetDef>` pour CATALOG_BY_ID
- `strict: true` dans tsconfig
- Pas de `any` abusif
- Optional chaining (`?.`) et nullish coalescing (`??`)

❌ Améliorations :
- Quelques cast (`as unknown as`, `as Phaser.Physics.Arcade.Factory`) qui devraient être évités
- `void ass;` à la fin de GymScene — hack pour éviter unused import warning

---

## 7. UI/UX

**Note : ★★★☆☆ (Intermédiaire)**

✅ Forces :
- Game Over avec choix "Recommencer ? Oui/Non" (joli détail)
- Flèches pour naviguer le choix game over
- Transition alpha progressive (tweens) pour le game over
- HUD clair (HP, état, nombre d'ennemis, position)
- Aide en bas d'écran avec tous les contrôles

❌ Améliorations :
- `confirm()` navigateur pour le reset (pas in-game)
- Pas de menu principal
- Pas d'écran de victoire (tuer tous les ennemis = rien)
- Pas de feedback sonore
- Texte d'aide en bas qui déborde sur petits écrans

---

## 8. Performance

**Note : ★★★☆☆ (Intermédiaire)**

✅ Forces :
- staticGroup pour les plateformes
- TileSprite pour les fonds
- Spritesheets plutôt que PNG individuels (pour le joueur/ennemis)

❌ Améliorations :
- Pas d'object pooling (ennemis recréés au lieu de recyclés)
- Pas de culling (entités hors écran toujours actives)
- `Graphics.clear()` + `fillStyle` à chaque frame pour les barres de vie
- ~780 fichiers PNG de plantes chargés individuellement
- `Text` objects recréés à chaque changement d'état (HUD refresh)

---

## 9. Tests

**Note : ★☆☆☆☆ (Élémentaire)**

❌ Inexistant :
- Aucun test unitaire
- Aucun test E2E
- Pas de CI/CD
- Pas de lint config (ESLint/Prettier)
- Vérification manuelle uniquement

---

## 10. Documentation

**Note : ★★☆☆☆ (Débutant)**

✅ Forces :
- README clair avec instructions d'installation
- `CLAUDE.md` présent (bien que obsolète)
- `prompts/` contient l'historique des prompts qui ont généré le projet

❌ Améliorations :
- CLAUDE.md ne reflète PAS l'état actuel du code
- Pas de JSDoc sur les classes principales
- Pas de diagramme d'architecture
- Pas de commentaires sur les choix de design

---

## Synthèse

| Domaine | Note | Priorité d'amélioration |
|---|---|---|
| Architecture | ★★★★☆ | Moyenne |
| Phaser API | ★★★★☆ | Basse |
| Système de combat | ★★★★☆ | Basse |
| Level Editor | ★★★★☆ | Moyenne |
| Gestion assets | ★★★☆☆ | Haute |
| TypeScript/Typage | ★★★★☆ | Basse |
| UI/UX | ★★★☆☆ | Moyenne |
| Performance | ★★★☆☆ | Haute |
| Tests | ★☆☆☆☆ | Critique |
| Documentation | ★★☆☆☆ | Haute |

### Note globale : ★★★☆☆ (Intermédiaire+) → potentiel ★★★★☆

Le projet est un **excellent squelette** avec des patterns avancés mais manque de finition :
- Tests (le plus gros manque)
- Object pooling + culling
- Menu principal + flow de jeu complet
- Mise à jour de la documentation
- Uniformisation des assets (spritesheets pour les plantes)

**Verdict** : Projet au niveau d'un prototype avancé / vertical slice. Les fondations sont solides,
le code est propre. Pour atteindre un niveau production, il faut investir sur les tests,
la performance, et le polish UI.

---

*Document généré le 2026-05-09.*
