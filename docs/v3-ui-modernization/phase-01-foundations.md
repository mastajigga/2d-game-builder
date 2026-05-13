# Phase 1 — Fondations UI DOM + Bridge

> **Durée estimée** : 3–4h  
> **Dépendances** : Aucune (s'appuie sur le builder V2 existant)  
> **Objectif** : Prouver que l'architecture hybride fonctionne en migrant un seul panneau critique.

---

## 1.1 Objectif

Migrer le **PropertiesPanel** de Phaser vers un panneau DOM natif. Tout le reste du builder reste inchangé. Cette phase valide :
- Le pont `EditorBridge` (EventTarget)
- La communication bidirectionnelle Canvas ↔ DOM
- Le CSS dark-theme
- La non-régression du build

---

## 1.2 Fichiers à créer

```
src/editor-ui/
├── EditorBridge.ts          # Bus d'événements global
├── PropertiesPanelUI.ts     # Panneau DOM natif
└── styles/
    └── editor-ui.css        # Styles dark-theme
```

## 1.3 Fichiers à modifier

```
index.html                     # Ajouter les containers DOM
src/scenes/EditorScene.ts      # Émettre événements bridge au lieu de reconstruire Phaser UI
src/main.ts                    # Importer la CSS, instancier PropertiesPanelUI
```

---

## 1.4 Tâches détaillées

### Tâche 1.1 : Créer le bridge `EditorBridge.ts`

- [ ] Créer `src/editor-ui/EditorBridge.ts`
- [ ] Exporter une instance singleton `EventTarget`
- [ ] Définir les interfaces TypeScript pour tous les événements :
  - `EntitySelectedEventDetail`
  - `UpdateEntityEventDetail`
  - `DeleteEntityEventDetail`
  - `SetModeEventDetail`
- [ ] Ajouter un helper typé `emit(eventName, detail)` et `on(eventName, handler)`

**Critère d'acceptation** : On peut importer `editorBus` depuis n'importe quel module et émettre/écouter sans erreur TS.

### Tâche 1.2 : Préparer le HTML

- [ ] Modifier `index.html`
- [ ] Ajouter `<div id="editor-overlay" class="editor-overlay">` comme frère de `<div id="game-container">`
- [ ] À l'intérieur, ajouter :
  - `<div id="properties-panel"></div>` (position absolute, right: 10px, top: 60px, width: 260px)
- [ ] S'assurer que le canvas Phaser occupe 100vw/100vh
- [ ] Appliquer `pointer-events: none` sur `#editor-overlay` et `pointer-events: auto` sur `#properties-panel`

**Critère d'acceptation** : Le panneau apparaît au-dessus du canvas sans bloquer les clics sur le jeu.

### Tâche 1.3 : Créer la feuille de style `editor-ui.css`

- [ ] Créer `src/editor-ui/styles/editor-ui.css`
- [ ] Définir les variables CSS (dark theme)
- [ ] Styliser `#properties-panel` :
  - background: `var(--bg-secondary)`
  - border: 1px solid `var(--border)`
  - border-radius: `var(--radius)`
  - padding: 12px
  - font-family: `var(--font)`
  - color: `var(--text-primary)`
- [ ] Styliser les inputs :
  - texte : fond sombre, bordure, padding 6px
  - nombre : même chose + width 60px
  - color : utiliser `<input type="color">` avec un wrapper
  - range : slider customisé
- [ ] Styliser les boutons +/- : carrés 28px, hover accent
- [ ] Styliser les groupes de champs : margin-bottom 12px, label en `var(--text-secondary)`

**Critère d'acceptation** : Le panel a l'apparence d'un outil moderne (style Figma/VS Code dark).

### Tâche 1.4 : Implémenter `PropertiesPanelUI.ts`

- [ ] Créer la classe `PropertiesPanelUI`
- [ ] Constructeur : récupère `document.getElementById('properties-panel')`
- [ ] Méthode `show(entity: PlacedEntity)` :
  - Vider le contenu (ou mieux : réutiliser les éléments existants pour éviter les recréations)
  - Générer le DOM pour :
    - Nom : `<input type="text">` avec événement `input`
    - HP / Max HP : ligne avec label, `<input type="number">`, boutons [+] [-]
    - Dégâts : même pattern
    - Taille (échelle) : `<input type="range">` ou [+] [-]
    - Teinte : `<input type="color">`
    - Rotation : [+] [-] par pas de 90°
    - Collision : toggle `<input type="checkbox">` + champs X/Y/W/H
    - Boutons "OK" et "Supprimer"
  - Chaque champ émet `update-entity` via le bridge quand sa valeur change
- [ ] Méthode `hide()` : masquer le panel (`display: none`)
- [ ] Méthode `updateField(fieldName, value)` : mise à jour ciblée sans reconstruction

**Pattern critique** : Ne JAMAIS reconstruire tout le panel pour une mise à jour. Conserver des refs vers les inputs et les mettre à jour directement.

**Critère d'acceptation** : Modifier les HP d'un ennemi met à jour uniquement le champ HP en < 16ms. Le panel ne clignote pas.

### Tâche 1.5 : Connecter `EditorScene.ts` au bridge

- [ ] Dans `EditorScene.ts`, importer `editorBus`
- [ ] Quand une entité est sélectionnée : émettre `entity-selected` avec le `PlacedEntity`
- [ ] Quand la sélection est vidée : émettre `entity-deselected`
- [ ] Supprimer (ou commenter) l'appel à l'ancien `this.propertiesPanel.show()`
- [ ] Écouter `update-entity` depuis le bridge :
  - Appliquer les changements à l'entité en mémoire
  - Mettre à jour le sprite (angle, tint, scale, etc.)
  - Pousser une action dans l'historique undo/redo
- [ ] Écouter `delete-entity` depuis le bridge

**Critère d'acceptation** : Cliquer sur un ennemi dans le canvas affiche le panel DOM. Modifier un champ dans le panel met à jour l'ennemi en temps réel.

### Tâche 1.6 : Gestion du focus clavier

- [ ] Dans `EditorScene.ts`, désactiver temporairement les raccourcis clavier quand un input DOM est focus
- [ ] Pattern :
  ```ts
  const inputFocused = document.querySelector('input:focus, textarea:focus');
  if (inputFocused) return; // Ne pas traiter les touches
  ```

**Critère d'acceptation** : Quand on tape "R" dans le champ nom, ça écrit "R". Quand aucun input n'est focus, "R" tourne l'entité.

### Tâche 1.7 : Build et validation

- [ ] Lancer `npm run build`
- [ ] Corriger toutes les erreurs TypeScript
- [ ] Vérifier que le CSS est bien importé dans le bundle Vite
- [ ] Tester le cycle : sélectionner → modifier HP → désélectionner → resélectionner → vérifier persistence

**Critère d'acceptation** : Build OK. Le PropertiesPanel DOM fonctionne aussi bien (ou mieux) que l'ancien PropertiesPanel Phaser.

---

## 1.5 Points d'attention

- **Pas de régression** : L'ancien `PropertiesPanel.ts` (Phaser) doit rester dans le codebase pendant cette phase. On le supprime uniquement après validation complète.
- **Performance DOM** : Utiliser `document.createElement` et `appendChild` est plus rapide que `innerHTML` pour des mises à jour fréquentes. Cependant, pour la construction initiale du panel, `innerHTML` avec un template string est acceptable.
- **TypeScript strict** : Tous les événements CustomEvent doivent être typés via des interfaces pour éviter `any`.

---

## 1.6 Définition de fini

- [ ] Le PropertiesPanel est rendu en DOM natif
- [ ] Les inputs fonctionnent (texte, nombre, couleur, checkbox)
- [ ] Le panel ne se reconstruit pas entièrement quand on modifie une valeur
- [ ] Le bridge communique correctement dans les deux sens
- [ ] Le build passe sans erreur
- [ ] Aucune régression visuelle sur le canvas Phaser
- [ ] L'ancien PropertiesPanel Phaser est encore présent (commenté ou non utilisé)
