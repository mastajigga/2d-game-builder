# Post-Mortem : Freeze de l'application (Mai 2026)

> Bug : l'application Phaser se figeait aléatoirement, la page devenait bloquée.  
> Impact : toutes les navigations après le Stage Builder.  
> Sévérité : critique (perte de travail).

---

## 1. Cause racine

### Symptôme
Après avoir utilisé le **Stage Builder** (nouvelle fonctionnalité, page full-screen avec canvas Phaser embarqué), toute navigation ultérieure provoquait des freezes de 5 à 30 secondes, voire un blocage complet de l'onglet.

### Cause
**Deux instances de `Phaser.Game` s'exécutaient simultanément.**

Le Stage Builder crée une instance `Phaser.Game` dans `StageBuilderCanvas.init()`. Cette instance est détruite dans `StageBuilderCanvas.destroy()`, qui est appelé par `StageBuilderUI.hide()`.

Le problème : **`hide()` n'était pas appelée systématiquement lors des changements de page.** La fonction `hideStageBuilderPage()` existait bien, mais elle n'était appelée que dans `onMenuAnimation()` — aucun des 6 autres handlers de navigation ne l'appelait.

### Chaîne exacte du bug

1. Utilisateur ouvre le Stage Builder → `Phaser.Game` #1 créé (canvas 3D, WebGL context)
2. Utilisateur clique "Jouer" → `onMenuPlay()` :
   - ❌ `hideStageBuilderPage()` **non appelée** → Game #1 toujours actif
   - ✅ `startGame("GymScene")` → `Phaser.Game` #2 créé
3. Deux instances Phaser actives simultanément :
   - Chacune a son propre WebGL context (~50-100 MB GPU)
   - Chacune a sa propre game loop (requestAnimationFrame)
   - Conflit de contexte WebGL : le navigateur switch entre les deux
4. Freeze : le navigateur ne peut pas gérer 2 contextes WebGL + 2 boucles RAF en même temps

### Pourquoi ce bug a pu arriver

**Erreur de conception n°1** : la méthode `hideStageBuilderPage()` a été ajoutée après-coup, sans l'intégrer dans le pattern existant des autres `hide*Page()`.

**Erreur de conception n°2** : chaque handler de navigation duplique la liste des `hide*Page()` au lieu d'avoir une fonction unique `hideAllPages()` — rendant l'oubli quasi-inévitable.

**Manque de garde-fou** : la fonction `startGame()` ne vérifiait pas qu'aucune autre instance Phaser n'existe déjà. Elle créait aveuglément une nouvelle instance.

---

## 2. Solutions appliquées

### Fix 1 : `hideStageBuilderPage()` partout

Ajout de `hideStageBuilderPage()` dans les 6 handlers qui l'omettaient :

| Handler | Avant | Après |
|---|---|---|
| `onMenuPlay()` | `hideTest, hideAnimation` | + `hideStageBuilder` |
| `onMenuDevelop()` | `hideTest, hideAnimation` | + `hideStageBuilder` |
| `onMenuTest()` | `hideAnimation` | + `hideStageBuilder` |
| `onMenuResume()` | `hideTest, hideAnimation` | + `hideStageBuilder` |
| `onMenuQuit()` | `hideTest, hideAnimation` | + `hideStageBuilder` |
| `showMainMenu()` | `hideTest, hideAnimation` | + `hideStageBuilder` |

### Fix 2 : Garde-fou dans `startGame()`

```typescript
function startGame(firstScene: string): Phaser.Game {
  // Destroy existing instance BEFORE creating a new one
  if (game) { game.destroy(true); game = null; }
  // ...
}
```

Si jamais un `hide*Page()` est oublié à l'avenir, cette ligne de défense empêche l'empilement.

### Fix 3 : Garde-fou dans `ParticlePreview._startGame()`

Même pattern : `if (this.game) { this.game.destroy(true); this.game = null; }` avant de créer une nouvelle instance.

`AnimationLivePreview` avait déjà ce garde-fou — pas de modification nécessaire.

---

## 3. Comment ne jamais reproduire ce bug

### Règle 1 : Une seule fonction `hideAllPages()`

Ne jamais dupliquer les appels `hideXxxPage()` dans chaque handler. Avoir **une seule fonction** :

```typescript
function hideAllPages(): void {
  hideTestPage();
  hideAnimationPage();
  hideStageBuilderPage();
  hideGame();
}
```

Chaque handler appelle `hideAllPages()` puis affiche UNIQUEMENT ce dont il a besoin. Si une nouvelle page est ajoutée, on modifie UNE fonction, pas 7 handlers.

### Règle 2 : Toute création de `new Phaser.Game` doit être précédée d'un `destroy()`

Pattern obligatoire :

```typescript
if (this.game) { this.game.destroy(true); this.game = null; }
this.game = new Phaser.Game({...});
```

Ce pattern est déjà présent dans :
- ✅ `StageBuilderCanvas.init()`
- ✅ `AnimationLivePreview` (méthode show)
- ✅ `ParticlePreview._startGame()` (corrigé)
- ✅ `main.ts startGame()` (corrigé)

### Règle 3 : Test de navigation

Après avoir ajouté une nouvelle page full-screen avec Phaser embarqué, tester TOUS les chemins de navigation :
1. Menu → Nouvelle Page → Menu → Ancienne Page
2. Menu → Ancienne Page → Nouvelle Page
3. Nouvelle Page → Jouer → Menu → Nouvelle Page
4. Vérifier qu'un seul canvas `<canvas>` est actif dans le DOM à tout moment

### Règle 4 : Vérification runtime

Ajouter un check en console :
```javascript
document.querySelectorAll("canvas").length
```
Ne doit jamais dépasser 1 pendant le jeu, ou 2 si une page full-screen est ouverte (1 canvas principal + 1 canvas page).
