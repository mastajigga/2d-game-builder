# Phase 4 — Système de sauvegarde / Reprendre

> **Durée estimée** : 3–4h  
> **Dépendances** : Phase 3 (menu principal avec sous-menu Reprendre)  
> **Objectif** : Implémenter 5 slots de sauvegarde persistés en localStorage.

---

## 4.1 Objectif

- Permettre au joueur de sauvegarder manuellement (depuis pause menu ou auto à un checkpoint)
- Stocker l'état complet du joueur + niveau + ennemis morts
- Afficher jusqu'à 5 sauvegardes avec date/heure dans le menu
- Charger une sauvegarde → restaurer exactement l'état

---

## 4.2 Fichiers à créer

```
src/
└─ save-system/
    ├─ SaveManager.ts       # API CRUD des sauvegardes
    └─ SaveSlot.ts          # Interface + validation
```

## 4.3 Fichiers à modifier

```
src/scenes/GymScene.ts         # Appeler SaveManager au checkpoint + pause
src/editor-ui/MainMenuUI.ts    # Lire les slots pour le sous-menu Reprendre
src/level/LevelData.ts         # Assurer la sérialisation complète
```

---

## 4.4 Tâches détaillées

### Tâche 4.1 : Définir le schéma `SaveSlot`

```typescript
export interface SaveSlot {
  id: string;              // "slot-0" à "slot-4"
  createdAt: number;       // timestamp
  levelKey: string;        // identifiant du niveau (ex: "level-1")
  checkpointId?: string;   // uid du checkpoint atteint
  playerState: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
  };
  worldState: {
    deadEnemies: string[];       // uid des ennemis tués
    collectedItems: string[];    // uid des items ramassés
    triggeredEvents: string[];   // uid des événements déjà déclenchés
  };
  levelSnapshot?: LevelData;     // Copie complète du niveau (si modifiable)
}
```

- [ ] Créer `src/save-system/SaveSlot.ts` avec l'interface
- [ ] Ajouter une fonction `validateSaveSlot(data: unknown): SaveSlot | null`

### Tâche 4.2 : Implémenter `SaveManager.ts`

- [ ] `STORAGE_KEY = 'oakwoods-saves-v1'`
- [ ] Méthodes :
  - `getAllSlots(): SaveSlot[]` — lit localStorage, parse, valide, retourne trié par date décroissante
  - `getSlot(id: string): SaveSlot | null`
  - `saveSlot(slot: SaveSlot): void` — sauvegarde, limite à 5 slots (supprime le plus ancien si dépassement)
  - `deleteSlot(id: string): void`
  - `hasSaves(): boolean`
  - `createAutoSlot(levelKey, playerState, worldState): SaveSlot` — génère un nouvel ID

**Critère d'acceptation** : Sauvegarder, recharger la page, lire → les données sont là.

### Tâche 4.3 : Connecter au GymScene

- [ ] Dans `GymScene`, écouter l'événement `pause-game` (touche Escape ou bouton pause)
- [ ] Ouvrir un menu pause DOM (ou overlay) avec options :
  - Continuer
  - Sauvegarder
  - Retour au menu
- [ ] "Sauvegarder" crée un slot via `SaveManager.createAutoSlot(...)`
- [ ] Afficher un toast : "Partie sauvegardée"

**Critère d'acceptation** : Le joueur peut sauvegarder à tout moment depuis la pause.

### Tâche 4.4 : Connecter au MainMenu

- [ ] Dans `MainMenuUI`, au moment de `show()` :
  - Appeler `SaveManager.getAllSlots()`
  - Peupler le sous-menu Reprendre
  - Si 0 slots → bouton disabled
- [ ] Au clic sur un slot → émettre `menu-resume` avec le slotId
- [ ] `main.ts` écoute `menu-resume`, crée le jeu, et passe le slotId à `GymScene` via `scene.start('GymScene', { saveSlot })`

### Tâche 4.5 : Restauration d'état dans GymScene

- [ ] `GymScene` accepte `data?: { saveSlot: SaveSlot }` dans `init()`
- [ ] Si `saveSlot` est fourni :
  - Positionner le joueur aux coordonnées sauvegardées
  - Restaurer HP/MaxHP
  - Supprimer les ennemis dont l'uid est dans `deadEnemies`
  - Supprimer les items collectés
  - Téléporter la caméra au checkpoint
- [ ] Sinon : comportement par défaut (début du niveau)

**Critère d'acceptation** : Reprendre une sauvegarde place exactement le joueur où il était, avec ses HP, sans les ennemis déjà tués.

### Tâche 4.6 : Build et validation

- [ ] `npm run build`
- [ ] Tester : Jouer → tuer un ennemi → sauvegarder → retour menu → reprendre → l'ennemi est mort et le joueur est au bon endroit

---

## 4.5 Définition de fini

- [ ] `SaveManager` persiste 5 slots maximum dans localStorage
- [ ] Chaque slot contient date/heure, position, HP, ennemis morts
- [ ] Le menu "Reprendre" affiche les slots existants
- [ ] Charger un slot restaure exactement l'état du jeu
- [ ] Build OK
