# CLAUDE.md

Guidance for agents working in this repository.

## Commands

```bash
npm run dev
npm run build
npm run preview
```

No lint or test scripts are currently configured.

On Windows, prefer `npm.cmd run build` if PowerShell blocks `npm.ps1`.

## Current Architecture

This is a Phaser 3 pixel-art platformer editor built with TypeScript and Vite.

The current scene flow is:

```text
EditorScene -> GymScene -> EditorScene
```

`EditorScene` is the default first scene. It lets the user place background assets, platforms, decorations, hazards, enemies, and the player spawn. It saves to `localStorage`, supports import/export JSON, and can playtest with `TAB`.

`GymScene` loads the saved level and runs the playable version with Arcade Physics, the skeleton player, mushroom enemies, collision platforms, attacks, respawn, and game over UI.

`GameScene` and `BootScene` are older starter-pack scenes. They still exist, but they are not registered in `src/main.ts`.

## Important Files

- `src/main.ts`: Phaser config, 1600x900 internal resolution, Arcade gravity, scene registration.
- `src/scenes/EditorScene.ts`: editor UI, palette, grid, selection, undo/redo, save/import/export.
- `src/scenes/GymScene.ts`: playable level runtime.
- `src/level/AssetCatalog.ts`: source of truth for editor assets, frame crops, default display sizes, and preload behavior.
- `src/level/LevelData.ts`: level schema and persistence.
- `src/level/UndoManager.ts`: undo and redo stack manager.

## Asset Notes

Assets are loaded from `public/assets/`.

The catalog uses cropped Phaser frames for large spritesheet assets. Keep `sourceFrame` as the crop rectangle and use `defaultWidth` / `defaultHeight` for the intended in-world size.

Hazards from `Mossy - Decorations&Hazards.png` are currently visual-only. Do not add damage or collision unless explicitly requested.

Floating platforms from `Mossy - FloatingPlatforms.png`, hills from `Mossy - MossyHills.png`, and vines from `Mossy - Hanging Plants.png` should be added through `AssetCatalog.ts`, not hardcoded in scenes.

## Development Notes

- Keep new placeable assets catalog-driven.
- Keep editor and playtest rendering consistent by using `getAssetDefaultSize`.
- When changing level data shape, bump `STORAGE_KEY` in `LevelData.ts` or provide migration logic.
- Run `npm.cmd run build` before finishing code changes.
