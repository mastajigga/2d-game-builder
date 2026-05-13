# Phase 8 — World Hub (Metroidvania-lite)

> **Durée estimée** : 1–2 jours  
> **Dépendances** : Phase 3–7 (menu, sauvegardes, checkpoints, mini-carte, gameplay complet)  
> **Objectif** : Passer d'un niveau unique à un système de multi-niveaux reliés par un hub.

---

## 8.1 Objectif

- Un écran "World Hub" (carte du monde) accessible depuis le menu principal
- Plusieurs stages (fichiers JSON séparés) représentés comme des nodes
- Les nodes sont reliés par des chemins (line graph)
- Débloquer un niveau → compléter le précédent
- Chaque stage = fichier JSON indépendant, chargeable dynamiquement

---

## 8.2 Fichiers à créer

```
levels/
├─ level-1.json         # Migration de l'actuel localStorage
├─ level-2.json         # Nouveau niveau vide ou template
└─ level-index.json     # Liste des niveaux + métadonnées

src/
├─ editor-ui/
│   └─ WorldHubUI.ts      # Vue carte du monde
└─ level/
    └─ LevelLoader.ts     # Chargement dynamique JSON
```

## 8.3 Fichiers à modifier

```
src/editor-ui/MainMenuUI.ts    # Bouton "Carte du monde"
src/main.ts                    # Router vers WorldHubUI
src/level/LevelData.ts         # Ajouter `levelId`, `nextLevelId`
src/scenes/GymScene.ts         # Charger dynamiquement le niveau
src/scenes/EditorScene.ts      # Charger/sauvegarder un fichier niveau spécifique
```

---

## 8.4 Tâches détaillées

### Tâche 8.1 : Structurer les niveaux en fichiers JSON

- [ ] Créer `levels/level-index.json` :
  ```json
  {
    "levels": [
      { "id": "level-1", "name": "La Forêt des Chênes", "unlockCondition": "start" },
      { "id": "level-2", "name": "Les Ruines Oubliées", "unlockCondition": "complete:level-1" },
      { "id": "level-3", "name": "Le Pont de l'Ombre", "unlockCondition": "complete:level-2" }
    ]
  }
  ```
- [ ] Exporter le niveau actuel de `localStorage` vers `levels/level-1.json`
- [ ] Créer `levels/level-2.json` (niveau vide de démonstration)

### Tâche 8.2 : LevelLoader

- [ ] `LevelLoader.ts` :
  - `loadLevelIndex(): Promise<LevelIndex>` — fetch `levels/level-index.json`
  - `loadLevel(id: string): Promise<LevelData>` — fetch `levels/{id}.json`
  - `saveLevel(id: string, data: LevelData): void` — téléchargement JSON (dans l'éditeur) ou localStorage override

### Tâche 8.3 : WorldHubUI

- [ ] Écran DOM avec fond de carte stylisé (image ou SVG)
- [ ] Nodes positionnés manuellement (ou par grille) :
  - Cercle avec icône du niveau
  - Label avec nom
  - État : verrouillé (🔒), disponible (◯), complété (✓)
- [ ] Lignes SVG entre nodes reliés
- [ ] Clic sur un node disponible → émet `hub-select-level` avec l'ID
- [ ] Double-clic ou bouton "Jouer" → démarre GymScene avec ce niveau

### Tâche 8.4 : Connecter le flux complet

```
Menu principal
    ↓ "Carte du monde"
WorldHubUI
    ↓ Clic sur "La Forêt des Chênes"
GymScene (charge level-1.json)
    ↓ Checkpoint + sauvegarde
    ↓ Victory Zone atteinte
Écran de victoire
    ↓ "Continuer"
WorldHubUI (level-2 débloqué, animé)
    ↓ Clic sur "Les Ruines Oubliées"
GymScene (charge level-2.json)
```

### Tâche 8.5 : Progression persistante

- [ ] `localStorage` stocke :
  ```json
  {
    "completedLevels": ["level-1"],
    "unlockedLevels": ["level-1", "level-2"]
  }
  ```
- [ ] Au démarrage, `WorldHubUI` lit cette progression et affiche les bons états

### Tâche 8.6 : Éditeur multi-niveaux

- [ ] Dans `EditorScene`, ajouter un dropdown "Niveau" dans la toolbar
- [ ] Permet de choisir quel `level-X.json` éditer
- [ ] Sauvegarde → téléchargement du JSON (pas de serveur → download auto)

### Tâche 8.7 : Build et validation

- [ ] `npm run build`
- [ ] Tester : Menu → Carte → Niveau 1 → Victoire → Carte (niveau 2 débloqué)

---

## 8.5 Définition de fini

- [ ] Le World Hub affiche les niveaux comme une carte
- [ ] Les niveaux se débloquent séquentiellement
- [ ] Chaque niveau est un fichier JSON séparé, chargeable dynamiquement
- [ ] L'éditeur permet de sélectionner et éditer différents niveaux
- [ ] Build OK

---

## 8.6 Notes architecturales

- **Pas de serveur** : Les fichiers JSON sont dans `public/levels/` et servis statiquement par Vite.
- **Export depuis l'éditeur** : `LevelLoader.saveLevel()` crée un Blob et déclenche un `a.download` pour que l'utilisateur télécharge le `.json`.
- **Import dans l'éditeur** : Drag & drop d'un fichier `.json` sur le canvas → parsing → chargement.
