import { PlacedEntity, PlayerStats, LevelData } from "../level/LevelData";

export type EditorMode = "stage" | "entity" | "background" | "collision" | "select" | "delete" | "pan";

// ─── Event detail types ───────────────────────────────────────────────────────

export interface EntitySelectedDetail {
  entity: PlacedEntity;
  level?: LevelData;
}

export interface EntityDeselectedDetail {
  // empty
}

export interface UpdateEntityDetail {
  uid: string;
  changes: Partial<PlacedEntity>;
}

export interface DeleteEntityDetail {
  uid: string;
}

export interface SetModeDetail {
  mode: EditorMode;
}

export interface TriggerUndoDetail { /* empty */ }
export interface TriggerRedoDetail { /* empty */ }
export interface SaveLevelDetail { /* empty */ }
export interface PlaytestDetail { /* empty */ }
export interface ExportLevelDetail { /* empty */ }
export interface ImportLevelDetail { /* empty */ }
export interface ToggleGridDetail { /* empty */ }
export interface ToggleTestMenuDetail { /* empty */ }
export interface ToggleTestRunnerDetail { /* empty */ }
export interface ToggleWorldSettingsDetail { /* empty */ }
export interface ZoomDetail {
  direction: "in" | "out" | "reset";
}

export interface PaletteSelectDetail {
  assetId: string;
}
export interface PaletteClearDetail { /* empty */ }

export type TestType = "jump" | "attack" | "patrol" | "collision" | null;

export interface RunTestDetail {
  type: TestType;
}
export interface TestToggleDetail {
  key: string;
  value: boolean;
}

// ─── Main menu events ────────────────────────────────────────────────────────

export interface MenuPlayDetail { /* empty */ }
export interface MenuResumeDetail {
  slotId: string;
}
export interface MenuDevelopDetail { /* empty */ }
export interface MenuTestDetail { /* empty */ }
export interface MenuAnimationDetail { /* empty */ }
export interface MenuStageBuilderDetail { /* empty */ }
export interface MenuPrefabBuilderDetail { /* empty */ }
export interface MenuQuitDetail { /* empty */ }
export interface ReturnToMenuDetail { /* empty */ }

export interface MinimapUpdateDetail {
  worldW: number;
  worldH: number;
  entities: Array<{ x: number; y: number; w: number; h: number; category: string }>;
  camX: number;
  camY: number;
  camW: number;
  camH: number;
}
export interface MinimapShowDetail { /* empty */ }
export interface MinimapHideDetail { /* empty */ }
export interface CameraTeleportDetail {
  x: number;
  y: number;
}

export interface WorldSettingsDetail {
  worldW?: number;
  worldH?: number;
  backgroundColor?: string;
  gravityY?: number;
}

export interface HubSelectLevelDetail {
  levelId: string;
}
export interface HubShowDetail { /* empty */ }
export interface HubHideDetail { /* empty */ }
export interface MenuShowDetail { /* empty */ }

export interface PrefabToggleDetail { /* empty */ }
export interface PrefabHideDetail { /* empty */ }
export interface PrefabSelectedDetail {
  prefab: import("../editor/PrefabManager").PrefabDef;
}
export interface PrefabDeselectedDetail { /* empty */ }
export interface PrefabPlaceDetail {
  entities: import("../level/LevelData").PlacedEntity[];
}

// ─── Typed event map ──────────────────────────────────────────────────────────

export interface EditorEventMap {
  "entity-selected": CustomEvent<EntitySelectedDetail>;
  "entity-deselected": CustomEvent<EntityDeselectedDetail>;
  "update-entity": CustomEvent<UpdateEntityDetail>;
  "delete-entity": CustomEvent<DeleteEntityDetail>;
  "set-mode": CustomEvent<SetModeDetail>;
  "trigger-undo": CustomEvent<TriggerUndoDetail>;
  "trigger-redo": CustomEvent<TriggerRedoDetail>;
  "save-level": CustomEvent<SaveLevelDetail>;
  "export-level": CustomEvent<ExportLevelDetail>;
  "import-level": CustomEvent<ImportLevelDetail>;
  "toggle-grid": CustomEvent<ToggleGridDetail>;
  "toggle-test-menu": CustomEvent<ToggleTestMenuDetail>;
  "toggle-test-runner": CustomEvent<ToggleTestRunnerDetail>;
  "toggle-world-settings": CustomEvent<ToggleWorldSettingsDetail>;
  "zoom": CustomEvent<ZoomDetail>;
  "playtest": CustomEvent<PlaytestDetail>;
  "palette-select": CustomEvent<PaletteSelectDetail>;
  "palette-clear": CustomEvent<PaletteClearDetail>;
  "run-test": CustomEvent<RunTestDetail>;
  "test-toggle": CustomEvent<TestToggleDetail>;
  "menu-play": CustomEvent<MenuPlayDetail>;
  "menu-resume": CustomEvent<MenuResumeDetail>;
  "menu-develop": CustomEvent<MenuDevelopDetail>;
  "menu-test": CustomEvent<MenuTestDetail>;
  "menu-animation": CustomEvent<MenuAnimationDetail>;
  "menu-stage-builder": CustomEvent<MenuStageBuilderDetail>;
  "menu-prefab-builder": CustomEvent<MenuPrefabBuilderDetail>;
  "menu-quit": CustomEvent<MenuQuitDetail>;
  "return-to-menu": CustomEvent<ReturnToMenuDetail>;
  "minimap-update": CustomEvent<MinimapUpdateDetail>;
  "minimap-show": CustomEvent<MinimapShowDetail>;
  "minimap-hide": CustomEvent<MinimapHideDetail>;
  "camera-teleport": CustomEvent<CameraTeleportDetail>;
  "update-world-settings": CustomEvent<WorldSettingsDetail>;
  "hub-select-level": CustomEvent<HubSelectLevelDetail>;
  "hub-show": CustomEvent<HubShowDetail>;
  "hub-hide": CustomEvent<HubHideDetail>;
  "menu-show": CustomEvent<MenuShowDetail>;
  "prefab-toggle": CustomEvent<PrefabToggleDetail>;
  "prefab-hide": CustomEvent<PrefabHideDetail>;
  "prefab-selected": CustomEvent<PrefabSelectedDetail>;
  "prefab-deselected": CustomEvent<PrefabDeselectedDetail>;
  "prefab-place": CustomEvent<PrefabPlaceDetail>;
}

// ─── Global bridge singleton ──────────────────────────────────────────────────

export const editorBus = new EventTarget();

// ─── Typed helpers ────────────────────────────────────────────────────────────

export function emitEditorEvent<K extends keyof EditorEventMap>(
  name: K,
  detail: EditorEventMap[K]["detail"],
): void {
  editorBus.dispatchEvent(new CustomEvent(name, { detail }) as EditorEventMap[K]);
}

export function onEditorEvent<K extends keyof EditorEventMap>(
  name: K,
  handler: (evt: EditorEventMap[K]) => void,
): () => void {
  const wrapped = (evt: Event) => handler(evt as EditorEventMap[K]);
  editorBus.addEventListener(name, wrapped);
  return () => editorBus.removeEventListener(name, wrapped);
}
