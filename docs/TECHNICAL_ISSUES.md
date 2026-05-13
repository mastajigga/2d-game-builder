# Documentation Technique — Problèmes rencontrés (Oakwoods Editor)

## 1. WSL + Chemins Unicode

**Symptôme** : `cd /mnt/c/Users/Fortuné/Projects/...` échoue avec `No such file or directory`.
**Cause** : L'encodage UTF-8 du caractère `é` dans le nom d'utilisateur n'est pas interprété correctement par certains outils shell.
**Solution** : Créer un symlink ASCII vers le répertoire du projet :
```bash
ln -sf /mnt/c/Users/Fortuné/Projects/mon-jeux-2D/vibejam-starter-pack/projects/oakwoods /tmp/oakwoods
cd /tmp/oakwoods && npm run dev -- --port 5173
```

## 2. Playwright MCP + Chrome manquant

**Symptôme** : `browser_navigate` échoue avec `libnspr4.so: cannot open shared object file`.
**Cause** : Chromium n'est pas installé et les dépendances système sont absentes.
**Solution** :
```bash
# Installer les libs système
sudo apt-get install -y libnspr4 libnss3 libatk-bridge2.0-0 libxss1 libgtk-3-0 libgbm1 libasound2t64

# Installer Chromium via Playwright
npm install -D @playwright/test
npx playwright install chromium
```
**Vérification** :
```bash
~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome --version
```

## 3. Palette affichant le même tileset entier

**Symptôme** : Toutes les plateformes affichent le même `Mossy - TileSet.png` complet.
**Cause** : `_buildThumb` ne gérait pas les assets avec `tileOffsetX/Y` — seuls `sourceFrame` étaient croppés.
**Solution** : Détecter `tileOffsetX !== undefined || tileOffsetY !== undefined` et appeler `_buildCroppedThumb` avec un crop de 128×128.

## 4. Toolbar modes non fonctionnels

**Symptôme** : Cliquer sur "Delete" dans le toolbar ne change pas le mode.
**Cause** : `ToolbarUI` émettait `set-mode`, mais `EditorScene` n'écoutait pas cet événement.
**Solution** : Ajouter `onEditorEvent("set-mode", (evt) => this._setMode(evt.detail.mode));` dans `EditorScene.create()`.

## 5. Suppression d'asset sans confirmation

**Symptôme** : Le clic droit supprime immédiatement sans demande.
**Solution** : Le mode "Delete" du toolbar affiche désormais une `ConfirmDialog` avec le nom de l'asset et sa catégorie.

## 6. Sélecteur de profondeur BG

**Symptôme** : Impossible de changer la profondeur d'un asset background.
**Solution** : Ajout d'un bouton "Profondeur" dans `PropertiesPanelUI` pour les assets `background` uniquement. Émet `update-entity` avec `backgroundLayerId`. `EditorScene` réagit en mettant à jour `obj.setDepth()`.

## 7. Nombre de layers BG insuffisant

**Symptôme** : Seulement 4 couches de background.
**Solution** : Ajout de `back-5` (depth 15) et `back-6` (depth 20) dans `LevelData.DEFAULT_BG_LAYERS`.
