// ══════════════════════════════════════════════════════════════════════════════
// SpriteEditorUI — Éditeur de sprites intégré (style MS Paint)
// ══════════════════════════════════════════════════════════════════════════════

import {
  type ToolKind,
  type PixelRGBA,
  getImageData,
  putImageData,
  getPixel,
  brushStroke,
  floodFill,
  drawRect,
  drawCircle,
  drawLine,
  copyRegion,
  pasteRegion,
} from "./SpriteEditorTools";

// Palette EGA 16 couleurs
const EGA_PALETTE: string[] = [
  "#000000", "#0000aa", "#00aa00", "#00aaaa",
  "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
  "#555555", "#5555ff", "#55ff55", "#55ffff",
  "#ff5555", "#ff55ff", "#ffff55", "#ffffff",
];

const MAX_UNDO = 50;

export interface SpriteEditorOptions {
  /** Image source (base64 ou URL) à charger. Null = canvas vide. */
  sourceImage: string | null;
  /** Taille du frame (largeur, hauteur). */
  frameW: number;
  frameH: number;
  /** Callback quand l'utilisateur sauvegarde le frame. Reçoit le dataURL. */
  onSave: (dataUrl: string) => void;
  /** Callback pour fermer l'éditeur. */
  onClose: () => void;
}

export class SpriteEditorUI {
  private opts: SpriteEditorOptions;
  private overlay: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private previewCanvas!: HTMLCanvasElement;
  private previewCtx!: CanvasRenderingContext2D;

  // Undo/redo
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];

  // Tools
  private currentTool: ToolKind = "brush";
  private brushSize = 1;
  private currentColor: PixelRGBA = hexToRGBA("#000000");
  private fillMode = false; // true = fill, false = outline (pour rect/circle)
  private snapMode = false; // shift pour ligne

  // Selection
  private selectStartX = 0;
  private selectStartY = 0;
  private selectEndX = 0;
  private selectEndY = 0;
  private selecting = false;
  private selectedRegion: ImageData | null = null;
  private selectOffsetX = 0;
  private selectOffsetY = 0;
  private movingSelection = false;

  // Color history
  private colorHistory: string[] = [];

  // Zoom
  private zoom = 2;

  // Grid
  private showGrid = true;

  // Drawing state
  private drawing = false;
  private lineStartX = 0;
  private lineStartY = 0;

  constructor(opts: SpriteEditorOptions) {
    this.opts = opts;
    this.overlay = document.createElement("div");
    this.overlay.className = "sprite-editor-overlay";
    this._build();
    this._loadSourceImage();
  }

  // ──────── Public API ────────

  /** Montre l'éditeur. */
  show(): void {
    document.body.appendChild(this.overlay);
    this._pushUndo();
  }

  /** Ferme l'éditeur. */
  hide(): void {
    this.overlay.remove();
  }

  // ──────── Build UI ────────

  private _build(): void {
    // ── Toolbar ────────────────────────────────────────────────────
    const toolbar = document.createElement("div");
    toolbar.className = "se-toolbar";

    // Tools
    const tools: { kind: ToolKind; icon: string; title: string }[] = [
      { kind: "brush", icon: "✏️", title: "Pinceau (B)" },
      { kind: "eraser", icon: "🧹", title: "Gomme (E)" },
      { kind: "fill", icon: "🪣", title: "Pot de peinture (G)" },
      { kind: "eyedropper", icon: "💉", title: "Pipette (I)" },
      { kind: "rect", icon: "⬜", title: "Rectangle (R)" },
      { kind: "circle", icon: "⭕", title: "Cercle (C)" },
      { kind: "line", icon: "📏", title: "Ligne (L)" },
      { kind: "select", icon: "🔲", title: "Sélection (S)" },
    ];

    const toolGroup = document.createElement("div");
    toolGroup.className = "se-tool-group";
    for (const t of tools) {
      const btn = document.createElement("button");
      btn.className = "se-tool-btn";
      if (t.kind === this.currentTool) btn.classList.add("active");
      btn.title = t.title;
      btn.textContent = t.icon;
      btn.addEventListener("click", () => {
        this.currentTool = t.kind;
        toolGroup.querySelectorAll(".se-tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this._exitSelection();
      });
      toolGroup.appendChild(btn);
    }
    toolbar.appendChild(toolGroup);

    // Separator
    const sep = document.createElement("div");
    sep.className = "se-sep";
    toolbar.appendChild(sep);

    // Fill toggle (for rect/circle)
    const fillBtn = document.createElement("button");
    fillBtn.className = "se-tool-btn";
    fillBtn.title = "Remplir / Contour";
    fillBtn.textContent = this.fillMode ? "◼" : "◻";
    fillBtn.addEventListener("click", () => {
      this.fillMode = !this.fillMode;
      fillBtn.textContent = this.fillMode ? "◼" : "◻";
    });
    toolbar.appendChild(fillBtn);

    // Brush size
    const sizeLbl = document.createElement("span");
    sizeLbl.className = "se-label";
    sizeLbl.textContent = "Taille:";
    toolbar.appendChild(sizeLbl);

    const sizeInput = document.createElement("input");
    sizeInput.type = "range";
    sizeInput.min = "1";
    sizeInput.max = "8";
    sizeInput.value = String(this.brushSize);
    sizeInput.style.width = "60px";
    sizeInput.addEventListener("input", () => {
      this.brushSize = parseInt(sizeInput.value);
    });
    toolbar.appendChild(sizeInput);

    // Grid toggle
    const gridBtn = document.createElement("button");
    gridBtn.className = "se-tool-btn active";
    gridBtn.title = "Grille";
    gridBtn.textContent = "📐";
    gridBtn.addEventListener("click", () => {
      this.showGrid = !this.showGrid;
      gridBtn.classList.toggle("active", this.showGrid);
      this._redrawPreview();
    });
    toolbar.appendChild(gridBtn);

    // Zoom
    const zoomLbl = document.createElement("span");
    zoomLbl.className = "se-label";
    zoomLbl.textContent = "Zoom:";
    toolbar.appendChild(zoomLbl);

    const zoomInput = document.createElement("input");
    zoomInput.type = "range";
    zoomInput.min = "1";
    zoomInput.max = "8";
    zoomInput.value = String(this.zoom);
    zoomInput.style.width = "60px";
    zoomInput.addEventListener("input", () => {
      this.zoom = parseInt(zoomInput.value);
      this._applyZoom();
    });
    toolbar.appendChild(zoomInput);

    const zoomVal = document.createElement("span");
    zoomVal.className = "se-label";
    zoomVal.textContent = `${this.zoom}x`;
    zoomInput.addEventListener("input", () => { zoomVal.textContent = `${zoomInput.value}x`; });
    toolbar.appendChild(zoomVal);

    this.overlay.appendChild(toolbar);

    // ── Main area ──────────────────────────────────────────────────
    const main = document.createElement("div");
    main.className = "se-main";

    // Canvas d'édition (enveloppé pour le zoom)
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "se-canvas-wrap";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "se-canvas";
    this.canvas.width = this.opts.frameW;
    this.canvas.height = this.opts.frameH;
    this.ctx = this.canvas.getContext("2d")!;

    // Canvas de preview (zoomé, avec grille)
    this.previewCanvas = document.createElement("canvas");
    this.previewCanvas.className = "se-preview-canvas";
    canvasWrap.appendChild(this.previewCanvas);

    this._setupCanvasEvents(canvasWrap);
    main.appendChild(canvasWrap);

    // Sidebar: palette + historique
    const sidebar = document.createElement("div");
    sidebar.className = "se-sidebar";

    sidebar.appendChild(this._buildPalette());
    sidebar.appendChild(this._buildColorHistory());

    main.appendChild(sidebar);
    this.overlay.appendChild(main);

    // ── Footer ─────────────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "se-footer";

    const undoBtn = document.createElement("button");
    undoBtn.className = "panel-btn";
    undoBtn.textContent = "↩ Undo";
    undoBtn.addEventListener("click", () => this._undo());
    footer.appendChild(undoBtn);

    const redoBtn = document.createElement("button");
    redoBtn.className = "panel-btn";
    redoBtn.textContent = "↪ Redo";
    redoBtn.addEventListener("click", () => this._redo());
    footer.appendChild(redoBtn);

    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    footer.appendChild(spacer);

    const saveBtn = document.createElement("button");
    saveBtn.className = "panel-btn primary";
    saveBtn.textContent = "💾 Sauver la frame";
    saveBtn.addEventListener("click", () => {
      this.opts.onSave(this.canvas.toDataURL("image/png"));
    });
    footer.appendChild(saveBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className = "panel-btn";
    exportBtn.textContent = "📥 Exporter PNG";
    exportBtn.addEventListener("click", () => this._exportPNG());
    footer.appendChild(exportBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "panel-btn danger";
    closeBtn.textContent = "✕ Fermer";
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.opts.onClose();
    });
    footer.appendChild(closeBtn);

    this.overlay.appendChild(footer);

    // Keyboard shortcuts
    this.overlay.addEventListener("keydown", (e) => this._onKeyDown(e));
    this.overlay.tabIndex = 0;
    this.overlay.focus();
  }

  private _buildPalette(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "se-palette";

    const title = document.createElement("h4");
    title.textContent = "Palette";
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "se-palette-grid";

    for (const hex of EGA_PALETTE) {
      const swatch = document.createElement("div");
      swatch.className = "se-swatch";
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatch.addEventListener("click", () => this._setColor(hex));
      grid.appendChild(swatch);
    }
    wrap.appendChild(grid);

    // Custom color
    const customRow = document.createElement("div");
    customRow.className = "se-custom-color";

    const customInput = document.createElement("input");
    customInput.type = "color";
    customInput.value = "#000000";
    customInput.className = "se-color-input";
    customInput.addEventListener("input", () => this._setColor(customInput.value));
    customRow.appendChild(customInput);

    const customLbl = document.createElement("span");
    customLbl.textContent = "Custom";
    customLbl.className = "se-label";
    customRow.appendChild(customLbl);

    wrap.appendChild(customRow);
    return wrap;
  }

  private _buildColorHistory(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "se-color-history";

    const title = document.createElement("h4");
    title.textContent = "Récentes";
    wrap.appendChild(title);

    const list = document.createElement("div");
    list.className = "se-history-grid";
    list.id = "se-history-grid";
    wrap.appendChild(list);

    return wrap;
  }

  private _updateColorHistory(): void {
    const grid = this.overlay.querySelector("#se-history-grid") as HTMLElement;
    if (!grid) return;
    grid.innerHTML = "";
    for (const hex of this.colorHistory) {
      const swatch = document.createElement("div");
      swatch.className = "se-swatch-sm";
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatch.addEventListener("click", () => this._setColor(hex));
      grid.appendChild(swatch);
    }
  }

  // ──────── Color management ────────

  private _setColor(hex: string): void {
    this.currentColor = hexToRGBA(hex);
    // Add to front of history, dedupe, max 8
    this.colorHistory = [hex, ...this.colorHistory.filter(c => c !== hex)].slice(0, 8);
    this._updateColorHistory();
  }

  // ──────── Canvas events ────────

  private _setupCanvasEvents(wrap: HTMLElement): void {
    const getPos = (e: MouseEvent): [number, number] => {
      const rect = this.previewCanvas.getBoundingClientRect();
      const logicalX = Math.floor((e.clientX - rect.left) / this.zoom);
      const logicalY = Math.floor((e.clientY - rect.top) / this.zoom);
      return [logicalX, logicalY];
    };

    // Prevent right-click
    wrap.addEventListener("contextmenu", (e) => e.preventDefault());

    wrap.addEventListener("mousedown", (e) => {
      if (e.button === 2) return; // ignore right-click for now
      if (this.currentTool === "select" && this.selectedRegion && !this.movingSelection) {
        // Check if click is inside selection
        const [lx, ly] = getPos(e);
        if (this._isInSelection(lx, ly)) {
          this.movingSelection = true;
          this.selectOffsetX = lx - this.selectStartX;
          this.selectOffsetY = ly - this.selectStartY;
          return;
        } else {
          this._commitSelection();
        }
      }
      this._startDraw(e);
    });

    wrap.addEventListener("mousemove", (e) => {
      if (this.movingSelection) {
        const [lx, ly] = getPos(e);
        this.selectStartX = lx - this.selectOffsetX;
        this.selectStartY = ly - this.selectOffsetY;
        this._redrawPreview();
        return;
      }
      if (!this.drawing) {
        // Live preview for rect/circle/line
        if ((this.currentTool === "rect" || this.currentTool === "circle" || this.currentTool === "line") && e.buttons === 1) {
          this._startDraw(e);
        }
        return;
      }
      this._continueDraw(e);
    });

    wrap.addEventListener("mouseup", (e) => {
      if (this.movingSelection) {
        this.movingSelection = false;
        this._pushUndo();
        this._redrawPreview();
        return;
      }
      if (!this.drawing) return;
      // Shape tools need final position
      if (this.currentTool === "rect" || this.currentTool === "circle" || this.currentTool === "line") {
        this._finishShape(e);
      }
      this._endDraw();
    });

    wrap.addEventListener("mouseleave", (e) => {
      if (this.drawing) {
        // Finish shapes on leave too
        if (this.currentTool === "rect" || this.currentTool === "circle" || this.currentTool === "line") {
          this._finishShape(e);
        }
        this._endDraw();
      }
      if (this.movingSelection) {
        this.movingSelection = false;
        this._pushUndo();
      }
    });
  }

  private _startDraw(e: MouseEvent): void {
    const rect = this.previewCanvas.getBoundingClientRect();
    const lx = Math.floor((e.clientX - rect.left) / this.zoom);
    const ly = Math.floor((e.clientY - rect.top) / this.zoom);
    const w = this.canvas.width, h = this.canvas.height;

    this.drawing = true;
    const data = getImageData(this.canvas);

    switch (this.currentTool) {
      case "brush":
        brushStroke(data, lx, ly, this.brushSize, this.currentColor);
        break;
      case "eraser":
        brushStroke(data, lx, ly, this.brushSize, { r: 0, g: 0, b: 0, a: 0 });
        break;
      case "fill": {
        const target = getPixel(data, lx, ly);
        floodFill(data, lx, ly, target, this.currentColor);
        break;
      }
      case "eyedropper": {
        const p = getPixel(data, lx, ly);
        if (p.a > 0) {
          const hex = rgbaToHex(p);
          this._setColor(hex);
        }
        this.drawing = false;
        return;
      }
      case "select":
      case "rect":
      case "circle":
        // Start point only — actual drawing happens on mouseup
        this.lineStartX = lx;
        this.lineStartY = ly;
        break;
      case "line":
        this.lineStartX = lx;
        this.lineStartY = ly;
        break;
    }

    if (this.currentTool !== "select" && this.currentTool !== "rect" && this.currentTool !== "circle" && this.currentTool !== "line") {
      putImageData(this.canvas, data);
      this._redrawPreview();
    }
  }

  private _continueDraw(e: MouseEvent): void {
    const rect = this.previewCanvas.getBoundingClientRect();
    const lx = Math.floor((e.clientX - rect.left) / this.zoom);
    const ly = Math.floor((e.clientY - rect.top) / this.zoom);
    const w = this.canvas.width, h = this.canvas.height;

    const data = getImageData(this.canvas);

    switch (this.currentTool) {
      case "brush":
        brushStroke(data, lx, ly, this.brushSize, this.currentColor);
        putImageData(this.canvas, data);
        break;
      case "eraser":
        brushStroke(data, lx, ly, this.brushSize, { r: 0, g: 0, b: 0, a: 0 });
        putImageData(this.canvas, data);
        break;
      case "select":
        this.selectStartX = Math.min(this.lineStartX, lx);
        this.selectStartY = Math.min(this.lineStartY, ly);
        this.selectEndX = Math.max(this.lineStartX, lx);
        this.selectEndY = Math.max(this.lineStartY, ly);
        this.selecting = true;
        break;
      case "rect":
      case "circle":
      case "line":
        // Snap for line with shift
        this.snapMode = e.shiftKey && this.currentTool === "line";
        break;
    }
    this._redrawPreview();
  }

  private _endDraw(): void {
    this.drawing = false;

    const rect = this.previewCanvas.getBoundingClientRect();
    // We need the last mouse position — captured in _continueDraw
    // Actually, let's get it from the canvas state

    switch (this.currentTool) {
      case "brush":
      case "eraser":
      case "fill":
        this._pushUndo();
        break;
      case "select":
        if (this.selecting) {
          this._captureSelection();
          this.selecting = false;
        }
        break;
      case "rect":
      case "circle":
      case "line":
        // Undo already pushed by _finishShape before _endDraw
        break;
    }
  }

  // ──────── Selection ────────

  private _captureSelection(): void {
    const x = this.selectStartX;
    const y = this.selectStartY;
    const w = this.selectEndX - this.selectStartX + 1;
    const h = this.selectEndY - this.selectStartY + 1;
    if (w <= 0 || h <= 0) return;

    const data = getImageData(this.canvas);
    this.selectedRegion = copyRegion(data, x, y, w, h);
    this.selectOffsetX = 0;
    this.selectOffsetY = 0;
  }

  private _commitSelection(): void {
    if (!this.selectedRegion) return;
    const data = getImageData(this.canvas);
    pasteRegion(data, this.selectedRegion, this.selectStartX, this.selectStartY);
    putImageData(this.canvas, data);
    this.selectedRegion = null;
    this.selectStartX = this.selectStartY = this.selectEndX = this.selectEndY = 0;
    this._pushUndo();
    this._redrawPreview();
  }

  private _exitSelection(): void {
    if (this.selectedRegion) this._commitSelection();
    this.selectedRegion = null;
  }

  private _isInSelection(lx: number, ly: number): boolean {
    return (
      lx >= this.selectStartX &&
      lx <= this.selectEndX &&
      ly >= this.selectStartY &&
      ly <= this.selectEndY
    );
  }

  // ──────── Undo/Redo ────────

  private _pushUndo(): void {
    this.undoStack.push(getImageData(this.canvas));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  private _undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(getImageData(this.canvas));
    const prev = this.undoStack.pop()!;
    putImageData(this.canvas, prev);
    this._redrawPreview();
  }

  private _redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(getImageData(this.canvas));
    const next = this.redoStack.pop()!;
    putImageData(this.canvas, next);
    this._redrawPreview();
  }

  // ──────── Draw shapes on mouseup ────────

  /** Finish rect/circle/line by getting final mouse position from event. */
  private _finishShape(e: MouseEvent): void {
    const rect = this.previewCanvas.getBoundingClientRect();
    const lx = Math.floor((e.clientX - rect.left) / this.zoom);
    const ly = Math.floor((e.clientY - rect.top) / this.zoom);

    const data = getImageData(this.canvas);

    switch (this.currentTool) {
      case "rect":
        drawRect(data, this.lineStartX, this.lineStartY, lx, ly, this.currentColor, this.fillMode);
        break;
      case "circle": {
        const dx = lx - this.lineStartX;
        const dy = ly - this.lineStartY;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        drawCircle(data, this.lineStartX, this.lineStartY, r, this.currentColor, this.fillMode);
        break;
      }
      case "line":
        drawLine(data, this.lineStartX, this.lineStartY, lx, ly, this.currentColor, e.shiftKey);
        break;
    }

    putImageData(this.canvas, data);
    this._pushUndo();
    this._redrawPreview();
  }

  // ──────── Render ────────

  private _redrawPreview(): void {
    const z = this.zoom;
    const cw = this.canvas.width, ch = this.canvas.height;
    this.previewCanvas.width = cw * z;
    this.previewCanvas.height = ch * z;
    this.previewCanvas.style.imageRendering = "pixelated";

    const ctx = this.previewCanvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Draw checkerboard for transparency
    this._drawCheckerboard(ctx, cw * z, ch * z, z);

    // Draw canvas content scaled
    ctx.drawImage(this.canvas, 0, 0, cw, ch, 0, 0, cw * z, ch * z);

    // Draw grid
    if (this.showGrid && z >= 4) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= cw; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, ch * z);
        ctx.stroke();
      }
      for (let y = 0; y <= ch; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z);
        ctx.lineTo(cw * z, y * z);
        ctx.stroke();
      }
    }

    // Draw selection outline
    if (this.selecting || this.selectedRegion) {
      ctx.strokeStyle = "#89b4fa";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(
        this.selectStartX * z, this.selectStartY * z,
        (this.selectEndX - this.selectStartX + 1) * z,
        (this.selectEndY - this.selectStartY + 1) * z,
      );
      ctx.setLineDash([]);
    }

    // Draw shape preview (rect/circle/line)
    if (this.drawing && (this.currentTool === "rect" || this.currentTool === "circle" || this.currentTool === "line")) {
      // Don't draw here — actual shape is drawn on canvas, redrawn on preview
    }
  }

  private _drawCheckerboard(ctx: CanvasRenderingContext2D, pw: number, ph: number, z: number): void {
    const sz = z; // checker size matches pixel
    ctx.fillStyle = "#2a2a3c";
    ctx.fillRect(0, 0, pw, ph);
    ctx.fillStyle = "#363654";
    const cw = this.canvas.width, ch = this.canvas.height;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillRect(x * z, y * z, sz, sz);
        }
      }
    }
  }

  private _applyZoom(): void {
    this._redrawPreview();
  }

  // ──────── Keyboard ────────

  private _onKeyDown(e: KeyboardEvent): void {
    // Prevent canvas events from being swallowed
    if (e.key === "Escape") {
      this.hide();
      this.opts.onClose();
      return;
    }

    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) this._redo();
      else this._undo();
      return;
    }

    if (e.ctrlKey && e.key === "y") {
      e.preventDefault();
      this._redo();
      return;
    }

    // Tool shortcuts
    const toolKeys: Record<string, ToolKind> = {
      b: "brush", e: "eraser", g: "fill", i: "eyedropper",
      r: "rect", c: "circle", l: "line", s: "select",
    };
    const tool = toolKeys[e.key.toLowerCase()];
    if (tool && !e.ctrlKey && !e.metaKey) {
      this.currentTool = tool;
      this._exitSelection();
      // Update toolbar buttons
      this.overlay.querySelectorAll(".se-tool-btn").forEach(b => {
        const title = b.getAttribute("title") || "";
        b.classList.toggle("active", title.toLowerCase().includes(tool));
      });
    }

    // Delete = commit selection
    if (e.key === "Delete" && this.selectedRegion) {
      this.selectedRegion = null;
      this._pushUndo();
      this._redrawPreview();
    }
  }

  // ──────── Load source image ────────

  private _loadSourceImage(): void {
    if (!this.opts.sourceImage) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
      this._redrawPreview();
    };
    img.onerror = () => {
      // Canvas stays blank
      this._redrawPreview();
    };
    img.src = this.opts.sourceImage;
  }

  // ──────── Export ────────

  private _exportPNG(): void {
    const dataUrl = this.canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "sprite-export.png";
    a.click();
  }
}

// ──────── Helpers ────────

function hexToRGBA(hex: string): PixelRGBA {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0, a: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 255 };
}

function rgbaToHex(p: PixelRGBA): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(p.r)}${toHex(p.g)}${toHex(p.b)}`;
}
