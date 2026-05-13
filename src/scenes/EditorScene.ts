import Phaser from "phaser";
import { AssetDef, CATALOG_BY_ID, ensureCatalogAnimations, ensureCatalogFrames, getAssetDefaultSize, preloadCatalog } from "../level/AssetCatalog";
import { BackgroundLayer, BackgroundShape, BackgroundShapeKind, LevelData, PlacedEntity, exportLevel, getBackgroundLayer, importLevel, loadLevel, newUid, resetLevel, saveLevel } from "../level/LevelData";
import { UndoAction } from "../level/UndoManager";
import { BackgroundBuilder, BG_COLORS, BG_SHAPE_COLORS, BG_SHAPE_KINDS } from "../editor/BackgroundBuilder";
import { ConfirmDialog } from "../editor/ConfirmDialog";
import { CollisionEditor } from "../editor/CollisionEditor";
import { EntityManager, PlacedView } from "../editor/EntityManager";
import { ASSET_CATALOG } from "../level/AssetCatalog";
import { emitEditorEvent, onEditorEvent } from "../editor-ui/EditorBridge";
import type { TestConfig } from "../editor-ui/TestMenuUI";
import { TileBrush } from "../editor/TileBrush";
import { instantiatePrefab, type PrefabDef } from "../editor/PrefabManager";

// ─── Constants ─────────────────────────────────────────────────────────────────
const W = 1600;
const H = 900;
const PALETTE_W = 400;
const SNAP = 16;
const GRID_MAJOR = 128;
const AUTO_SAVE_MS = 15000;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.1;

export type EditorMode = "stage" | "entity" | "background" | "collision" | "select" | "delete" | "pan";

// ─── Mode categories ───────────────────────────────────────────────────────────
const MODE_TO_CATEGORY: Record<EditorMode, AssetDef["category"] | null> = {
  stage: null,
  entity: null,
  background: "background",
  collision: null,
  select: null,
  delete: null,
  pan: null,
};

// ════════════════════════════════════════════════════════════════════════════════
// EditorScene
// ════════════════════════════════════════════════════════════════════════════════
export class EditorScene extends Phaser.Scene {
  // Data
  private level!: LevelData;

  // Sub-managers
  private entities!: EntityManager;
  private bgBuilder!: BackgroundBuilder;
  private collisionEd!: CollisionEditor;
  private dialog!: ConfirmDialog;

  // DOM test menu visibility (for input gating)
  private testMenuVisible = false;

  // Tile brush
  private tileBrush = new TileBrush();

  // Prefab
  private selectedPrefab: PrefabDef | null = null;

  // State
  private mode: EditorMode = "stage";
  private gridVisible = true;
  private zoomLevel = 1;
  private lastAutoSave = 0;
  private parallaxPreview = false;
  private activeBackgroundLayerId = "mid";
  private activeBackgroundColorIndex = 0;
  private activeShapeColorIndex = 0;
  private activeShapeKindIndex = 0;

  // Palette state (replaces PaletteManager)
  private selectedAssetDef: AssetDef | null = null;

  // Drag / Pan
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartEntities = new Map<string, PlacedEntity>();
  private panning = false;
  private panStartX = 0;
  private panStartY = 0;

  // Clipboard
  private clipboard: PlacedEntity[] = [];

  // HUD
  private statusText!: Phaser.GameObjects.Text;
  private autoSaveText!: Phaser.GameObjects.Text;
  private zoomText!: Phaser.GameObjects.Text;
  private modeLabel!: Phaser.GameObjects.Text;
  private helpBar!: Phaser.GameObjects.Text;

  // World
  private gridGfx!: Phaser.GameObjects.Graphics;
  private bgSelectionGfx!: Phaser.GameObjects.Graphics;
  private cursorPreview: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite | null = null;

  // Background selection
  private selectedBgShapeId: string | null = null;
  private bgLayerContainer!: Phaser.GameObjects.Container;
  private bgLayerButtonMap = new Map<string, Phaser.GameObjects.Rectangle>();

  // Keys
  private keyTab!: Phaser.Input.Keyboard.Key;
  private keyDel!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyG!: Phaser.Input.Keyboard.Key;
  private keyF!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyBracketL!: Phaser.Input.Keyboard.Key;
  private keyBracketR!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyY!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private keyV!: Phaser.Input.Keyboard.Key;
  private keyExport!: Phaser.Input.Keyboard.Key;
  private keyImport!: Phaser.Input.Keyboard.Key;
  private keyCtrl!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;

  constructor() { super("EditorScene"); }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRELOAD
  // ═══════════════════════════════════════════════════════════════════════════
  preload(): void {
    const cx = W / 2, cy = H / 2;
    const loadText = this.add.text(cx, cy, "Chargement des assets...", {
      fontSize: "24px", color: "#ffffff",
    }).setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy + 40, 400, 8, 0x333333).setOrigin(0.5);
    const barFg = this.add.rectangle(cx - 200, cy + 40, 0, 8, 0x44aaff).setOrigin(0, 0);
    this.load.on("progress", (v: number) => {
      barFg.width = 400 * v;
      loadText.setText(`Chargement... ${Math.floor(v * 100)}%`);
    });
    preloadCatalog(this);
    this.load.image("mossy-bg", "assets/Mossy Tileset/Mossy - BackgroundDecoration.png");
    this.load.image("mossy-hills", "assets/Mossy Tileset/Mossy - MossyHills.png");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════
  create(): void {
    this.children.removeAll(true);
    this.level = loadLevel();
    this.activeBackgroundLayerId = this.level.backgroundLayers[1]?.id ?? this.level.backgroundLayers[0]?.id ?? "mid";
    this.activeBackgroundColorIndex = Math.max(0, BG_COLORS.indexOf(this.level.backgroundColor));
    ensureCatalogAnimations(this);
    ensureCatalogFrames(this);

    this.bgBuilder = new BackgroundBuilder(this);
    this.bgBuilder.render(this.level);

    this.gridGfx = this.add.graphics().setDepth(-50);
    this.bgSelectionGfx = this.add.graphics().setDepth(-45);
    this._redrawGrid();

    this.entities = new EntityManager(this);
    for (const e of this.level.entities) this.entities.spawn(e, this.activeBackgroundLayerId);

    this.collisionEd = new CollisionEditor(this);

    this.dialog = new ConfirmDialog(this);

    // Listen to DOM toolbar commands via bridge
    // (test menu and palette are now DOM-native; commands come via bridge)
    this._buildHUD();
    this._buildBgLayerSelector();
    this._setupInput();

    onEditorEvent("save-level", () => { saveLevel(this.level); this._setStatus("✓ Sauvegardé"); });
    onEditorEvent("export-level", () => { exportLevel(this.level); this._setStatus("✓ Exporté"); });
    onEditorEvent("import-level", () => this._doImport());
    onEditorEvent("toggle-test-menu", () => {
      this.testMenuVisible = !this.testMenuVisible;
      const ui = (window as any).__oakwoods_ui;
      if (ui?.testMenu) ui.testMenu.toggle();
    });
    onEditorEvent("toggle-grid", () => {
      this.gridVisible = !this.gridVisible;
      this._redrawGrid();
    });
    onEditorEvent("zoom", (evt) => {
      const { direction } = evt.detail;
      if (direction === "in") this._setZoom(this.zoomLevel + ZOOM_STEP);
      else if (direction === "out") this._setZoom(this.zoomLevel - ZOOM_STEP);
      else this._setZoom(1);
    });
    onEditorEvent("trigger-undo", () => {
      const action = this.entities.getUndoManager().undo();
      if (action) { this._applyUndo(action); this._setStatus("↩ Undo"); }
    });
    onEditorEvent("trigger-redo", () => {
      const action = this.entities.getUndoManager().redo();
      if (action) { this._applyRedo(action); this._setStatus("↪ Redo"); }
    });
    onEditorEvent("playtest", () => {
      saveLevel(this.level);
      this.registry.set("level", this.level);
      this.registry.set("fromEditor", true);
      const sel = this.entities.getSelected();
      if (sel) {
        const v = this.entities.getViews().get(sel);
        if (v) this.registry.set("playtestFrom", { x: v.data.x, y: v.data.y });
      }
      this.scene.start("GymScene");
    });

    onEditorEvent("set-mode", (evt) => {
      this._setMode(evt.detail.mode);
    });

    this.entities.onSelect = (uid) => {
      this.collisionEd.setActive(uid ? this.entities.getViews().get(uid) ?? null : null);
      if (uid) {
        const v = this.entities.getViews().get(uid);
        if (v) emitEditorEvent("entity-selected", { entity: v.data, level: this.level });
      } else {
        emitEditorEvent("entity-deselected", {});
      }
    };

    // Listen to DOM UI commands via bridge
    onEditorEvent("update-entity", (evt) => {
      const { uid, changes } = evt.detail;
      const entity = this.level.entities.find((e) => e.uid === uid);
      if (entity) {
        Object.assign(entity, changes);
        const v = this.entities.getViews().get(uid);
        if (v) {
          v.obj.setPosition(entity.x, entity.y);
          v.obj.setScale(entity.scale);
          v.obj.setFlipX(entity.flipX);
          if (changes.rotation !== undefined) {
            this._rotateEntity(v, entity.rotation ?? 0);
          } else {
            v.obj.setAngle(entity.rotation ?? 0);
          }
          if (entity.tint) v.obj.setTint(Phaser.Display.Color.HexStringToColor(entity.tint).color);
          else v.obj.clearTint();
          if ("setDisplaySize" in v.obj) {
            (v.obj as Phaser.GameObjects.Image).setDisplaySize(entity.width ?? 192, entity.height ?? 96);
          }
          if (changes.backgroundLayerId !== undefined) {
            const layer = getBackgroundLayer(this.level, entity.backgroundLayerId);
            v.obj.setDepth(layer.depth);
          }
        }
      }
    });

    onEditorEvent("delete-entity", (evt) => {
      this._removeEntity(evt.detail.uid);
    });

    // Palette selection from DOM
    onEditorEvent("palette-select", (evt) => {
      // Check for custom prefab (id starts with "prefab:")
      if (evt.detail.assetId.startsWith("prefab:")) {
        const customs = JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]");
        const pf = customs.find((p: any) => "prefab:" + p.id === evt.detail.assetId);
        if (pf) {
          this.selectedPrefab = pf;
          this.selectedAssetDef = null;
          this.tileBrush.active = false;
          this._setStatus(`Prefab: ${pf.name} — clique pour placer`);
          return;
        }
      }
      const def = CATALOG_BY_ID[evt.detail.assetId];
      if (def) {
        this.selectedAssetDef = def;
        this._setStatus(`Sélectionné : ${def.label}`);
        if (this.cursorPreview) { this.cursorPreview.destroy(); this.cursorPreview = null; }
        // Activate tile brush if in stage/entity/background mode
        if (this.mode === "stage" || this.mode === "entity" || this.mode === "background") {
          this.tileBrush.active = true;
          this.tileBrush.selectedAsset = def;
          this.tileBrush.reset();
        }
      }
    });

    // Prefab selection from DOM
    onEditorEvent("prefab-selected", (evt) => {
      this.selectedPrefab = evt.detail.prefab;
      this.selectedAssetDef = null;
      this.tileBrush.active = false;
      this._setStatus(`Prefab: ${evt.detail.prefab.name} — clique pour placer`);
    });
    onEditorEvent("prefab-deselected", () => {
      this.selectedPrefab = null;
      this._setStatus("");
    });

    // Test commands from DOM
    onEditorEvent("run-test", (evt) => {
      this._runTest(evt.detail.type);
    });
    onEditorEvent("test-toggle", (evt) => {
      this._onTestToggle(evt.detail.key as keyof TestConfig, evt.detail.value);
    });

    // Minimap + World Settings
    emitEditorEvent("minimap-show", {});
    onEditorEvent("camera-teleport", (evt) => {
      this.cameras.main.scrollX = evt.detail.x;
      this.cameras.main.scrollY = evt.detail.y;
    });
    onEditorEvent("update-world-settings", (evt) => {
      const d = evt.detail;
      if (d.worldW) this.level.worldW = d.worldW;
      if (d.worldH) this.level.worldH = d.worldH;
      if (d.backgroundColor) this.level.backgroundColor = d.backgroundColor;
      // Apply camera bounds
      this.cameras.main.setBounds(0, 0, this.level.worldW, this.level.worldH);
      // Redraw grid
      this._redrawGrid();
      this._setStatus(`Monde: ${this.level.worldW}x${this.level.worldH}`);
    });

    this.lastAutoSave = Date.now();
    this.game.canvas.focus();
    (window as any).__editorScene = this;
    (window as any).__assetCatalog = ASSET_CATALOG;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════
  update(_t: number, _delta: number): void {
    this._updateCursorPreview();
    this._handleKeys();
    this.entities.updateOutlines(this.entities.getSelected());
    this.collisionEd.draw();
    this._autoSaveTick();
    this._updateMiniMap();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  private _setMode(m: EditorMode): void {
    this.mode = m;
    emitEditorEvent("set-mode", { mode: m });
    this.selectedAssetDef = null;
    this.tileBrush.active = false;
    this.tileBrush.selectedAsset = null;
    this.tileBrush.reset();
    emitEditorEvent("palette-clear", {});
    if (this.cursorPreview) { this.cursorPreview.destroy(); this.cursorPreview = null; }

    // Show/hide layer selector
    this.bgLayerContainer.setVisible(m === "background");

    // Filter visibility by mode
    const views = Array.from(this.entities.getViews().values());
    for (const v of views) {
      const def = CATALOG_BY_ID[v.data.assetId];
      const cat = def?.category;
      let alpha = 1;
      if (this.mode === "stage") {
        alpha = (cat === "enemy" || cat === "spawn") ? 0.1 : 1;
      } else if (this.mode === "entity") {
        alpha = (cat === "platform" || cat === "decoration" || cat === "hazard" || cat === "background") ? 0.3 : 1;
      } else if (this.mode === "background") {
        alpha = (cat === "background") ? 1 : 0.05;
      } else {
        alpha = 1;
      }
      v.obj.setAlpha(alpha);

      // Apply / reset background layer tint
      if (cat === "background") {
        if (this.mode === "background") {
          const layer = getBackgroundLayer(this.level, v.data.backgroundLayerId);
          const layerTint = layer.tint ? Phaser.Display.Color.HexStringToColor(layer.tint).color : 0xffffff;
          const entityTint = v.data.tint ? Phaser.Display.Color.HexStringToColor(v.data.tint).color : 0xffffff;
          if (layerTint !== 0xffffff || entityTint !== 0xffffff) {
            const lc = Phaser.Display.Color.IntegerToColor(layerTint);
            const ec = Phaser.Display.Color.IntegerToColor(entityTint);
            const r = Math.round(lc.red * ec.red / 255);
            const g = Math.round(lc.green * ec.green / 255);
            const b = Math.round(lc.blue * ec.blue / 255);
            (v.obj as any).setTint(Phaser.Display.Color.GetColor(r, g, b));
          } else {
            (v.obj as any).clearTint();
          }
        } else {
          if (v.data.tint) (v.obj as any).setTint(Phaser.Display.Color.HexStringToColor(v.data.tint).color);
          else (v.obj as any).clearTint();
        }
      }
    }

    this._setStatus(`Mode: ${m.toUpperCase()}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID
  // ═══════════════════════════════════════════════════════════════════════════
  private _redrawGrid(): void {
    this.gridGfx.clear();
    if (!this.gridVisible) return;
    this.gridGfx.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= this.level.worldW; x += SNAP * 4) {
      this.gridGfx.lineBetween(x, 0, x, H);
    }
    for (let y = 0; y <= H; y += SNAP * 4) {
      this.gridGfx.lineBetween(0, y, this.level.worldW, y);
    }
    this.gridGfx.lineStyle(2, 0xffffff, 0.12);
    for (let x = 0; x <= this.level.worldW; x += GRID_MAJOR) {
      this.gridGfx.lineBetween(x, 0, x, H);
    }
    for (let y = 0; y <= H; y += GRID_MAJOR) {
      this.gridGfx.lineBetween(0, y, this.level.worldW, y);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════════════════════════════
  private _buildHUD(): void {
    this.modeLabel = this.add.text(W - 20, 6, "STAGE", {
      fontSize: "24px", color: "#44ff88", fontStyle: "bold",
      backgroundColor: "#000000aa", padding: { x: 12, y: 4 },
    }).setOrigin(1, 0).setDepth(1001).setScrollFactor(0);

    this.statusText = this.add.text(PALETTE_W + 20, H - 44, "", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#000000aa", padding: { x: 10, y: 5 },
    }).setDepth(1001).setScrollFactor(0);

    this.autoSaveText = this.add.text(W - 20, H - 24, "", {
      fontSize: "13px", color: "#88aa88",
    }).setOrigin(1, 0).setDepth(1001).setScrollFactor(0);

    this.zoomText = this.add.text(PALETTE_W + 10, H - 14, "Zoom: 100%", {
      fontSize: "14px", color: "#aaaaaa",
      backgroundColor: "#000000aa", padding: { x: 6, y: 2 },
    }).setDepth(1001).setScrollFactor(0);

    this.helpBar = this.add.text(PALETTE_W + 20, H - 14, "", {
      fontSize: "14px", color: "#aaaaaa",
    }).setDepth(1001).setScrollFactor(0);
    this._updateHelpBar();
  }

  private _updateHelpBar(): void {
    this.helpBar.setText("Ctrl+Z/Y: Undo/Redo | Ctrl+C/V: Copier/Coller | R: Rotate | M: Test Menu | Tab: Playtest");
  }

  private _buildBgLayerSelector(): void {
    this.bgLayerContainer = this.add.container(W - 300, 42).setDepth(1001).setScrollFactor(0).setVisible(false);
    let x = 0;
    for (const layer of this.level.backgroundLayers) {
      const color = layer.tint ? Number.parseInt(layer.tint.replace("#", ""), 16) : 0x444444;
      const btn = this.add.rectangle(x + 30, 0, 56, 22, color).setStrokeStyle(2, 0xffffff);
      const txt = this.add.text(x + 30, 0, layer.label, { fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.activeBackgroundLayerId = layer.id;
        this._updateBgLayerSelector();
        this._setStatus(`Layer actif: ${layer.label}`);
      });
      this.bgLayerContainer.add([btn, txt]);
      this.bgLayerButtonMap.set(layer.id, btn);
      x += 64;
    }
    this._updateBgLayerSelector();
  }

  private _updateBgLayerSelector(): void {
    for (const [id, btn] of Array.from(this.bgLayerButtonMap.entries())) {
      btn.setStrokeStyle(id === this.activeBackgroundLayerId ? 3 : 1, id === this.activeBackgroundLayerId ? 0xffff00 : 0xffffff);
    }
  }

  private _setStatus(msg: string): void {
    this.statusText.setText(msg);
  }

  private _autoSaveTick(): void {
    const now = Date.now();
    if (now - this.lastAutoSave > AUTO_SAVE_MS) {
      saveLevel(this.level);
      this.lastAutoSave = now;
      this.autoSaveText.setText("✓ Auto-saved");
      this.time.delayedCall(2000, () => { this.autoSaveText.setText(""); });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════════════════════
  private _setupInput(): void {
    const kb = this.input.keyboard!;
    this.keyTab = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyDel = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyG = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyF = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyBracketL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
    this.keyBracketR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyY = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keyV = kb.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    this.keyExport = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyImport = kb.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.keyCtrl = kb.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyP = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    kb.addCapture("TAB");

    kb.on("keydown-LEFT", () => this.cameras.main.scrollX -= 64);
    kb.on("keydown-RIGHT", () => this.cameras.main.scrollX += 64);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.dialog.isVisible()) return;
      if (this.testMenuVisible) return;
      if (p.x < PALETTE_W) return;

      // When clicking outside the DOM panel, deselect current entity.
      // Clicks inside the DOM panel never reach the canvas (pointer-events).
      emitEditorEvent("entity-deselected", {});
      this.entities.clearSelection();
      this.collisionEd.setActive(null);

      const wx = this._snap(this.cameras.main.scrollX + p.x / this.zoomLevel);
      const wy = this._snap(this.cameras.main.scrollY + p.y / this.zoomLevel);

      if (this.mode === "pan" || p.middleButtonDown()) {
        this.panning = true;
        this.panStartX = p.x;
        this.panStartY = p.y;
        return;
      }

      if (this.mode === "delete") {
        const hit = this.entities.findAt(wx, wy);
        if (hit) {
          const def = CATALOG_BY_ID[hit.data.assetId];
          const catLabel = def?.category
            ? def.category.charAt(0).toUpperCase() + def.category.slice(1)
            : "inconnu";
          this.dialog.show(
            `Supprimer "${def?.label ?? "?"}" (${catLabel}) ?`,
            () => this._removeEntity(hit.data.uid),
          );
        }
        return;
      }

      if (p.rightButtonDown()) {
        const hit = this.entities.findAt(wx, wy);
        if (hit) this._removeEntity(hit.data.uid);
        return;
      }

      if (this.mode === "collision") {
        const sel = this.entities.getSelected();
        const view = sel ? this.entities.getViews().get(sel) ?? null : null;
        if (view) {
          const corner = this.collisionEd.hitCorner(wx, wy);
          if (corner) {
            this.collisionEd.startDragCorner(corner, wx, wy);
            return;
          }
        }
        // Fallthrough to select
      }

      // Prefab placement (one-shot, works in stage/entity/background/select modes)
      if (this.selectedPrefab && (this.mode === "stage" || this.mode === "entity" || this.mode === "background" || this.mode === "select")) {
        const entities = instantiatePrefab(this.selectedPrefab, wx, wy);
        for (const e of entities) {
          this.level.entities.push(e);
          this.entities.spawn(e);
        }
        this.entities.getUndoManager().push({ type: "place", entities });
        const pfName = this.selectedPrefab.name;
        this.selectedPrefab = null;
        emitEditorEvent("prefab-deselected", {});
        saveLevel(this.level);
        this._setStatus(`Prefab placé: ${pfName} (${entities.length} entités)`);
        return;
      }

      const asset = this.selectedAssetDef;
      if ((this.mode === "stage" || this.mode === "entity" || this.mode === "background") && asset) {
        if (this.mode === "background" && asset.category === "background") {
          this._placeEntity(asset, wx, wy);
        } else if (this.mode === "stage" && (asset.category === "platform" || asset.category === "decoration" || asset.category === "hazard")) {
          this._placeEntity(asset, wx, wy);
        } else if (this.mode === "entity" && (asset.category === "enemy" || asset.category === "spawn")) {
          this._placeEntity(asset, wx, wy);
        } else {
          this._setStatus("Asset incompatible avec ce mode");
        }
        return;
      }

      if (this.mode === "background") {
        // Clic droit = supprimer shape sous le curseur
        if (p.rightButtonDown()) {
          const hit = this._hitBackgroundShape(wx, wy);
          if (hit) { this._removeBackgroundShape(hit.id); }
          return;
        }
        // Clic gauche sur shape existant = sélectionner
        const hit = this._hitBackgroundShape(wx, wy);
        if (hit) {
          this.selectedBgShapeId = hit.id;
          this._drawBgSelection();
          this._setStatus(`Shape sélectionné: ${hit.kind}`);
          return;
        }
        // Placer asset background ou nouveau shape
        if (asset && asset.category === "background") {
          this._placeEntity(asset, wx, wy);
        } else if (!asset) {
          this._placeBackgroundShape(wx, wy);
        }
        return;
      }

      // Select mode (default)
      const hit = this.entities.findAt(wx, wy);
      if (hit) {
        if (p.event.shiftKey) {
          this.entities.toggleMultiSelect(hit.data.uid);
        } else {
          this.entities.clearSelection();
          this.entities.setSelected(hit.data.uid);
          this.dragging = true;
          this.dragStartX = hit.data.x;
          this.dragStartY = hit.data.y;
          this.dragStartEntities.clear();
          const sel = this.entities.getSelected();
          if (sel) {
            const primary = this.entities.getViews().get(sel);
            if (primary) this.dragStartEntities.set(sel, this.entities.clone(primary.data));
          }
          for (const uid of Array.from(this.entities.getMultiSelected())) {
            const mv = this.entities.getViews().get(uid);
            if (mv) this.dragStartEntities.set(uid, this.entities.clone(mv.data));
          }
        }
        this._setStatus(`Sélectionné : ${CATALOG_BY_ID[hit.data.assetId]?.label ?? "?"}${this.entities.getMultiSelected().size > 0 ? ` (+${this.entities.getMultiSelected().size})` : ""}`);
      } else {
        this.entities.clearSelection();
        this.collisionEd.setActive(null);
      }
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.panning) {
        this.cameras.main.scrollX -= (p.x - this.panStartX);
        this.cameras.main.scrollY -= (p.y - this.panStartY);
        this.panStartX = p.x;
        this.panStartY = p.y;
        return;
      }

      // Tile brush painting
      if (this.tileBrush.active && p.isDown && this.tileBrush.selectedAsset) {
        const wx = this._snap(this.cameras.main.scrollX + p.x / this.zoomLevel);
        const wy = this._snap(this.cameras.main.scrollY + p.y / this.zoomLevel);
        const newEntities = this.tileBrush.tick(wx, wy, this.level.entities);
        for (const e of newEntities) {
          this.level.entities.push(e);
          this.entities.spawn(e);
          this.entities.getUndoManager().push({ type: "place", entities: [this.entities.clone(e)] });
        }
        if (newEntities.length > 0) {
          this._setStatus(`Brush: ${newEntities.length} placé(s)`);
        }
      }

      if (this.collisionEd.getDraggingCorner()) {
        const wx = this.cameras.main.scrollX + p.x / this.zoomLevel;
        const wy = this.cameras.main.scrollY + p.y / this.zoomLevel;
        this.collisionEd.updateDrag(wx, wy);
        return;
      }

      if (this.dragging && this.entities.getSelected()) {
        const wx = this._snap(this.cameras.main.scrollX + p.x / this.zoomLevel);
        const wy = this._snap(this.cameras.main.scrollY + p.y / this.zoomLevel);
        const v = this.entities.getViews().get(this.entities.getSelected()!);
        if (v) {
          const dx = wx - v.data.x;
          const dy = wy - v.data.y;
          v.data.x = wx;
          v.data.y = wy;
          v.obj.setPosition(wx, wy);
          for (const uid of Array.from(this.entities.getMultiSelected())) {
            const mv = this.entities.getViews().get(uid);
            if (mv) {
              mv.data.x += dx;
              mv.data.y += dy;
              mv.obj.setPosition(mv.data.x, mv.data.y);
            }
          }
        }
      }
    });

    this.input.on("pointerup", () => {
      if (this.collisionEd.getDraggingCorner()) {
        this.collisionEd.stopDrag();
        const sel = this.entities.getSelected();
        if (sel) {
          const v = this.entities.getViews().get(sel);
          if (v) {
            this.level.entities = this.level.entities.map((e) => e.uid === v.data.uid ? this.entities.clone(v.data) : e);
            this.entities.getUndoManager().push({ type: "modify", entities: [this.entities.clone(v.data)], previous: [this.dragStartEntities.get(sel) ?? this.entities.clone(v.data)] });
          }
        }
      }

      if (this.dragging && this.entities.getSelected()) {
        const sel = this.entities.getSelected()!;
        const v = this.entities.getViews().get(sel);
        if (v && (v.data.x !== this.dragStartX || v.data.y !== this.dragStartY)) {
          const allMoved = [sel];
          for (const uid of Array.from(this.entities.getMultiSelected())) {
            if (!allMoved.includes(uid)) allMoved.push(uid);
          }
          const previous: PlacedEntity[] = [];
          const current: PlacedEntity[] = [];
          for (const uid of allMoved) {
            const mv = this.entities.getViews().get(uid);
            if (mv) {
              const before = this.dragStartEntities.get(uid);
              if (before) previous.push(this.entities.clone(before));
              current.push(this.entities.clone(mv.data));
            }
          }
          if (previous.length > 0) {
            this.entities.getUndoManager().push({ type: "move", previous, entities: current });
          }
          // Sync level data
          for (const uid of allMoved) {
            const mv = this.entities.getViews().get(uid);
            if (mv) {
              const idx = this.level.entities.findIndex((e) => e.uid === uid);
              if (idx >= 0) this.level.entities[idx] = this.entities.clone(mv.data);
            }
          }
        }
      }
      this.dragging = false;
      this.panning = false;
      this.dragStartEntities.clear();
    });

    this.input.on("wheel", (_p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, _gz: number[]) => {
      const px = this.input.activePointer.x;
      if (px < PALETTE_W) return;
      const delta = (_gz as number[])[0] || (_gy as number[])[0];
      if (!delta) return;
      this.zoomLevel = Phaser.Math.Clamp(this.zoomLevel - delta * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
      this.cameras.main.setZoom(this.zoomLevel);
      this.zoomText.setText(`Zoom: ${Math.floor(this.zoomLevel * 100)}%`);
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.x < PALETTE_W) { this.game.canvas.style.cursor = "default"; return; }
      switch (this.mode) {
        case "stage":
        case "entity":
        case "background": this.game.canvas.style.cursor = "crosshair"; break;
        case "delete": this.game.canvas.style.cursor = "not-allowed"; break;
        case "pan": this.game.canvas.style.cursor = "grab"; break;
        case "collision": this.game.canvas.style.cursor = "crosshair"; break;
        default: this.game.canvas.style.cursor = "default";
      }
    });

    this.input.mouse?.disableContextMenu();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  private _placeEntity(a: AssetDef, wx: number, wy: number): void {
    // Offset so the center lands at cursor instead of top-left/feet
    let ox = wx, oy = wy;
    const size = getAssetDefaultSize(a);
    if (a.sourceFrame || a.category === "platform") {
      ox = wx - (a.defaultWidth ?? size.width) / 2;
      oy = wy - (a.defaultHeight ?? size.height) / 2;
    } else if (a.sheetPath && a.frameW && a.frameH) {
      // Sprites: offset by half frame at scale
      ox = wx - (a.frameW * a.defaultScale) * (0.5 - (a.originX ?? 0.5));
      oy = wy - (a.frameH * a.defaultScale) * (0.5 - (a.originY ?? 0.5));
    }
    const newE = this.entities.createEntityFromAsset(a, ox, oy, this.activeBackgroundLayerId);
    this.level.entities.push(newE);
    this.entities.spawn(newE, this.activeBackgroundLayerId);
    this.entities.getUndoManager().push({ type: "place", entities: [this.entities.clone(newE)] });
    this.entities.setSelected(newE.uid);
    this._setStatus(`Placé : ${a.label} @ (${wx}, ${wy})`);
  }

  private _placeBackgroundShape(wx: number, wy: number): void {
    const kind = BG_SHAPE_KINDS[this.activeShapeKindIndex];
    const shape = this.bgBuilder.createShape(wx, wy, kind, BG_SHAPE_COLORS[this.activeShapeColorIndex], this.activeBackgroundLayerId);
    this.level.backgroundShapes.push(shape);
    this.bgBuilder.render(this.level);
    this._setStatus(`Shape: ${kind} ${shape.color}`);
  }

  private _removeEntity(uid: string): void {
    const removed = this.entities.remove(uid, true);
    if (removed) {
      this.level.entities = this.level.entities.filter((e) => e.uid !== uid);
      this._setStatus("Supprimé");
    }
  }

  private _onPaletteSelect(a: AssetDef): void {
    this._setStatus(`Sélectionné : ${a.label}`);
    if (this.cursorPreview) { this.cursorPreview.destroy(); this.cursorPreview = null; }
  }

  private _onPropChange(e: PlacedEntity): void {
    const idx = this.level.entities.findIndex((ent) => ent.uid === e.uid);
    if (idx >= 0) this.level.entities[idx] = this.entities.clone(e);
    const v = this.entities.getViews().get(e.uid);
    if (v) {
      v.obj.setPosition(e.x, e.y);
      v.obj.setScale(e.scale);
      v.obj.setFlipX(e.flipX);
      v.obj.setAngle(e.rotation ?? 0);
      if (e.tint) v.obj.setTint(Phaser.Display.Color.HexStringToColor(e.tint).color);
      else v.obj.clearTint();
      if ("setDisplaySize" in v.obj) {
        (v.obj as Phaser.GameObjects.Image).setDisplaySize(e.width ?? 192, e.height ?? 96);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYS
  // ═══════════════════════════════════════════════════════════════════════════
  private _handleKeys(): void {
    // Ignore shortcuts when a DOM input is focused
    if (document.querySelector("input:focus, textarea:focus, select:focus")) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyTab)) {
      saveLevel(this.level);
      this.registry.set("level", this.level);
      this.registry.set("fromEditor", true);
      const sel = this.entities.getSelected();
      if (sel) {
        const v = this.entities.getViews().get(sel);
        if (v) this.registry.set("playtestFrom", { x: v.data.x, y: v.data.y });
      }
      this.scene.start("GymScene");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.selectedAssetDef = null;
      emitEditorEvent("palette-clear", {});
      this.entities.clearSelection();
      this.collisionEd.setActive(null);
      if (this.cursorPreview) { this.cursorPreview.destroy(); this.cursorPreview = null; }
      this._setMode("select");
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyZ)) {
      const action = this.entities.getUndoManager().undo();
      if (action) { this._applyUndo(action); this._setStatus("↩ Undo"); }
    }
    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyY)) {
      const action = this.entities.getUndoManager().redo();
      if (action) { this._applyRedo(action); this._setStatus("↪ Redo"); }
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyC)) {
      this.clipboard = [];
      const sel = this.entities.getSelected();
      if (sel) {
        const v = this.entities.getViews().get(sel);
        if (v) this.clipboard.push(this.entities.clone(v.data));
      }
      for (const uid of Array.from(this.entities.getMultiSelected())) {
        const v = this.entities.getViews().get(uid);
        if (v) this.clipboard.push(this.entities.clone(v.data));
      }
      this._setStatus(`📋 Copié (${this.clipboard.length})`);
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyV)) {
      if (this.clipboard.length > 0) {
        for (const original of this.clipboard) {
          const copy: PlacedEntity = {
            ...this.entities.clone(original),
            uid: newUid(original.uid.charAt(0)),
            x: original.x + 48,
            y: original.y,
          };
          this.level.entities.push(copy);
          this.entities.spawn(copy);
          this.entities.getUndoManager().push({ type: "place", entities: [this.entities.clone(copy)] });
        }
        this._setStatus(`📋 Collé (${this.clipboard.length})`);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyDel)) {
      if (this.selectedBgShapeId && this.mode === "background") {
        this._removeBackgroundShape(this.selectedBgShapeId);
        return;
      }
      const sel = this.entities.getSelected();
      if (sel) {
        const toDelete = [sel];
        for (const uid of Array.from(this.entities.getMultiSelected())) {
          if (!toDelete.includes(uid)) toDelete.push(uid);
        }
        for (const uid of toDelete) this._removeEntity(uid);
        this._setStatus("Supprimé");
      }
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyS)) {
      saveLevel(this.level);
      this._setStatus("✓ Sauvegardé");
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyExport)) {
      exportLevel(this.level);
      this._setStatus("✓ Exporté");
    }

    if (this.keyCtrl.isDown && Phaser.Input.Keyboard.JustDown(this.keyImport)) {
      this._doImport();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyG)) {
      this.gridVisible = !this.gridVisible;
      this._redrawGrid();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
      const sel = this.entities.getSelected();
      if (sel) {
        const v = this.entities.getViews().get(sel);
        if (v && "setFlipX" in v.obj) {
          v.data.flipX = !v.data.flipX;
          (v.obj as Phaser.GameObjects.Sprite).setFlipX(v.data.flipX);
          this._onPropChange(v.data);
        }
      }
    }

    // Rotation
    if (Phaser.Input.Keyboard.JustDown(this.keyR) && !this.keyCtrl.isDown) {
      const sel = this.entities.getSelected();
      if (sel) {
        const v = this.entities.getViews().get(sel);
        if (v) {
          this._rotateEntity(v, ((v.data.rotation ?? 0) + 90) % 360);
          // Rotation de la collision box aussi (échange W/H)
          if (v.data.collision?.enabled) {
            const cw = v.data.collision.width;
            const ch = v.data.collision.height;
            v.data.collision.width = ch;
            v.data.collision.height = cw;
          }
          this._onPropChange(v.data);
          this._setStatus(`Rotation: ${v.data.rotation}°`);
        }
      }
    }

    // Scale
    const sel = this.entities.getSelected();
    if (sel) {
      if (Phaser.Input.Keyboard.JustDown(this.keyBracketL)) this._scaleSelected(0.9);
      if (Phaser.Input.Keyboard.JustDown(this.keyBracketR)) this._scaleSelected(1.1);
    }

    // Test Menu
    if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
      emitEditorEvent("toggle-test-menu", {});
    }

    // Toggle collision mode
    if (Phaser.Input.Keyboard.JustDown(this.keyH)) {
      this._setMode(this.mode === "collision" ? "select" : "collision");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROTATION / SCALE
  // ═══════════════════════════════════════════════════════════════════════════

  private _rotateEntity(v: PlacedView, newAngle: number): void {
    // Rotate around visual center regardless of origin
    const obj = v.obj;
    const b = obj.getBounds();
    const cx = b.centerX;
    const cy = b.centerY;

    v.data.rotation = newAngle;
    obj.setAngle(newAngle);

    // Restore center position
    const nb = obj.getBounds();
    obj.x += cx - nb.centerX;
    obj.y += cy - nb.centerY;
  }

  private _scaleSelected(factor: number): void {
    const sel = this.entities.getSelected();
    if (!sel) return;
    const v = this.entities.getViews().get(sel);
    if (!v) return;
    const def = CATALOG_BY_ID[v.data.assetId];
    if (!def) return;

    if (def.sourceFrame || def.category === "platform") {
      v.data.width = Math.max(64, Math.round((v.data.width ?? 192) * factor));
      v.data.height = Math.max(32, Math.round((v.data.height ?? 96) * factor));
      v.obj.destroy();
      v.outline.destroy();
      this.entities.getViews().delete(v.data.uid);
      this.entities.spawn(v.data);
      this._setStatus(`Taille: ${v.data.width}x${v.data.height}`);
      return;
    } else if ("setScale" in v.obj) {
      v.data.scale = Math.max(0.05, v.data.scale * factor);
      (v.obj as Phaser.GameObjects.Sprite).setScale(v.data.scale);
    }
    this._setStatus(`Scale: ${v.data.scale.toFixed(2)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ═══════════════════════════════════════════════════════════════════════════
  private _applyUndo(action: UndoAction): void {
    if (action.type === "place") {
      for (const e of action.entities) {
        this.entities.destroyView(e.uid);
        this.level.entities = this.level.entities.filter((ent) => ent.uid !== e.uid);
      }
      return;
    }
    if (action.type === "delete") {
      for (const e of action.entities) {
        this.level.entities.push(this.entities.clone(e));
        this.entities.spawn(e);
      }
      return;
    }
    if (action.previous) {
      for (const e of action.previous) {
        const idx = this.level.entities.findIndex((ent) => ent.uid === e.uid);
        if (idx >= 0) this.level.entities[idx] = this.entities.clone(e);
        this.entities.upsert(e);
      }
    }
  }

  private _applyRedo(action: UndoAction): void {
    if (action.type === "delete") {
      for (const e of action.entities) {
        this.entities.destroyView(e.uid);
        this.level.entities = this.level.entities.filter((ent) => ent.uid !== e.uid);
      }
      return;
    }
    if (action.type === "place") {
      for (const e of action.entities) {
        this.level.entities.push(this.entities.clone(e));
        this.entities.spawn(e);
      }
      return;
    }
    for (const e of action.entities) {
      const idx = this.level.entities.findIndex((ent) => ent.uid === e.uid);
      if (idx >= 0) this.level.entities[idx] = this.entities.clone(e);
      this.entities.upsert(e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT / RESET
  // ═══════════════════════════════════════════════════════════════════════════
  private async _doImport(): Promise<void> {
    try {
      const lvl = await importLevel();
      this.level = lvl;
      this.activeBackgroundLayerId = this.level.backgroundLayers[1]?.id ?? this.level.backgroundLayers[0]?.id ?? "mid";
      this.activeBackgroundColorIndex = Math.max(0, BG_COLORS.indexOf(this.level.backgroundColor));
      this.bgBuilder.render(this.level);
      this.entities.reloadAll(this.level.entities, this.activeBackgroundLayerId);
      this._setStatus("✓ Importé");
    } catch {
      this._setStatus("✗ Import échoué");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CURSOR PREVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  private _updateCursorPreview(): void {
    const asset = this.selectedAssetDef;
    const canPreview = (this.mode === "stage" || this.mode === "entity" || this.mode === "background") && asset;
    if (!canPreview) {
      if (this.cursorPreview) this.cursorPreview.setVisible(false);
      return;
    }
    if (!asset) return;

    const p = this.input.activePointer;
    if (p.x < PALETTE_W) {
      if (this.cursorPreview) this.cursorPreview.setVisible(false);
      return;
    }

    const wx = this._snap(this.cameras.main.scrollX + p.x / this.zoomLevel);
    const wy = this._snap(this.cameras.main.scrollY + p.y / this.zoomLevel);
    const a = asset;

    if (!this.cursorPreview) {
      if (a.sourceFrame) {
        const size = getAssetDefaultSize(a);
        const im = this.add.image(wx, wy, a.textureKey, a.id)
          .setOrigin(0.5, 0.5).setAlpha(0.6);
        im.setDisplaySize(size.width, size.height);
        this.cursorPreview = im;
      } else if (a.category === "platform") {
        const w = 192, h = 96;
        const tp = this.add.tileSprite(wx, wy, w, h, a.textureKey)
          .setOrigin(0.5, 0.5).setAlpha(0.6);
        tp.setTilePosition(a.tileOffsetX ?? 0, a.tileOffsetY ?? 0);
        this.cursorPreview = tp as unknown as Phaser.GameObjects.TileSprite;
      } else {
        this.cursorPreview = this.add.sprite(wx, wy, a.textureKey, 0)
          .setOrigin(0.5, 0.5)
          .setScale(a.defaultScale)
          .setAlpha(0.6);
      }
      this.cursorPreview.setDepth(900);
    } else {
      this.cursorPreview.setPosition(wx, wy);
      this.cursorPreview.setVisible(true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND SHAPES
  // ═══════════════════════════════════════════════════════════════════════════
  private _hitBackgroundShape(wx: number, wy: number): BackgroundShape | null {
    for (let i = this.level.backgroundShapes.length - 1; i >= 0; i--) {
      const s = this.level.backgroundShapes[i];
      if (s.kind === "rect") {
        if (wx >= s.x && wx <= s.x + s.width && wy >= s.y && wy <= s.y + s.height) return s;
      } else if (s.kind === "circle") {
        const r = s.width / 2;
        if (Math.hypot(wx - s.x, wy - s.y) <= r) return s;
      } else {
        const rx = s.width / 2;
        const ry = s.height / 2;
        if (Math.pow((wx - s.x) / rx, 2) + Math.pow((wy - s.y) / ry, 2) <= 1) return s;
      }
    }
    return null;
  }

  private _drawBgSelection(): void {
    this.bgSelectionGfx.clear();
    if (!this.selectedBgShapeId) return;
    const s = this.level.backgroundShapes.find((sh) => sh.id === this.selectedBgShapeId);
    if (!s) return;
    this.bgSelectionGfx.lineStyle(2, 0xffff00, 0.8);
    if (s.kind === "rect") {
      this.bgSelectionGfx.strokeRect(s.x, s.y, s.width, s.height);
    } else if (s.kind === "circle") {
      this.bgSelectionGfx.strokeCircle(s.x, s.y, s.width / 2);
    } else {
      this.bgSelectionGfx.strokeEllipse(s.x, s.y, s.width, s.height);
    }
  }

  private _removeBackgroundShape(id: string): void {
    this.level.backgroundShapes = this.level.backgroundShapes.filter((s) => s.id !== id);
    if (this.selectedBgShapeId === id) this.selectedBgShapeId = null;
    this.bgBuilder.render(this.level);
    this._drawBgSelection();
    this._setStatus("Shape supprimé");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  private _runTest(type: string | null): void {
    this._setStatus(`Test: ${type ?? "none"}`);
    // Placeholder: will be expanded in future iterations
  }

  private _onTestToggle(key: keyof TestConfig, value: boolean): void {
    this._setStatus(`Test ${key}: ${value ? "ON" : "OFF"}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // MINIMAP
  // ═══════════════════════════════════════════════════════════════════════════

  private _minimapTick = 0;

  private _updateMiniMap(): void {
    // Throttle to every 10 frames (~6 updates/sec)
    this._minimapTick++;
    if (this._minimapTick % 10 !== 0) return;

    const cam = this.cameras.main;
    const entities = this.level.entities.map((e) => {
      const def = CATALOG_BY_ID[e.assetId];
      return {
        x: e.x,
        y: e.y,
        w: def?.defaultWidth ?? 48,
        h: def?.defaultHeight ?? 48,
        category: def?.category ?? "decoration",
      };
    });

    emitEditorEvent("minimap-update", {
      worldW: this.level.worldW,
      worldH: this.level.worldH,
      entities,
      camX: cam.scrollX,
      camY: cam.scrollY,
      camW: cam.width / this.zoomLevel,
      camH: cam.height / this.zoomLevel,
    });
  }

  private _setZoom(z: number): void {
    this.zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    this.cameras.main.setZoom(this.zoomLevel);
    this.zoomText.setText(`Zoom: ${Math.round(this.zoomLevel * 100)}%`);
  }

  private _snap(v: number): number {
    return Math.round(v / SNAP) * SNAP;
  }
}
