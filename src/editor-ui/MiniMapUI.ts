import { emitEditorEvent, onEditorEvent } from "./EditorBridge";
import type { AssetCategory } from "../level/AssetCatalog";

interface MinimapEntity {
  x: number;
  y: number;
  w: number;
  h: number;
  category: AssetCategory;
}

const CATEGORY_COLORS: Record<string, string> = {
  background: "#8df5e8",
  platform: "#a6e3a1",
  decoration: "#f9e2af",
  enemy: "#fab387",
  spawn: "#cba6f7",
  hazard: "#f38ba8",
  system: "#f5c2e7",
};

export class MiniMapUI {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private worldW = 3000;
  private worldH = 900;
  private entities: Array<{ x: number; y: number; w: number; h: number; category: string }> = [];
  private camX = 0;
  private camY = 0;
  private camW = 1600;
  private camH = 900;
  private unsubs: Array<() => void> = [];

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) throw new Error(`MiniMapUI: #${canvasId} not found`);
    this.ctx = this.canvas.getContext("2d")!;

    // Click to teleport
    this.canvas.addEventListener("click", (e) => {
      if (!this.visible) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scaleX = this.worldW / this.canvas.width;
      const scaleY = this.worldH / this.canvas.height;
      const wx = mx * scaleX - this.camW / 2;
      const wy = my * scaleY - this.camH / 2;
      emitEditorEvent("camera-teleport", {
        x: Math.max(0, Math.min(wx, this.worldW - this.camW)),
        y: Math.max(0, Math.min(wy, this.worldH - this.camH)),
      });
    });

    // Listen for updates from EditorScene
    this.unsubs.push(
      onEditorEvent("minimap-update", (evt) => {
        const d = evt.detail;
        this.worldW = d.worldW;
        this.worldH = d.worldH;
        this.entities = d.entities;
        this.camX = d.camX;
        this.camY = d.camY;
        this.camW = d.camW;
        this.camH = d.camH;
        this.draw();
      })
    );

    // Listen for visibility from EditorScene
    this.unsubs.push(
      onEditorEvent("minimap-show", () => { this.visible = true; this.canvas.style.display = "block"; })
    );
    this.unsubs.push(
      onEditorEvent("minimap-hide", () => { this.visible = false; this.canvas.style.display = "none"; })
    );
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  // ─────────────────────────────────────────────────────────────────────────

  draw(): void {
    if (!this.visible) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = w / this.worldW;
    const sy = h / this.worldH;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // World border
    ctx.strokeStyle = "#45475a";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Entities (small dots)
    for (const e of this.entities) {
      const color = CATEGORY_COLORS[e.category] || "#888888";
      ctx.fillStyle = color;
      const mx = e.x * sx;
      const my = e.y * sy;
      const mw = Math.max(2, e.w * sx);
      const mh = Math.max(2, e.h * sy);
      ctx.fillRect(mx, my, mw, mh);
    }

    // Camera viewport
    ctx.strokeStyle = "rgba(255, 68, 68, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.camX * sx,
      this.camY * sy,
      this.camW * sx,
      this.camH * sy,
    );
  }
}
