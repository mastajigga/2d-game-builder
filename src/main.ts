import Phaser from "phaser";
import "./editor-ui/styles/editor-ui.css";
import { EditorScene } from "./scenes/EditorScene";
import { GymScene } from "./scenes/GymScene";
import { MainMenuUI } from "./editor-ui/MainMenuUI";
import { editorBus, onEditorEvent } from "./editor-ui/EditorBridge";
import { getSlot } from "./save-system/SaveManager";
import type { SaveSlot } from "./save-system/SaveSlot";

// Version injected by Vite define
declare const __APP_VERSION__: string;
document.getElementById("app-version")!.textContent = `v${__APP_VERSION__}`;

// ─── Bootstrap state ──────────────────────────────────────────────────────────────────────────────────

const gameContainer = document.getElementById("game-container")!;
const returnBtn = document.getElementById("return-to-menu")!;
let game: Phaser.Game | null = null;

// Module-level save slot for GymScene to read (wrapped in object for mutability)
export const pendingSaveSlot: { current: SaveSlot | null } = { current: null };

// Show return button
returnBtn.addEventListener("click", () => {
  editorBus.dispatchEvent(new CustomEvent("return-to-menu", { detail: {} }));
});

// ─── Lazy page imports ──────────────────────────────────────────────────────────────────────────────────

let testPage: any = null;
let animationPage: any = null;
let stageBuilderPage: any = null;
let prefabBuilderPage: any = null;

async function getTestPage() {
  if (!testPage) {
    const { TestPageUI } = await import("./editor-ui/TestPageUI");
    testPage = new TestPageUI("test-page");
  }
  return testPage;
}

async function getAnimationPage() {
  if (!animationPage) {
    const { AnimationPageUI } = await import("./editor-ui/AnimationPageUI");
    animationPage = new AnimationPageUI("animation-page");
  }
  return animationPage;
}

async function getStageBuilderPage() {
  if (!stageBuilderPage) {
    const { StageBuilderUI } = await import("./editor-ui/StageBuilderUI");
    stageBuilderPage = new StageBuilderUI("stage-builder");
  }
  return stageBuilderPage;
}

async function getPrefabBuilderPage() {
  if (!prefabBuilderPage) {
    const { PrefabBuilderUI } = await import("./editor-ui/PrefabBuilderUI");
    prefabBuilderPage = new PrefabBuilderUI("prefab-builder");
  }
  return prefabBuilderPage;
}

// ─── Create game lazily ─────────────────────────────────────────────────────────────────────────────────

function startGame(firstScene: string): Phaser.Game {
  // Destroy any existing game instance to prevent memory leaks and GPU contention
  if (game) { game.destroy(true); game = null; }
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1600,
    height: 900,
    parent: "game-container",
    backgroundColor: "#1a1a1a",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    antialias: false,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1800 },
        debug: false,
      },
    },
    scene: [EditorScene, GymScene],
  };

  // Set the first scene
  config.scene = firstScene === "GymScene"
    ? [GymScene, EditorScene]
    : [EditorScene, GymScene];

  return new Phaser.Game(config);
}

function showGame(): void {
  gameContainer.style.display = "block";
  returnBtn.classList.add("visible");
  // After a short delay, instantiate editor UI
  setTimeout(() => {
    import("./editor-ui/PropertiesPanelUI").then((m) => new m.PropertiesPanelUI("properties-panel"));
    import("./editor-ui/ToolbarUI").then((m) => new m.ToolbarUI("editor-toolbar"));
    import("./editor-ui/PaletteUI").then((m) => new m.PaletteUI("editor-palette"));
    import("./editor-ui/TestMenuUI").then((m) => new m.TestMenuUI("test-menu", "test-menu-overlay"));
    import("./editor-ui/TestRunnerUI").then((m) => new m.TestRunnerUI());
    import("./editor-ui/MiniMapUI").then((m) => new m.MiniMapUI("minimap"));
    import("./editor-ui/WorldSettingsUI").then((m) => new m.WorldSettingsUI("world-settings"));
    import("./editor-ui/PrefabUI").then((m) => (window as any).__prefabUI = new m.PrefabUI("prefab-panel"));
    import("./editor-ui/WorldHubUI").then((m) => new m.WorldHubUI("world-hub"));
    // Expose for EditorScene access
    (window as any).__oakwoods_ui = (window as any).__oakwoods_ui || {};
  }, 100);
}

function hideGame(): void {
  returnBtn.classList.remove("visible");
  gameContainer.style.display = "none";
}

// ─── Menu event handlers ─────────────────────────────────────────────────────────────────────────────────

function onMenuPlay(): void {
  pendingSaveSlot.current = null;
  hideMainMenu();
  hideTestPage();
  hideAnimationPage();
  hideStageBuilderPage();
  hidePrefabBuilderPage();
  showGame();
  game = startGame("GymScene");
}

function onMenuDevelop(): void {
  pendingSaveSlot.current = null;
  hideMainMenu();
  hideTestPage();
  hideAnimationPage();
  hideStageBuilderPage();
  hidePrefabBuilderPage();
  showGame();
  game = startGame("EditorScene");
}

function onMenuTest(): void {
  hideMainMenu();
  hideGame();
  hideAnimationPage();
  hideStageBuilderPage();
  hidePrefabBuilderPage();
  getTestPage().then((p: any) => p.show());
}

function onMenuAnimation(): void {
  hideMainMenu();
  hideGame();
  hideTestPage();
  hideStageBuilderPage();
  hidePrefabBuilderPage();
  getAnimationPage().then((p: any) => p.show());
}

function onMenuStageBuilder(): void {
  hideMainMenu();
  hideGame();
  hideTestPage();
  hideAnimationPage();
  getStageBuilderPage().then((p: any) => p.show());
}

function onMenuPrefabBuilder(): void {
  hideMainMenu();
  hideGame();
  hideTestPage();
  hideAnimationPage();
  hideStageBuilderPage();
  
  getPrefabBuilderPage().then((p: any) => p.show());
}

function onMenuResume(slotId: string): void {
  const slot = getSlot(slotId);
  if (!slot) {
    console.warn("Save slot not found:", slotId);
    onMenuPlay(); // fallback
    return;
  }
  pendingSaveSlot.current = slot;
  hideMainMenu();
  hideTestPage();
  hideAnimationPage();
  hideStageBuilderPage();
  hidePrefabBuilderPage();
  showGame();
  game = startGame("GymScene");
}

function onMenuQuit(): void {
  window.close();
}

function onReturnToMenu(): void {
  pendingSaveSlot.current = null;
  if (game) {
    game.destroy(true);
    game = null;
  }
  hideGame();
  hideTestPage();
  hideAnimationPage();
  showMainMenu();
}

function hideTestPage(): void {
  if (testPage) testPage.hide();
}

function hideAnimationPage(): void {
  if (animationPage) animationPage.hide();
}

function hideStageBuilderPage(): void {
  if (stageBuilderPage) stageBuilderPage.hide();
}

function hidePrefabBuilderPage(): void {
  if (prefabBuilderPage) prefabBuilderPage.hide();
}

// ─── Visibility helpers ──────────────────────────────────────────────────────────────────────────────────

let mainMenu: MainMenuUI | null = null;

function showMainMenu(): void {
  mainMenu?.show();
}

function hideMainMenu(): void {
  mainMenu?.hide();
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────────────────────────────

mainMenu = new MainMenuUI("main-menu");
showMainMenu();

// Listen for menu events
onEditorEvent("menu-play", onMenuPlay);
onEditorEvent("menu-develop", onMenuDevelop);
onEditorEvent("menu-test", onMenuTest);
onEditorEvent("menu-animation", onMenuAnimation);
onEditorEvent("menu-stage-builder", onMenuStageBuilder);
onEditorEvent("menu-prefab-builder", onMenuPrefabBuilder);
onEditorEvent("menu-resume", (evt) => onMenuResume(evt.detail.slotId));
onEditorEvent("menu-quit", onMenuQuit);
onEditorEvent("hub-select-level", async (evt) => {
  const { loadLevel } = await import("./level/LevelLoader");
  const levelData = await loadLevel(evt.detail.levelId);
  if (levelData) {
    pendingSaveSlot.current = null;
    hideMainMenu();
    hideTestPage();
    hideAnimationPage();
  hideStageBuilderPage();
  
    showGame();
    game = startGame("GymScene");
    // Store level data for GymScene to read
    (window as any).__oakwoods_levelData = levelData;
  }
});
onEditorEvent("menu-show", () => showMainMenu());

// Listen for scene-initiated return
editorBus.addEventListener("return-to-menu", onReturnToMenu);

// Hide game canvas on load
gameContainer.style.display = "none";
