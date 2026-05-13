# Étapes d'implémentation détaillées — Orion & Sirius Builder

## Étape 1 : Rebranding & Menu Principal

### 1.1 Modifier `src/editor-ui/MainMenuUI.ts`
- Ligne 40 : changer `title.textContent = "OAKWOODS"` en `"ORION & SIRIUS"`
- Ligne 45 : changer le subtitle en `"Studio Builder • 2026"`
- Ajouter deux boutons après "Carte du monde" :
  - `"🧪 Test Center"` → `emitEditorEvent("menu-test", {})`
  - "🎨 Animation Lab" → `emitEditorEvent("menu-animation", {})`

### 1.2 Modifier `src/editor-ui/EditorBridge.ts`
- Ajouter dans `EditorEventMap` :
  - `"menu-test": CustomEvent<MenuTestDetail>`
  - `"menu-animation": CustomEvent<MenuAnimationDetail>`
- Ajouter les interfaces `MenuTestDetail` et `MenuAnimationDetail` (vides)

### 1.3 Modifier `src/main.ts`
- Ajouter les listeners :
  ```ts
  onEditorEvent("menu-test", onMenuTest);
  onEditorEvent("menu-animation", onMenuAnimation);
  ```
- Implémenter `onMenuTest()` et `onMenuAnimation()` :
  - Cacher le menu principal (`hideMainMenu()`)
  - Afficher le conteneur de page correspondant (`showTestPage()`, `showAnimationPage()`)
  - Masquer le canvas Phaser (`gameContainer.style.display = "none"`)

## Étape 2 : Test Center — Intégration Playwright

### 2.1 Créer `src/editor-ui/TestPageUI.ts`
Responsabilité : Afficher une page DOM native avec :
- En-tête "🧪 Test Center"
- Section "Tests E2E Playwright" :
  - Liste des fichiers `.spec.ts` découverts dynamiquement (via `fetch` sur un endpoint local si disponible, ou liste statique)
  - Bouton "Run All" qui exécute `npx playwright test` via une API Node (non possible depuis le browser) → **Solution** : utiliser un `WebSocket` ou un simple `fetch` vers un petit serveur Node local, OU afficher les résultats du dernier run stocké dans `playwright-report/`.
- Section "Tests Internes" :
  - Réutiliser la logique de `TestRunnerUI.ts` mais dans une page plein écran
  - Afficher les 5 scénarios avec statut pass/fail/pending
- Section "Couverture" :
  - Compteur de tests passés / total
  - Historique (stocké dans `localStorage`)

### 2.2 Architecture de la page Test
```
├── test-page-container (position:fixed, inset:0, z-index:50)
│   ├── Header : titre + bouton fermer
│   ├── Colonne gauche (30%) : liste des suites de tests
│   │   ├── Playwright E2E
│   │   ├── Tests internes (TestRunner)
│   │   └── Régression visuelle
│   └── Colonne droite (70%) : détail du test sélectionné
│       ├── Logs / console output
│       └── Screenshot de référence
```

### 2.3 Lire les résultats Playwright
- Le dossier `playwright-report/` contient un `index.html` statique après un run.
- `TestPageUI` peut lire `test-results/` (JSON) si on expose un endpoint, ou simplement afficher un iframe vers `playwright-report/index.html`.
- **Approche pragmatique** : bouton "Ouvrir le rapport Playwright" qui ouvre `playwright-report/index.html` dans un nouvel onglet + section "Dernier résultat" lue depuis `test-results/` via un `fetch` local si le serveur Vite sert le dossier.

### 2.4 Modifier `index.html`
- Ajouter `<div id="test-page"></div>` après `world-hub`

### 2.5 Ajouter le CSS
- Dans `editor-ui.css` ou une nouvelle feuille `test-page.css` :
  - Grid layout 2 colonnes
  - Dark theme cohérent avec le reste de l'UI

## Étape 3 : Animation Lab

### 3.1 Créer `src/editor-ui/AnimationPageUI.ts`
Responsabilité : Studio d'animation 2D intégré.

### 3.2 Layout de l'Animation Lab
```
├── animation-page-container
│   ├── Header : titre + asset sélectionné + bouton fermer
│   ├── Zone centrale : canvas Phaser dédié (320x180 preview)
│   │   └── Preview du personnage / sprite sélectionné
│   ├── Timeline (bandeau bas, hauteur 200px)
│   │   ├── Piste "Animation" : frames du spritesheet
│   │   ├── Piste "Events" : marqueurs (spawn, sound, hit)
│   │   └── Playhead (curseur de lecture)
│   └── Sidebar droite
│       ├── State Machine (mini graphe textuel)
│       ├── Propriétés de la frame (duration, easing)
│       └── Onion skin toggle
```

### 3.3 Features implémentées dans la v1 de l'Animation Lab
1. **Asset Selector** : dropdown des spritesheets du catalogue (`AssetCatalog.ts`)
2. **Frame Preview** : affiche les frames du spritesheet sélectionné en grille
3. **Playback Controls** : play / pause / stop / next / prev / loop / vitesse (0.25x — 2x)
4. **Onion Skin** : superpose la frame précédente à 30% d'opacité
5. **State Machine (textuel)** : liste des états (idle, run, jump, attack) et transitions déclenchées par des conditions (onGround, keyPressed, etc.)
6. **Export JSON** : exporte la configuration animation + state machine pour être consommée par `GymScene`

### 3.4 Modifier `index.html`
- Ajouter `<div id="animation-page"></div>`

### 3.5 Modifier `EditorBridge.ts`
- Ajouter `"animation-preview-play"`, `"animation-preview-pause"`, `"animation-export"`, etc. si nécessaire (optionnel pour la v1)

## Étape 4 : Navigation & CSS

### 4.1 Modifier `index.html`
- Mettre à jour le `<title>` en `"Orion & Sirius Studio"`

### 4.2 Modifier `src/editor-ui/styles/editor-ui.css`
- Ajouter les styles pour `.test-page-container` et `.animation-page-container`
- Z-index : 100 (au-dessus de tout)
- `pointer-events: auto` sur les conteneurs

### 4.3 Synchronisation du bouton Retour
- Quand on est sur Test ou Animation, le bouton "Retour au menu" (`#return-to-menu`) doit fonctionner.
- Dans `onReturnToMenu()` de `main.ts`, masquer `TestPageUI` et `AnimationPageUI` s'ils sont visibles.

## Étape 5 : Build & Vérification

1. `npm run build` — doit compiler sans erreur TypeScript
2. `npx tsc --noEmit` — vérification stricte ( tolérer les TS1259/TS2802 connus de Vite)
3. `npm run dev` — démarrer, vérifier que :
   - Le menu affiche "ORION & SIRIUS"
   - Les boutons Test et Animation sont cliquables
   - Test Center s'ouvre et affiche les sections
   - Animation Lab s'ouvre avec un sélecteur d'asset
   - Retour au menu fonctionne depuis chaque page
4. `npx playwright test` — les tests E2E existants doivent toujours passer

## Dépendances supplémentaires (optionnelles)

- Aucune dépendance npm supplémentaire requise pour la v1.
- L'Animation Lab utilise Phaser en mode épuré (pas de nouvelle scène, juste un canvas DOM + `Phaser.Game` isolé si besoin).
- Pour la timeline avancée (v2), envisager une lib légère comme `waveform-data` ou implémenter custom en Canvas 2D.
