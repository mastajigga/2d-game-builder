import Phaser from "phaser";
import type { LevelData, PlacedEntity } from "../level/LevelData";
import { CATALOG_BY_ID } from "../level/AssetCatalog";

const SNAP = 16;

export class StageBuilderCanvas {
  private game: Phaser.Game | null = null;
  private scene: BuilderScene | null = null;
  private container: HTMLElement;
  private worldW = 3200;
  private worldH = 900;
  private onPlaceEntity?: (wx: number, wy: number) => void;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`StageBuilderCanvas: #${containerId} not found`);
    this.container = el;
  }

  async init(worldW: number, worldH: number): Promise<void> {
    this.worldW = worldW;
    this.worldH = worldH;
    if (this.game) this.game.destroy(true);

    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: w,
      height: h,
      parent: this.container,
      backgroundColor: "#1a1a1a",
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      scene: BuilderScene,
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
    });

    return new Promise<void>((resolve) => {
      this.game!.events.once("ready", () => {
        this.scene = this.game!.scene.getScene("BuilderScene") as BuilderScene;
        this.scene.initWorld(this.worldW, this.worldH);
        resolve();
      });
    });
  }

  setOnPlaceEntity(fn: (wx: number, wy: number) => void): void {
    this.onPlaceEntity = fn;
    if (this.scene) this.scene.onPlaceEntity = fn;
  }

  renderEntities(entities: PlacedEntity[]): void {
    this.scene?.renderEntities(entities);
  }

  /** Returns the index of the entity at world coords, or -1 if none */
  hitEntity(wx: number, wy: number): number {
    return this.scene?.hitEntity(wx, wy) ?? -1;
  }

  setOnDeleteEntity(fn: (index: number) => void): void {
    if (this.scene) this.scene.onDeleteEntity = fn;
  }

  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.scene?.setWorldSize(w, h);
  }

  getWorldSize(): { w: number; h: number } {
    return { w: this.worldW, h: this.worldH };
  }

  setResizeMode(active: boolean, onResize?: (w: number, h: number) => void): void {
    this.scene?.setResizeMode(active, onResize);
  }

  setSelectMode(active: boolean): void {
    if (this.scene) this.scene.selectMode = active;
  }

  /** Show a ghost preview of prefab entities following the cursor */
  setGhostPrefab(entities: Array<{ assetId: string; x: number; y: number; w?: number; h?: number }> | null): void {
    this.scene?.setGhost(entities);
  }

  resizeCanvas(): void {
    if (!this.game) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.game.scale.resize(w, h);
    this.scene?.cameras.main.setSize(w, h);
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
  }
}

// ─── Internal Phaser Scene ─────────────────────────────────────────────────────

class BuilderScene extends Phaser.Scene {
  private gridGfx!: Phaser.GameObjects.Graphics;
  private entityGfx!: Phaser.GameObjects.Graphics;
  private resizeGfx!: Phaser.GameObjects.Graphics;
  private worldW = 3200;
  private worldH = 900;
  private resizeActive = false;
  private resizeCb?: (w: number, h: number) => void;
  // Handle zones
  private handleR!: Phaser.GameObjects.Zone;
  private handleB!: Phaser.GameObjects.Zone;
  private handleL!: Phaser.GameObjects.Zone;
  private handleT!: Phaser.GameObjects.Zone;
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private ghostEntities: Array<{ assetId: string; x: number; y: number; w?: number; h?: number }> | null = null;
  private ghostX = 0;
  private ghostY = 0;
  private entities: PlacedEntity[] = [];
  onPlaceEntity?: (wx: number, wy: number) => void;
  onDeleteEntity?: (index: number) => void;
  selectMode = false;

  constructor() {
    super("BuilderScene");
  }

  initWorld(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.cameras.main.setBounds(0, 0, w, h);
    this._drawGrid();
  }

  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.cameras.main.setBounds(0, 0, w, h);
    this._drawGrid();
  }

  create(): void {
    this.gridGfx = this.add.graphics().setDepth(0);
    this.entityGfx = this.add.graphics().setDepth(10);
    this.resizeGfx = this.add.graphics().setDepth(20);
    this.ghostGfx = this.add.graphics().setDepth(15).setAlpha(0.4);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this._drawGrid();

    // Resize handles (hidden by default)
    const HW = 12, HH = 48, HV = 48, HL = 12;
    this.handleR = this.add.zone(this.worldW, this.worldH / 2, HW, HH).setOrigin(0.5).setDepth(25);
    this.handleB = this.add.zone(this.worldW / 2, this.worldH, HV, HL).setOrigin(0.5).setDepth(25);
    this.handleL = this.add.zone(0, this.worldH / 2, HW, HH).setOrigin(0.5).setDepth(25);
    this.handleT = this.add.zone(this.worldW / 2, 0, HV, HL).setOrigin(0.5).setDepth(25);
    for (const h of [this.handleR, this.handleB, this.handleL, this.handleT]) {
      h.setVisible(false);
      h.setInteractive({ draggable: true });
    }
    this._setupResizeDrag();

    // Keyboard scroll
    const kb = this.input.keyboard!;
    kb.on("keydown-LEFT", () => { this.cameras.main.scrollX = Math.max(0, this.cameras.main.scrollX - 64); });
    kb.on("keydown-RIGHT", () => { this.cameras.main.scrollX = Math.min(this.worldW - this.cameras.main.width, this.cameras.main.scrollX + 64); });
    kb.on("keydown-UP", () => { this.cameras.main.scrollY = Math.max(0, this.cameras.main.scrollY - 64); });
    kb.on("keydown-DOWN", () => { this.cameras.main.scrollY = Math.min(this.worldH - this.cameras.main.height, this.cameras.main.scrollY + 64); });

    // Zoom with mouse wheel
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[]) => {
      const delta = Math.max(-1, Math.min(1, _gz?.[0] ?? _gy?.[0] ?? 0));
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom - delta * 0.1, 0.25, 4);
      this.cameras.main.setZoom(newZoom);
    });

    // Click to place entity / select for deletion
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) return;
      const wx = Math.round((this.cameras.main.scrollX + p.x / this.cameras.main.zoom) / SNAP) * SNAP;
      const wy = Math.round((this.cameras.main.scrollY + p.y / this.cameras.main.zoom) / SNAP) * SNAP;

      if (this.selectMode) {
        // Find entity at click position
        const idx = this.hitEntity(wx, wy);
        if (idx >= 0) {
          this.onDeleteEntity?.(idx);
        }
        return;
      }

      this.onPlaceEntity?.(wx, wy);
    });

    // Middle-button pan
    let panning = false;
    let panX = 0;
    let panY = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) {
        panning = true;
        panX = p.x;
        panY = p.y;
      }
    });
    this.input.on("pointerup", () => { panning = false; });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // Track ghost position
      this.ghostX = Math.round((this.cameras.main.scrollX + p.x / this.cameras.main.zoom) / 16) * 16;
      this.ghostY = Math.round((this.cameras.main.scrollY + p.y / this.cameras.main.zoom) / 16) * 16;
      this._drawGhost();

      if (!panning) return;
      this.cameras.main.scrollX -= (p.x - panX) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (p.y - panY) / this.cameras.main.zoom;
      panX = p.x;
      panY = p.y;
    });

    // Pinch-to-zoom (touch)
    let pinchDist = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        pinchDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x, this.input.pointer1.y,
          this.input.pointer2.x, this.input.pointer2.y,
        );
      }
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const newDist = Phaser.Math.Distance.Between(
          this.input.pointer1.x, this.input.pointer1.y,
          this.input.pointer2.x, this.input.pointer2.y,
        );
        if (pinchDist > 0) {
          const scale = newDist / pinchDist;
          const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * scale, 0.25, 4);
          this.cameras.main.setZoom(newZoom);
        }
        pinchDist = newDist;
      }
    });
  }

  renderEntities(entities: PlacedEntity[]): void {
    this.entities = entities;
    this.entityGfx.clear();
    for (const e of entities) {
      const def = CATALOG_BY_ID[e.assetId];
      if (!def) continue;
      const w = e.width ?? def.defaultWidth ?? 32;
      const h = e.height ?? def.defaultHeight ?? 32;
      const alpha = e.assetId.startsWith("enemy") ? 0.9 : def.category === "platform" ? 0.8 : 0.6;

      // Color by category
      let color = 0x888888;
      if (def.category === "platform") color = 0x5a7d3a;
      else if (def.category === "enemy") color = 0xcc4444;
      else if (def.category === "spawn") color = 0x44cc44;
      else if (def.category === "decoration") color = 0x8a7d5a;
      else if (def.category === "hazard") color = 0xcc8844;
      else if (def.category === "background") color = 0x4477aa;

      this.entityGfx.fillStyle(color, alpha);
      this.entityGfx.fillRect(e.x, e.y, w, h);
      this.entityGfx.lineStyle(1, color, 1);
      this.entityGfx.strokeRect(e.x, e.y, w, h);
    }
  }

  setResizeMode(active: boolean, onResize?: (w: number, h: number) => void): void {
    this.resizeActive = active;
    this.resizeCb = onResize;
    this.handleR.setVisible(active);
    this.handleB.setVisible(active);
    this.handleL.setVisible(active);
    this.handleT.setVisible(active);
    this._drawResizeHandles();
  }

  /** Find entity index at world coords. Returns -1 if none. */
  hitEntity(wx: number, wy: number): number {
    // Iterate in reverse so topmost (last placed) entities are hit first
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const def = CATALOG_BY_ID[e.assetId];
      const w = e.width ?? def?.defaultWidth ?? 32;
      const h = e.height ?? def?.defaultHeight ?? 32;
      if (wx >= e.x && wx <= e.x + w && wy >= e.y && wy <= e.y + h) {
        return i;
      }
    }
    return -1;
  }

  private _drawResizeHandles(): void {
    this.resizeGfx.clear();
    if (!this.resizeActive) return;
    this.resizeGfx.fillStyle(0x4444ff, 0.6);
    // Right handle
    this.resizeGfx.fillRect(this.worldW - 6, this.worldH / 2 - 24, 12, 48);
    // Bottom handle
    this.resizeGfx.fillRect(this.worldW / 2 - 24, this.worldH - 6, 48, 12);
    // Left handle
    this.resizeGfx.fillRect(-6, this.worldH / 2 - 24, 12, 48);
    // Top handle
    this.resizeGfx.fillRect(this.worldW / 2 - 24, -6, 48, 12);
  }

  private _setupResizeDrag(): void {
    const MIN_W = 800, MIN_H = 600;
    const SNAP = 16;
    const handles: Array<{
      h: Phaser.GameObjects.Zone;
      dir: "r" | "b" | "l" | "t";
    }> = [
      { h: this.handleR, dir: "r" },
      { h: this.handleB, dir: "b" },
      { h: this.handleL, dir: "l" },
      { h: this.handleT, dir: "t" },
    ];

    for (const { h, dir } of handles) {
      h.on("drag", (_ptr: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (!this.resizeActive) return;
        const delta = Math.round((dir === "r" || dir === "l" ? dx : dy) / SNAP) * SNAP;
        if (delta === 0) return;

        if (dir === "r") {
          this.worldW = Math.max(MIN_W, this.worldW + delta);
        } else if (dir === "b") {
          this.worldH = Math.max(MIN_H, this.worldH + delta);
        } else if (dir === "l") {
          this.worldW = Math.max(MIN_W, this.worldW - delta);
        } else if (dir === "t") {
          this.worldH = Math.max(MIN_H, this.worldH - delta);
        }

        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
        // Reposition handles
        this.handleR.setPosition(this.worldW, this.worldH / 2);
        this.handleB.setPosition(this.worldW / 2, this.worldH);
        this.handleL.setPosition(0, this.worldH / 2);
        this.handleT.setPosition(this.worldW / 2, 0);
        this._drawGrid();
        this._drawResizeHandles();
        this.resizeCb?.(this.worldW, this.worldH);
      });
    }
  }

  setGhost(entities: Array<{ assetId: string; x: number; y: number; w?: number; h?: number }> | null): void {
    this.ghostEntities = entities;
    this._drawGhost();
  }

  private _drawGhost(): void {
    this.ghostGfx.clear();
    if (!this.ghostEntities) return;
    for (const e of this.ghostEntities) {
      const def = CATALOG_BY_ID[e.assetId];
      const w = e.w ?? def?.defaultWidth ?? 32;
      const h = e.h ?? def?.defaultHeight ?? 32;
      const wx = this.ghostX + e.x;
      const wy = this.ghostY + e.y;
      let color = 0x4444ff;
      if (def?.category === "enemy") color = 0xff4444;
      else if (def?.category === "platform") color = 0x44ff44;
      this.ghostGfx.fillStyle(color, 0.5);
      this.ghostGfx.fillRect(wx, wy, w, h);
      this.ghostGfx.lineStyle(1, color, 0.7);
      this.ghostGfx.strokeRect(wx, wy, w, h);
    }
  }

  private _drawGrid(): void {
    this.gridGfx.clear();
    // Minor grid
    this.gridGfx.lineStyle(1, 0x222233, 0.3);
    for (let x = 0; x <= this.worldW; x += SNAP) {
      this.gridGfx.lineBetween(x, 0, x, this.worldH);
    }
    for (let y = 0; y <= this.worldH; y += SNAP) {
      this.gridGfx.lineBetween(0, y, this.worldW, y);
    }
    // Major grid
    this.gridGfx.lineStyle(1, 0x333355, 0.5);
    for (let x = 0; x <= this.worldW; x += SNAP * 4) {
      this.gridGfx.lineBetween(x, 0, x, this.worldH);
    }
    for (let y = 0; y <= this.worldH; y += SNAP * 4) {
      this.gridGfx.lineBetween(0, y, this.worldW, y);
    }
  }
}
