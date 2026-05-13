// src/editor-ui/HitboxEditor.ts
// Hitbox/hurtbox overlay per-frame — visual editing, drag handles, JSON export

export interface HitboxData {
  attackBox?: { x: number; y: number; w: number; h: number };
  hurtBox?: { x: number; y: number; w: number; h: number };
}

export interface HitboxFrameData {
  frameIndex: number;
  attackBox?: { x: number; y: number; w: number; h: number };
  hurtBox?: { x: number; y: number; w: number; h: number };
}

// ── Draggable handle ──────────────────────────────────────────
interface DragHandle {
  boxKey: "attackBox" | "hurtBox";
  corner: "tl" | "tr" | "bl" | "br" | "move";
  frameIndex: number;
}

export class HitboxEditor {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private sheetImg: HTMLImageElement | null = null;
  private frameW = 0;
  private frameH = 0;
  private framesPerRow = 4;
  private hitboxes: Map<number, HitboxData> = new Map();
  private currentFrame = 0;
  private visible = true;
  private onChange: (hitboxes: HitboxFrameData[]) => void;

  private dragHandle: DragHandle | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartBox: { x: number; y: number; w: number; h: number } | null = null;

  private HITBOX_COLORS = {
    attackBox: "#ff4444",
    hurtBox: "#4488ff",
  };

  private HANDLE_SIZE = 6;

  constructor(parent: HTMLElement, onChange: (hitboxes: HitboxFrameData[]) => void) {
    this.container = parent;
    this.onChange = onChange;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "hitbox-overlay-canvas";
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "auto";
    this.container.appendChild(this.canvas);
    this._bindEvents();
  }

  setSheet(img: HTMLImageElement, fw: number, fh: number, fpr: number): void {
    this.sheetImg = img;
    this.frameW = fw;
    this.frameH = fh;
    this.framesPerRow = fpr;
    this._resize();
    this.draw();
  }

  setFrame(frame: number): void {
    this.currentFrame = frame;
    this.draw();
  }

  setHitboxes(data: HitboxFrameData[]): void {
    this.hitboxes.clear();
    for (const h of data) {
      const hd: HitboxData = {};
      if (h.attackBox) hd.attackBox = { ...h.attackBox };
      if (h.hurtBox) hd.hurtBox = { ...h.hurtBox };
      this.hitboxes.set(h.frameIndex, hd);
    }
    this.draw();
  }

  getHitboxes(): HitboxFrameData[] {
    const out: HitboxFrameData[] = [];
    for (const [fi, hd] of this.hitboxes) {
      const entry: HitboxFrameData = { frameIndex: fi };
      if (hd.attackBox) entry.attackBox = { ...hd.attackBox };
      if (hd.hurtBox) entry.hurtBox = { ...hd.hurtBox };
      out.push(entry);
    }
    return out;
  }

  show(): void {
    this.visible = true;
    if (this.canvas) this.canvas.style.display = "block";
  }

  hide(): void {
    this.visible = false;
    if (this.canvas) this.canvas.style.display = "none";
  }

  isVisible(): boolean { return this.visible; }

  destroy(): void {
    if (this.canvas) { this.canvas.remove(); this.canvas = null; }
  }

  // ── Draw ────────────────────────────────────────────────────

  draw(): void {
    if (!this.canvas || !this.sheetImg) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const hd = this.hitboxes.get(this.currentFrame);
    if (!hd) return;

    const drawBox = (box: { x: number; y: number; w: number; h: number } | undefined, color: string, label: string, isAttack: boolean) => {
      if (!box) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = color + "20";
      ctx.fillRect(box.x, box.y, box.w, box.h);

      // Label
      ctx.fillStyle = color;
      ctx.font = "9px var(--font)";
      ctx.fillText(label, box.x + 2, box.y + 10);

      // Corner handles
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x, y: box.y + box.h },
        { x: box.x + box.w, y: box.y + box.h },
      ];
      for (const c of corners) {
        ctx.fillStyle = color;
        ctx.fillRect(c.x - this.HANDLE_SIZE / 2, c.y - this.HANDLE_SIZE / 2, this.HANDLE_SIZE, this.HANDLE_SIZE);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x - this.HANDLE_SIZE / 2, c.y - this.HANDLE_SIZE / 2, this.HANDLE_SIZE, this.HANDLE_SIZE);
      }

      // Center move handle
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      ctx.fillStyle = "#ffffff40";
      ctx.fillRect(cx - 4, cy - 4, 8, 8);
      ctx.strokeStyle = color;
      ctx.strokeRect(cx - 4, cy - 4, 8, 8);
    };

    drawBox(hd.attackBox, this.HITBOX_COLORS.attackBox, "ATK", true);
    drawBox(hd.hurtBox, this.HITBOX_COLORS.hurtBox, "HURT", false);
  }

  // ── Events ──────────────────────────────────────────────────

  private _bindEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener("mousedown", (e: MouseEvent) => this._onPointerDown(e));
    document.addEventListener("mousemove", (e: MouseEvent) => this._onPointerMove(e));
    document.addEventListener("mouseup", () => this._onPointerUp());
  }

  private _onPointerDown(e: MouseEvent): void {
    if (!this.canvas || !this.visible) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hd = this.hitboxes.get(this.currentFrame);
    if (!hd) {
      // Create a new hurtbox by default (click on empty space)
      this.hitboxes.set(this.currentFrame, {
        hurtBox: { x: 4, y: 4, w: this.frameW - 8, h: this.frameH - 8 },
      });
      this._emitChange();
      this.draw();
      return;
    }

    // Check corners first, then center, then edges
    const checkBox = (key: "attackBox" | "hurtBox", box: { x: number; y: number; w: number; h: number }) => {
      const corners: { corner: "tl" | "tr" | "bl" | "br"; cx: number; cy: number }[] = [
        { corner: "tl", cx: box.x, cy: box.y },
        { corner: "tr", cx: box.x + box.w, cy: box.y },
        { corner: "bl", cx: box.x, cy: box.y + box.h },
        { corner: "br", cx: box.x + box.w, cy: box.y + box.h },
      ];
      const hs2 = this.HANDLE_SIZE * 2;
      for (const c of corners) {
        if (Math.abs(mx - c.cx) < hs2 && Math.abs(my - c.cy) < hs2) {
          this.dragHandle = { boxKey: key, corner: c.corner, frameIndex: this.currentFrame };
          this.dragStartX = mx;
          this.dragStartY = my;
          this.dragStartBox = { ...box };
          return true;
        }
      }
      // Center move handle
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      if (Math.abs(mx - cx) < 8 && Math.abs(my - cy) < 8) {
        this.dragHandle = { boxKey: key, corner: "move", frameIndex: this.currentFrame };
        this.dragStartX = mx;
        this.dragStartY = my;
        this.dragStartBox = { ...box };
        return true;
      }
      // Inside the box
      if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
        this.dragHandle = { boxKey: key, corner: "move", frameIndex: this.currentFrame };
        this.dragStartX = mx;
        this.dragStartY = my;
        this.dragStartBox = { ...box };
        return true;
      }
      return false;
    };

    if (hd.attackBox && checkBox("attackBox", hd.attackBox)) return;
    if (hd.hurtBox && checkBox("hurtBox", hd.hurtBox)) return;

    // Clicked empty: add attack box if none, else hurtbox
    if (!hd.attackBox) {
      hd.attackBox = { x: 6, y: 0, w: this.frameW - 12, h: Math.floor(this.frameH * 0.5) };
    } else if (!hd.hurtBox) {
      hd.hurtBox = { x: 2, y: 2, w: this.frameW - 4, h: this.frameH - 4 };
    }
    this._emitChange();
    this.draw();
  }

  private _onPointerMove(e: MouseEvent): void {
    if (!this.dragHandle || !this.canvas || !this.dragStartBox) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - this.dragStartX;
    const dy = my - this.dragStartY;

    const hd = this.hitboxes.get(this.dragHandle.frameIndex);
    if (!hd) return;

    const boxKey = this.dragHandle.boxKey;
    const orig = this.dragStartBox;
    let box = hd[boxKey];
    if (!box) return;

    switch (this.dragHandle.corner) {
      case "tl":
        box.x = Math.max(0, orig.x + dx);
        box.y = Math.max(0, orig.y + dy);
        box.w = Math.max(4, orig.w - dx);
        box.h = Math.max(4, orig.h - dy);
        break;
      case "tr":
        box.y = Math.max(0, orig.y + dy);
        box.w = Math.max(4, orig.w + dx);
        box.h = Math.max(4, orig.h - dy);
        break;
      case "bl":
        box.x = Math.max(0, orig.x + dx);
        box.w = Math.max(4, orig.w - dx);
        box.h = Math.max(4, orig.h + dy);
        break;
      case "br":
        box.w = Math.max(4, orig.w + dx);
        box.h = Math.max(4, orig.h + dy);
        break;
      case "move":
        box.x = Math.max(0, Math.min(this.frameW - box.w, orig.x + dx));
        box.y = Math.max(0, Math.min(this.frameH - box.h, orig.y + dy));
        break;
    }
    this._emitChange();
    this.draw();
  }

  private _onPointerUp(): void {
    this.dragHandle = null;
    this.dragStartBox = null;
  }

  // ── Resize ──────────────────────────────────────────────────

  private _resize(): void {
    if (!this.canvas) return;
    this.canvas.width = this.frameW;
    this.canvas.height = this.frameH;
  }

  private _emitChange(): void {
    this.onChange(this.getHitboxes());
  }
}
