import Phaser from "phaser";
import { PlacedView } from "./EntityManager";
import { CATALOG_BY_ID } from "../level/AssetCatalog";

export class CollisionEditor {
  private scene: Phaser.Scene;
  private gfx!: Phaser.GameObjects.Graphics;
  private activeView: PlacedView | null = null;
  private draggingCorner: "tl" | "tr" | "bl" | "br" | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private snap = 16;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics().setDepth(60);
  }

  setActive(view: PlacedView | null): void {
    this.activeView = view;
  }

  isActive(): boolean { return this.activeView !== null; }

  getDraggingCorner(): string | null { return this.draggingCorner; }

  startDragCorner(corner: "tl" | "tr" | "bl" | "br", x: number, y: number): void {
    this.draggingCorner = corner;
    this.dragStartX = x;
    this.dragStartY = y;
  }

  stopDrag(): void {
    this.draggingCorner = null;
  }

  updateDrag(wx: number, wy: number): void {
    if (!this.activeView || !this.draggingCorner) return;
    const d = this.activeView.data;
    if (!d.collision) {
      d.collision = { enabled: true, x: 0, y: 0, width: d.width ?? 64, height: d.height ?? 64 };
    }

    const swx = Math.round(wx / this.snap) * this.snap;
    const swy = Math.round(wy / this.snap) * this.snap;

    const absX = d.x + d.collision.x;
    const absY = d.y + d.collision.y;
    const absR = absX + d.collision.width;
    const absB = absY + d.collision.height;

    if (this.draggingCorner === "tl") {
      d.collision.x = swx - d.x;
      d.collision.y = swy - d.y;
      d.collision.width = absR - swx;
      d.collision.height = absB - swy;
    } else if (this.draggingCorner === "tr") {
      d.collision.y = swy - d.y;
      d.collision.width = swx - absX;
      d.collision.height = absB - swy;
    } else if (this.draggingCorner === "bl") {
      d.collision.x = swx - d.x;
      d.collision.width = absR - swx;
      d.collision.height = swy - absY;
    } else if (this.draggingCorner === "br") {
      d.collision.width = swx - absX;
      d.collision.height = swy - absY;
    }

    // Clamp min size
    if (d.collision.width < this.snap) d.collision.width = this.snap;
    if (d.collision.height < this.snap) d.collision.height = this.snap;
  }

  draw(): void {
    this.gfx.clear();
    if (!this.activeView) return;
    const d = this.activeView.data;
    if (!d.collision) {
      // Show default suggestion
      const def = CATALOG_BY_ID[d.assetId];
      const b = this.activeView.obj.getBounds();
      this.gfx.lineStyle(2, 0x888888, 0.4);
      this.gfx.strokeRect(b.x, b.y, b.width, b.height);
      this.gfx.fillStyle(0x888888, 0.1);
      this.gfx.fillRect(b.x, b.y, b.width, b.height);
      return;
    }

    const cx = d.x + d.collision.x;
    const cy = d.y + d.collision.y;
    const cw = d.collision.width;
    const ch = d.collision.height;

    const color = d.collision.enabled ? 0x44ff44 : 0xff4444;
    this.gfx.lineStyle(2, color, 0.8);
    this.gfx.strokeRect(cx, cy, cw, ch);
    this.gfx.fillStyle(color, 0.15);
    this.gfx.fillRect(cx, cy, cw, ch);

    // Corners
    const corners = [
      { x: cx, y: cy, key: "tl" },
      { x: cx + cw, y: cy, key: "tr" },
      { x: cx, y: cy + ch, key: "bl" },
      { x: cx + cw, y: cy + ch, key: "br" },
    ];
    for (const c of corners) {
      this.gfx.fillStyle(0xffffff, 0.9);
      this.gfx.fillCircle(c.x, c.y, 5);
    }
  }

  hitCorner(wx: number, wy: number): "tl" | "tr" | "bl" | "br" | null {
    if (!this.activeView || !this.activeView.data.collision) return null;
    const d = this.activeView.data;
    const coll = d.collision!;
    const cx = d.x + coll.x;
    const cy = d.y + coll.y;
    const cw = coll.width;
    const ch = coll.height;
    const corners: Array<{ x: number; y: number; key: "tl" | "tr" | "bl" | "br" }> = [
      { x: cx, y: cy, key: "tl" },
      { x: cx + cw, y: cy, key: "tr" },
      { x: cx, y: cy + ch, key: "bl" },
      { x: cx + cw, y: cy + ch, key: "br" },
    ];
    for (const c of corners) {
      if (Math.hypot(c.x - wx, c.y - wy) < 12) return c.key;
    }
    return null;
  }

  toggleEnabled(): boolean {
    if (!this.activeView) return false;
    const d = this.activeView.data;
    if (!d.collision) {
      d.collision = { enabled: true, x: 0, y: 0, width: d.width ?? 64, height: d.height ?? 64 };
    } else {
      d.collision.enabled = !d.collision.enabled;
    }
    return d.collision.enabled;
  }
}
