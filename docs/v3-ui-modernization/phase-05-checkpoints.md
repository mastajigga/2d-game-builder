# Phase 5 — Checkpoints + Victory Zones

> **Durée estimée** : 2–3h  
> **Dépendances** : Phase 4 (sauvegarde fonctionnelle)  
> **Objectif** : Ajouter les assets `checkpoint` et `victory` dans le builder et leur logique runtime.

---

## 5.1 Objectif

- **Checkpoint** : Zone dans le niveau. Quand le joueur la touche → sauvegarde auto + feedback visuel.
- **Victory Zone** : Zone de fin de niveau. Quand le joueur l'atteint → victoire, retour au menu ou niveau suivant.

---

## 5.2 Fichiers à créer

Aucun nouveau dossier. Extensions dans les fichiers existants.

## 5.3 Fichiers à modifier

```
src/level/AssetCatalog.ts      # Ajouter catégories checkpoint + victory
src/scenes/EditorScene.ts      # Rendu visuel des zones (glow, label)
src/scenes/GymScene.ts         # Détection collision + logique
src/editor-ui/PropertiesPanelUI.ts  # Propriétés spécifiques (optionnel)
```

---

## 5.4 Tâches détaillées

### Tâche 5.1 : Ajouter au catalogue

- [ ] Dans `AssetCatalog.ts`, ajouter :
  - `checkpoint` : catégorie `system`, image optionnelle (feu de camp, drapeau, pierre runique)
  - `victory` : catégorie `system`, image optionnelle (portail, trône, drapeau géant)
- [ ] S'assurer que le builder les affiche dans la palette (tab "Système")
- [ ] Définir une taille par défaut (ex: 32x32 pour checkpoint, 64x64 pour victory)

### Tâche 5.2 : Rendu dans EditorScene

- [ ] Quand un `checkpoint` est sélectionné ou visible :
  - Dessiner un cercle/zone pulsante autour (animation CSS impossible sur canvas → utiliser `tween` Phaser ou `update()` avec `sin(time)`)
  - Label "Checkpoint" au-dessus
- [ ] Quand un `victory` est visible :
  - Rectangle vert semi-transparent
  - Label "Victory" au-dessus

### Tâche 5.3 : Détection dans GymScene

- [ ] Dans `_buildLevelEntities()` de `GymScene` :
  - Identifier les assets de type `checkpoint` et `victory`
  - Créer des zones de détection (`Phaser.GameObjects.Zone` ou body statique)
  - `this.physics.add.overlap(player, checkpointZones, this._onCheckpoint, undefined, this)`
  - `this.physics.add.overlap(player, victoryZones, this._onVictory, undefined, this)`

- [ ] `_onCheckpoint(player, zone)` :
  - Si c'est un checkpoint déjà activé → ignorer
  - Sinon : activer visuellement (changer la couleur/animation)
  - Appeler `SaveManager.createAutoSlot(...)` avec les données actuelles
  - Afficher un toast DOM : "Checkpoint atteint — Partie sauvegardée"

- [ ] `_onVictory(player, zone)` :
  - Mettre le jeu en pause
  - Afficher un écran de victoire DOM overlay :
    - "NIVEAU TERMINÉ"
    - Stats : temps, ennemis tués, dégâts subis
    - Boutons : "Niveau suivant" (si applicable), "Retour au menu"
  - Marquer le niveau comme complété dans `localStorage`

### Tâche 5.4 : Propriétés optionnelles

- [ ] Dans `PropertiesPanelUI`, si l'entité est un checkpoint :
  - Option "One-shot" (checkbox) : si décochée, le checkpoint sauvegarde à chaque passage
  - Par défaut : true (sauvegarde une seule fois)

### Tâche 5.5 : Build et validation

- [ ] `npm run build`
- [ ] Tester : placer un checkpoint dans l'éditeur → playtest → marcher dessus → sauvegarde auto
- [ ] Tester : placer une victory zone → marcher dessus → écran de victoire

---

## 5.5 Définition de fini

- [ ] Les assets `checkpoint` et `victory` sont placables dans le builder
- [ ] Le checkpoint sauvegarde automatiquement au toucher
- [ ] La victory zone affiche l'écran de fin
- [ ] Build OK
