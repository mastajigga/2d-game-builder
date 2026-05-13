import Phaser from "phaser";
import type { PlacedEntity } from "../level/LevelData";
import { CATALOG_BY_ID } from "../level/AssetCatalog";

const SNAP = 16;

export class PrefabBuilderCanvas {
  private game: Phaser.Game | null = null;
  private scene: BuilderScene | null = null;
  private container: HTMLElement;
  onContextMenu?: (entityIndex: number, screenX: number, screenY: number) => void;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`PrefabBuilderCanvas: #${containerId} not found`);
    this.container = el;
  }

  async init(): Promise<void> {
    if (this.game) this.game.destroy(true);
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.game = new Phaser.Game({
      type: Phaser.AUTO, width: w, height: h,
      parent: this.container,
      backgroundColor: "#1a1a1a",
      pixelArt: true, roundPixels: true, antialias: false,
      scene: BuilderScene,
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
    });

    return new Promise<void>((resolve) => {
      this.game!.events.once("ready", () => {
        this.scene = this.game!.scene.getScene("BuilderScene") as BuilderScene;
        this.scene.onContextMenu = (idx, sx, sy) => this.onContextMenu?.(idx, sx, sy);
        // Prevent browser native context menu on the canvas
        const canvas = this.game!.canvas;
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        resolve();
      });
    });
  }

  setAsset(assetId: string): void { this.scene?.setAsset(assetId); }
  getEntities(): PlacedEntity[] { return this.scene?.getEntities() ?? []; }
  renderEntities(ents: PlacedEntity[]): void { this.scene?.renderEntities(ents); }
  setCollisionMode(active: boolean): void { this.scene?.setCollisionMode(active); }
  placePrefabEntities(entities: Partial<PlacedEntity>[]): void { this.scene?.placePrefabEntities(entities); }
  getCollision() { return this.scene?.getCollision() ?? null; }
  rotateEntity(index: number, rotation: number): void { this.scene?.rotateEntity(index, rotation); }
  deleteEntity(index: number): void { this.scene?.deleteEntity(index); }
  flipEntity(index: number, xAxis: boolean): void { this.scene?.flipEntity(index, xAxis); }
  toggleMoveOnly(): void { this.scene?.toggleMoveOnly(); }
  isMoveOnly(): boolean { return this.scene?.moveOnly ?? false; }
  zoom(delta: number, reset = false): void { this.scene?.zoom(delta, reset); }

  destroy(): void {
    if (this.game) { this.game.destroy(true); this.game = null; this.scene = null; }
  }
}

// ─── Internal Scene ──────────────────────────────────────────────────────────

class BuilderScene extends Phaser.Scene {
  private entities: PlacedEntity[] = [];
  private entitySprites: Phaser.GameObjects.Sprite[] = [];
  private gridGfx!: Phaser.GameObjects.Graphics;
  private collGfx!: Phaser.GameObjects.Graphics;
  private ghostSprite: Phaser.GameObjects.Sprite | null = null;
  private ghostAssetId: string | null = null;
  private ghostLoading = false;
  private activeAsset: string | null = null;
  private collisionMode = false;
  private collBox = { x: 0, y: 0, w: 0, h: 0 };
  private collDragCorner: string | null = null;
  private ghostX = 0;
  private ghostY = 0;
  private draggingIndex: number | null = null;
  private dragOffX = 0;
  private dragOffY = 0;
  onContextMenu?: (entityIndex: number, screenX: number, screenY: number) => void;

  constructor() { super("BuilderScene"); }

  setAsset(id: string): void { this.activeAsset = id; }
  getEntities(): PlacedEntity[] { return [...this.entities]; }
  getCollision() { return this.collBox.w > 0 ? { ...this.collBox } : null; }
  setCollisionMode(active: boolean): void { this.collisionMode = active; this._drawCollision(); }
  moveOnly = false;
  toggleMoveOnly(): void { this.moveOnly = !this.moveOnly; }

  /** Place all entities of a custom prefab centered at the viewport. */
  placePrefabEntities(prefabEntities: Partial<PlacedEntity>[]): void {
    const cam = this.cameras.main;
    const vcx = Math.round((cam.scrollX + cam.width / cam.zoom / 2) / SNAP) * SNAP;
    const vcy = Math.round((cam.scrollY + cam.height / cam.zoom / 2) / SNAP) * SNAP;
    // Compute prefab bounding box to center it on viewport
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of prefabEntities) {
      const w = e.width ?? 32;
      const h = e.height ?? 32;
      if (e.x != null && e.y != null) {
        const left = (e.x ?? 0) - w/2;
        const top = (e.y ?? 0) - h;
        const right = (e.x ?? 0) + w/2;
        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if ((e.y ?? 0) > maxY) maxY = e.y ?? 0;
      }
    }
    const prefabW = maxX - minX;
    const prefabH = maxY - minY;
    // Offset so prefab visual center aligns with viewport center
    const cx = vcx - (minX + prefabW / 2);
    const cy = vcy - (minY + prefabH / 2);
    for (const e of prefabEntities) {
      this.entities.push({
        uid: "pfb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        assetId: e.assetId ?? "",
        x: cx + (e.x ?? 0),
        y: cy + (e.y ?? 0),
        scale: e.scale ?? 1,
        flipX: e.flipX ?? false,
        flipY: (e as any).flipY ?? false,
        rotation: e.rotation ?? 0,
        width: e.width,
        height: e.height,
      });
    }
    this._rebuildSprites();
  }

  renderEntities(ents: PlacedEntity[]): void {
    this.entities = ents;
    this._rebuildSprites();
  }

  rotateEntity(index: number, rotation: number): void {
    if (index >= 0 && index < this.entities.length) {
      this.entities[index].rotation = rotation;
      this._updateSprite(index);
    }
  }

  deleteEntity(index: number): void {
    if (index >= 0 && index < this.entities.length) {
      this.entities.splice(index, 1);
      this._rebuildSprites();
    }
  }

  flipEntity(index: number, xAxis: boolean): void {
    if (index >= 0 && index < this.entities.length) {
      const e = this.entities[index] as any;
      if (xAxis) e.flipX = !e.flipX;
      else e.flipY = !e.flipY;
      this._updateSprite(index);
    }
  }

  zoom(delta: number, reset = false): void {
    const cur = this.cameras.main.zoom;
    const target = reset ? 1 : Phaser.Math.Clamp(cur + delta, 0.25, 4);
    this.cameras.main.setZoom(target);
    // Update toolbar label
    const lbl = document.getElementById("pfb-zoom-label");
    if (lbl) lbl.textContent = Math.round(target * 100) + "%";
  }

  create(): void {
    this.gridGfx = this.add.graphics().setDepth(0);
    this.collGfx = this.add.graphics().setDepth(20);
    this._drawGrid();
    // Start at 50% zoom for a reasonable default scale
    this.cameras.main.setZoom(0.5);
    this.zoom(0, true); // sync label (force to 1? no, keep 0.5)
    // Manually set label to 50%
    const lbl = document.getElementById("pfb-zoom-label");
    if (lbl) lbl.textContent = "50%";

    // Left click: place, drag, or collision
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) return;
      const wx = Math.round((this.cameras.main.scrollX + p.x / this.cameras.main.zoom) / SNAP) * SNAP;
      const wy = Math.round((this.cameras.main.scrollY + p.y / this.cameras.main.zoom) / SNAP) * SNAP;

      if (this.collisionMode) {
        const corner = this._hitCollisionCorner(wx, wy);
        if (corner) { this.collDragCorner = corner; return; }
        this.collBox = { x: wx, y: wy, w: 0, h: 0 };
        this.collDragCorner = "br";
        return;
      }

      // Check if clicking on existing entity → start drag
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const def = CATALOG_BY_ID[e.assetId];
        const ew = e.width ?? def?.defaultWidth ?? 32;
        const eh = e.height ?? def?.defaultHeight ?? 32;
        // Entity coords: center-X, bottom-Y. Bounds: left=center-w/2, top=bottom-h
        if (wx >= e.x - ew/2 && wx <= e.x + ew/2 && wy >= e.y - eh && wy <= e.y) {
          this.draggingIndex = i;
          this.dragOffX = e.x - wx;
          this.dragOffY = e.y - wy;
          return;
        }
      }

      // Nothing hit → place new entity (unless in move-only mode)
      if (this.moveOnly) return;
      if (!this.activeAsset) return;
      const def = CATALOG_BY_ID[this.activeAsset];
      // Read scale from slider
      const scaleEl = document.getElementById("pfb-scale") as HTMLInputElement;
      const s = scaleEl ? parseFloat(scaleEl.value) : 0.5;
      const ew = (def?.defaultWidth ?? 32) * s;
      const eh = (def?.defaultHeight ?? 32) * s;
      this.entities.push({
        uid: "pfb" + Date.now().toString(36),
        assetId: this.activeAsset,
        x: wx, y: wy,   // center-X, bottom-Y (matching EntityManager origin)
        scale: s, flipX: false, rotation: 0,
        width: ew, height: eh,
      });
      this._rebuildSprites();
    });

    // Drag move
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const wx = Math.round((this.cameras.main.scrollX + p.x / this.cameras.main.zoom) / SNAP) * SNAP;
      const wy = Math.round((this.cameras.main.scrollY + p.y / this.cameras.main.zoom) / SNAP) * SNAP;

      // Ghost tracking
      this.ghostX = wx;
      this.ghostY = wy;
      this._drawGhost();

      // Entity dragging
      if (this.draggingIndex !== null && p.isDown) {
        const e = this.entities[this.draggingIndex];
        e.x = Math.round((wx + this.dragOffX) / SNAP) * SNAP;
        e.y = Math.round((wy + this.dragOffY) / SNAP) * SNAP;
        this._updateSprite(this.draggingIndex);
        return;
      }

      // Collision drag
      if (!p.isDown || !this.collDragCorner) return;
      if (this.collDragCorner === "br") {
        this.collBox.w = Math.max(16, wx - this.collBox.x);
        this.collBox.h = Math.max(16, wy - this.collBox.y);
      }
      this._drawCollision();
    });

    this.input.on("pointerup", () => { this.collDragCorner = null; this.draggingIndex = null; });

    // Right-click: context menu (prevent browser native menu)
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!p.rightButtonDown() || this.collisionMode) return;
      p.event?.preventDefault();
      const wx = Math.round((this.cameras.main.scrollX + p.x / this.cameras.main.zoom) / SNAP) * SNAP;
      const wy = Math.round((this.cameras.main.scrollY + p.y / this.cameras.main.zoom) / SNAP) * SNAP;
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const def = CATALOG_BY_ID[e.assetId];
        const ew = e.width ?? def?.defaultWidth ?? 32;
        const eh = e.height ?? def?.defaultHeight ?? 32;
        if (wx >= e.x - ew/2 && wx <= e.x + ew/2 && wy >= e.y - eh && wy <= e.y) {
          this.onContextMenu?.(i, p.x, p.y);
          return;
        }
      }
    });

    // Keyboard scroll + zoom
    const kb = this.input.keyboard!;
    kb.on("keydown-LEFT", () => this.cameras.main.scrollX = Math.max(0, this.cameras.main.scrollX - 64));
    kb.on("keydown-RIGHT", () => this.cameras.main.scrollX += 64);
    this.input.on("wheel", (_p: any, _gx: number[], _gy: number[], _gz: number[]) => {
      const d = Math.max(-1, Math.min(1, _gz?.[0] ?? _gy?.[0] ?? 0));
      const z = Phaser.Math.Clamp(this.cameras.main.zoom - d * 0.1, 0.25, 4);
      this.cameras.main.setZoom(z);
      const lbl = document.getElementById("pfb-zoom-label");
      if (lbl) lbl.textContent = Math.round(z * 100) + "%";
    });
  }

  // ── Sprite system ──────────────────────────────────────────────────────────

  private _rebuildSprites(): void {
    // Destroy all existing sprites
    for (const s of this.entitySprites) s.destroy();
    this.entitySprites = [];
    for (let i = 0; i < this.entities.length; i++) {
      this._createSprite(i);
    }
  }

  private _createSprite(index: number): void {
    const e = this.entities[index];
    const def = CATALOG_BY_ID[e.assetId];
    const w = e.width ?? def?.defaultWidth ?? 32;
    const h = e.height ?? def?.defaultHeight ?? 32;
    const texKey = "__ent_" + index + "_" + e.uid;
    // Use same origin convention as EntityManager so what-you-see matches placement
    const originX = def?.originX ?? 0.5;
    const originY = def?.originY ?? 1;

    // Show colored placeholder immediately
    let color = 0x5a7d3a;
    if (def?.category === "enemy") color = 0xcc4444;
    else if (def?.category === "spawn") color = 0x44cc44;
    else if (def?.category === "hazard") color = 0xcc8844;

    const spr = this.add.sprite(e.x, e.y, "__DEFAULT")
      .setDepth(10).setOrigin(originX, originY).setDisplaySize(w, h).setTint(color);
    this.entitySprites[index] = spr;

    // Load real texture asynchronously
    if (this.textures.exists(texKey)) {
      spr.setTexture(texKey).clearTint();
      return;
    }
    const imgPath = def?.imagePath ?? def?.sheetPath ?? `${def?.textureKey}.png`;
    const basePath = (window as any).__oakwoods_basePath ?? "";
    const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http") ? imgPath : `${basePath}/${imgPath}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d")!;
      const sf = def?.sourceFrame;
      ctx.drawImage(img, sf?.x ?? 0, sf?.y ?? 0, sf?.w ?? img.naturalWidth, sf?.h ?? img.naturalHeight, 0, 0, w, h);
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
      this.textures.addCanvas(texKey, cv);
      // Replace placeholder
      spr.setTexture(texKey).clearTint();
    };
    img.src = fullPath;
  }

  private _updateSprite(index: number): void {
    const e = this.entities[index];
    const spr = this.entitySprites[index];
    if (!spr) return;
    spr.setPosition(e.x, e.y);
    spr.setAngle(e.rotation ?? 0);
    spr.setFlipX(e.flipX ?? false);
    spr.setFlipY((e as any).flipY ?? false);
  }

  // ── Ghost ──────────────────────────────────────────────────────────────────

  private _drawGhost(): void {
    if (!this.activeAsset || this.moveOnly) {
      if (this.ghostSprite) { this.ghostSprite.setVisible(false); }
      this.ghostAssetId = null;
      return;
    }
    if (this.ghostAssetId !== this.activeAsset && !this.ghostLoading) {
      this.ghostAssetId = this.activeAsset;
      this.ghostLoading = true;
      this.ghostSprite?.destroy();
      this.ghostSprite = null;
      const def = CATALOG_BY_ID[this.activeAsset];
      const scaleEl = document.getElementById("pfb-scale") as HTMLInputElement;
      const s = scaleEl ? parseFloat(scaleEl.value) : 0.5;
      const w = (def?.defaultWidth ?? 32) * s;
      const h = (def?.defaultHeight ?? 32) * s;
      const originX = def?.originX ?? 0.5;
      const originY = def?.originY ?? 1;
      const texKey = "__ghost_" + this.activeAsset;
      this.ghostSprite = this.add.sprite(this.ghostX, this.ghostY, "__DEFAULT")
        .setDepth(5).setAlpha(0.5).setOrigin(originX, originY).setDisplaySize(w, h);
      const imgPath = def?.imagePath ?? def?.sheetPath ?? `${def?.textureKey}.png`;
      const basePath = (window as any).__oakwoods_basePath ?? "";
      const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http") ? imgPath : `${basePath}/${imgPath}`;
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d")!;
        const sf = def?.sourceFrame;
        ctx.drawImage(img, sf?.x ?? 0, sf?.y ?? 0, sf?.w ?? img.naturalWidth, sf?.h ?? img.naturalHeight, 0, 0, w, h);
        if (this.textures.exists(texKey)) this.textures.remove(texKey);
        this.textures.addCanvas(texKey, cv);
        if (this.ghostSprite) this.ghostSprite.destroy();
        this.ghostSprite = this.add.sprite(this.ghostX, this.ghostY, texKey)
          .setDepth(5).setAlpha(0.5).setOrigin(originX, originY);
        this.ghostLoading = false;
      };
      img.onerror = () => { this.ghostLoading = false; };
      img.src = fullPath;
    }
    if (this.ghostSprite) {
      this.ghostSprite.setPosition(this.ghostX, this.ghostY).setVisible(true);
    }
  }

  // ── Collision ──────────────────────────────────────────────────────────────

  private _drawCollision(): void {
    this.collGfx.clear();
    if (this.collBox.w <= 0) return;
    this.collGfx.lineStyle(2, 0x4488ff, 0.8);
    this.collGfx.strokeRect(this.collBox.x, this.collBox.y, this.collBox.w, this.collBox.h);
    this.collGfx.fillStyle(0x4488ff, 0.1);
    this.collGfx.fillRect(this.collBox.x, this.collBox.y, this.collBox.w, this.collBox.h);
    this.collGfx.fillStyle(0xffffff, 1);
    this.collGfx.fillRect(this.collBox.x - 3, this.collBox.y - 3, 6, 6);
    this.collGfx.fillRect(this.collBox.x + this.collBox.w - 3, this.collBox.y + this.collBox.h - 3, 6, 6);
  }

  private _hitCollisionCorner(wx: number, wy: number): string | null {
    if (this.collBox.w <= 0) return null;
    if (Math.abs(wx - this.collBox.x) < 8 && Math.abs(wy - this.collBox.y) < 8) return "tl";
    if (Math.abs(wx - this.collBox.x - this.collBox.w) < 8 && Math.abs(wy - this.collBox.y - this.collBox.h) < 8) return "br";
    return null;
  }

  // ── Grid ───────────────────────────────────────────────────────────────────

  private _drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x222233, 0.3);
    for (let x = 0; x <= 3200; x += SNAP) this.gridGfx.lineBetween(x, 0, x, 1600);
    for (let y = 0; y <= 1600; y += SNAP) this.gridGfx.lineBetween(0, y, 3200, y);
    this.gridGfx.lineStyle(1, 0x333355, 0.5);
    for (let x = 0; x <= 3200; x += SNAP * 4) this.gridGfx.lineBetween(x, 0, x, 1600);
    for (let y = 0; y <= 1600; y += SNAP * 4) this.gridGfx.lineBetween(0, y, 3200, y);
  }
}
