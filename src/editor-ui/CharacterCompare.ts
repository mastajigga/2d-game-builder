// src/editor-ui/CharacterCompare.ts
// Multi-character compare — 2 characters side-by-side for animation comparison

import { getFullCatalog } from "../level/AssetCatalog";

interface CompareSlot {
  assetId: string;
  currentFrame: number;
  currentState: string;
  zoom: number;
  isPlaying: boolean;
  playInterval: number | null;
  sheetImg: HTMLImageElement | null;
  sheetLoaded: boolean;
  canvas: HTMLCanvasElement;
}

export class CharacterCompareView {
  private container: HTMLElement;
  private slots: CompareSlot[] = [];
  private maxSlots = 2;
  private onClose: () => void;
  private synced = true; // sync animation between slots

  constructor(parent: HTMLElement, onClose: () => void) {
    this.container = parent;
    this.onClose = onClose;
    this._build();
  }

  show(): void {
    this.container.style.display = "flex";
  }

  hide(): void {
    this.container.style.display = "none";
    // Stop all animations
    for (const slot of this.slots) {
      this._stopSlot(slot);
    }
  }

  isVisible(): boolean { return this.container.style.display !== "none"; }

  // ── Build ───────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = "";
    this.container.style.display = "none";
    this.container.className = "compare-container";

    // Header
    const header = document.createElement("div");
    header.className = "compare-header";
    header.innerHTML = `<h3>🔄 Comparaison de personnages</h3>`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "page-close-btn";
    closeBtn.textContent = "✕ Fermer";
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);

    const syncToggle = document.createElement("button");
    syncToggle.className = "prop-btn-toggle on";
    syncToggle.textContent = "Synchro";
    syncToggle.addEventListener("click", () => {
      this.synced = !this.synced;
      syncToggle.classList.toggle("on", this.synced);
      syncToggle.classList.toggle("off", !this.synced);
    });
    header.appendChild(syncToggle);

    this.container.appendChild(header);

    // Two slot panels
    const panels = document.createElement("div");
    panels.className = "compare-panels";

    for (let i = 0; i < this.maxSlots; i++) {
      const panel = document.createElement("div");
      panel.className = "compare-panel";

      // Slot header: asset selector + controls
      const slotHeader = document.createElement("div");
      slotHeader.className = "compare-slot-header";

      const label = document.createElement("span");
      label.textContent = `Personnage ${i + 1}`;
      label.className = "compare-slot-label";
      slotHeader.appendChild(label);

      const select = document.createElement("select");
      select.className = "prop-input-text compare-asset-select";
      select.style.width = "180px";
      const spritesheets = getFullCatalog().filter(
        (a) => a.sheetPath && (a.category === "enemy" || a.category === "spawn")
      );
      for (const asset of spritesheets) {
        const opt = document.createElement("option");
        opt.value = asset.id;
        opt.textContent = asset.label;
        select.appendChild(opt);
      }
      if (spritesheets[i]) select.value = spritesheets[i].id;
      select.addEventListener("change", () => {
        const slot = this.slots[i];
        slot.assetId = select.value;
        this._loadSlot(slot);
      });
      slotHeader.appendChild(select);

      panel.appendChild(slotHeader);

      // Canvas preview
      const canvas = document.createElement("canvas");
      canvas.className = "compare-canvas";
      panel.appendChild(canvas);

      // Controls
      const controls = document.createElement("div");
      controls.className = "compare-controls";

      const playBtn = document.createElement("button");
      playBtn.className = "panel-btn primary";
      playBtn.textContent = "▶ Play";
      playBtn.addEventListener("click", () => this._toggleSlot(i));
      controls.appendChild(playBtn);

      const zoomLabel = document.createElement("label");
      zoomLabel.textContent = "Zoom:";
      controls.appendChild(zoomLabel);

      const zoomSlider = document.createElement("input");
      zoomSlider.type = "range";
      zoomSlider.min = "1";
      zoomSlider.max = "8";
      zoomSlider.step = "1";
      zoomSlider.value = "3";
      zoomSlider.style.width = "80px";
      zoomSlider.addEventListener("input", () => {
        for (const s of this.slots) s.zoom = parseInt(zoomSlider.value);
        for (const s of this.slots) this._drawSlot(s);
      });
      controls.appendChild(zoomSlider);

      panel.appendChild(controls);

      panels.appendChild(panel);

      // Init slot data
      this.slots.push({
        assetId: spritesheets[i]?.id ?? "",
        currentFrame: 0,
        currentState: "idle",
        zoom: 3,
        isPlaying: false,
        playInterval: null,
        sheetImg: null,
        sheetLoaded: false,
        canvas,
      });
    }

    this.container.appendChild(panels);

    // Load initial assets
    for (const slot of this.slots) {
      if (slot.assetId) this._loadSlot(slot);
    }
  }

  // ── Slot management ─────────────────────────────────────────

  private _loadSlot(slot: CompareSlot): void {
    slot.sheetLoaded = false;
    const asset = getFullCatalog().find((a) => a.id === slot.assetId);
    if (!asset) return;

    const basePath = (window as any).__oakwoods_basePath ?? "";
    const imgPath = asset.imagePath ?? asset.sheetPath ?? `${asset.textureKey}.png`;
    const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http")
      ? imgPath : `${basePath}/${imgPath}`;

    slot.sheetImg = new Image();
    slot.sheetImg.crossOrigin = "anonymous";
    slot.sheetImg.onload = () => {
      slot.sheetLoaded = true;
      this._drawSlot(slot);
    };
    slot.sheetImg.src = fullPath;
  }

  private _drawSlot(slot: CompareSlot): void {
    if (!slot.sheetLoaded || !slot.sheetImg) return;
    const asset = getFullCatalog().find((a) => a.id === slot.assetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const fpr = Math.max(1, Math.floor(slot.sheetImg.naturalWidth / fw));

    slot.canvas.width = fw;
    slot.canvas.height = fh;
    slot.canvas.style.width = `${fw * slot.zoom}px`;
    slot.canvas.style.height = `${fh * slot.zoom}px`;

    const ctx = slot.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, fw, fh);

    const sx = (slot.currentFrame % fpr) * fw;
    const sy = Math.floor(slot.currentFrame / fpr) * fh;
    ctx.drawImage(slot.sheetImg, sx, sy, fw, fh, 0, 0, fw, fh);
  }

  private _toggleSlot(index: number): void {
    const slot = this.slots[index];
    if (slot.isPlaying) {
      this._stopSlot(slot);
    } else {
      if (this.synced) {
        // Stop all, then start all
        for (const s of this.slots) this._stopSlot(s);
        for (const s of this.slots) this._startSlot(s);
      } else {
        this._startSlot(slot);
      }
    }
  }

  private _startSlot(slot: CompareSlot): void {
    slot.isPlaying = true;
    const asset = getFullCatalog().find((a) => a.id === slot.assetId);
    if (!asset?.totalFrames) return;

    const maxFrame = asset.totalFrames - 1;
    const fps = 10;
    const interval = Math.round(1000 / fps);

    slot.playInterval = window.setInterval(() => {
      slot.currentFrame++;
      if (slot.currentFrame > maxFrame) slot.currentFrame = 0;
      this._drawSlot(slot);
    }, interval);
  }

  private _stopSlot(slot: CompareSlot): void {
    slot.isPlaying = false;
    if (slot.playInterval !== null) {
      clearInterval(slot.playInterval);
      slot.playInterval = null;
    }
  }

  destroy(): void {
    for (const slot of this.slots) this._stopSlot(slot);
    this.container.innerHTML = "";
  }
}
