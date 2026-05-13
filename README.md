# Oakwoods Level Builder

Phaser 3 + TypeScript + Vite project for building and playtesting a 2D platformer level.

The current app starts in the level editor. Press `TAB` to test the level in-game, then press `TAB` again to return to the editor.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run dev` starts Vite, usually at `http://localhost:5173`.

## Controls

Editor:

- Left click: place or select, depending on mode
- Right click: delete under cursor
- `TAB`: playtest
- `Esc`: deselect and switch to select mode
- `G`: toggle grid
- `F`: flip selected entity
- `[` / `]`: resize selected entity
- `Ctrl+S`: save
- `Ctrl+Z` / `Ctrl+Y`: undo / redo
- `Ctrl+C` / `Ctrl+V`: copy / paste
- `Ctrl+E` / `Ctrl+I`: export / import JSON
- Middle mouse: pan
- Mouse wheel: zoom

Playtest:

- Arrow keys: move and jump
- `Z`: attack
- `T`: respawn
- `TAB`: return to editor

## Architecture

- `src/main.ts`: Phaser config and scene registration.
- `src/scenes/EditorScene.ts`: level editor, palette, selection, autosave, import/export, undo/redo.
- `src/scenes/GymScene.ts`: playtest scene with player, platforms, enemies, combat, respawn, and game over flow.
- `src/level/AssetCatalog.ts`: central catalog for placeable assets, including the background builder assets.
- `src/level/LevelData.ts`: level schema, default level, localStorage persistence, import/export.
- `src/level/UndoManager.ts`: undo/redo stacks used by the editor.

## Assets

The project currently uses the local assets under `public/assets/`:

- `Mossy Tileset`
- `Mushroom with VFX`
- `Plant Animations`
- `Skeleton_With_VFX`

`Mossy - Decorations&Hazards.png` assets are visual-only for now. They are not dangerous in playtest mode.

`Mossy - FloatingPlatforms.png`, `Mossy - MossyHills.png`, and `Mossy - Hanging Plants.png` are exposed through the editor palette via cropped Phaser frames with smaller default display sizes, so their source spritesheet dimensions do not leak directly into gameplay.
