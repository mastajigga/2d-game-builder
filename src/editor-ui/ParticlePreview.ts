// src/editor-ui/ParticlePreview.ts
// Particle editor — mini Phaser viewport with emitter controls
// Velocity, gravity, color, lifespan, quantity, scale

import Phaser from "phaser";

export interface ParticleConfig {
  emitterX: number;       // relative to center (0-400)
  emitterY: number;
  speedMin: number;       // px/s
  speedMax: number;
  angleMin: number;       // degrees
  angleMax: number;
  gravityX: number;
  gravityY: number;
  lifespan: number;       // ms
  quantity: number;       // particles per burst
  frequency: number;      // ms between bursts (-1 = manual)
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
  tint: string;           // hex color
  blendMode: string;      // Phaser blend mode
}

const DEFAULT_CONFIG: ParticleConfig = {
  emitterX: 200,
  emitterY: 200,
  speedMin: 50,
  speedMax: 150,
  angleMin: 220,
  angleMax: 320,
  gravityX: 0,
  gravityY: 300,
  lifespan: 800,
  quantity: 5,
  frequency: 100,
  scaleStart: 1,
  scaleEnd: 0,
  alphaStart: 1,
  alphaEnd: 0,
  tint: "#ffaa44",
  blendMode: "ADD",
};

class ParticlePreviewScene extends Phaser.Scene {
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitterManager;
  private config: ParticleConfig = { ...DEFAULT_CONFIG };
  private burstTimer = 0;
  private running = true;

  constructor() { super("ParticlePreviewScene"); }

  init(data: { config?: ParticleConfig }): void {
    if (data.config) this.config = { ...DEFAULT_CONFIG, ...data.config };
  }

  create(): void {
    this.children.removeAll(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Background grid
    const gfx = this.add.graphics().setDepth(-1).setAlpha(0.06);
    for (let x = 0; x < w; x += 20) {
      gfx.lineStyle(1, 0xffffff);
      gfx.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 20) {
      gfx.lineStyle(1, 0xffffff);
      gfx.lineBetween(0, y, w, y);
    }

    // Center crosshair
    const cross = this.add.graphics().setDepth(0);
    cross.lineStyle(1, 0xffffff, 0.3);
    cross.lineBetween(w / 2 - 10, h / 2, w / 2 + 10, h / 2);
    cross.lineBetween(w / 2, h / 2 - 10, w / 2, h / 2 + 10);

    // Create emitter
    this._rebuildEmitter();
  }

  private _rebuildEmitter(): void {
    if (this.particles) this.particles.destroy();

    // Create a particle texture from a small circle
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture("__particle_tex", 8, 8);
    gfx.destroy();

    this.particles = this.add.particles("__particle_tex");
    this.particles.setDepth(5);

    this.emitter = this.particles.createEmitter({
      x: this.config.emitterX,
      y: this.config.emitterY,
      speed: { min: this.config.speedMin, max: this.config.speedMax },
      angle: { min: this.config.angleMin, max: this.config.angleMax },
      gravityX: this.config.gravityX,
      gravityY: this.config.gravityY,
      lifespan: this.config.lifespan,
      quantity: this.config.quantity,
      frequency: this.config.frequency,
      scale: { start: this.config.scaleStart, end: this.config.scaleEnd },
      alpha: { start: this.config.alphaStart, end: this.config.alphaEnd },
      tint: Phaser.Display.Color.HexStringToColor(this.config.tint).color,
      blendMode: this.config.blendMode as Phaser.BlendModes,
    });
  }

  updateConfig(config: Partial<ParticleConfig>): void {
    Object.assign(this.config, config);
    this._rebuildEmitter();
  }

  togglePause(): void {
    this.running = !this.running;
    if (this.emitter) {
      this.emitter.on = this.running;
    }
  }

  burst(count: number): void {
    if (this.emitter) {
      this.emitter.explode(count, this.config.emitterX, this.config.emitterY);
    }
  }

  getConfig(): ParticleConfig {
    return { ...this.config };
  }
}

// ══════════════════════════════════════════════════════════════

export class ParticlePreviewUI {
  private container: HTMLElement;
  private game: Phaser.Game | null = null;
  private scene: ParticlePreviewScene | null = null;
  private config: ParticleConfig = { ...DEFAULT_CONFIG };
  private visible = false;
  private onClose: () => void;
  private controlPanel!: HTMLElement;

  constructor(parent: HTMLElement, onClose: () => void) {
    this.container = parent;
    this.onClose = onClose;
    this._build();
  }

  show(): void {
    this.visible = true;
    this.container.style.display = "flex";
    this._startGame();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = "none";
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
  }

  isVisible(): boolean { return this.visible; }

  // ── Build UI ────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = "";
    this.container.style.display = "none";
    this.container.className = "particle-container";

    // Header
    const header = document.createElement("div");
    header.className = "particle-header";
    header.innerHTML = `<h3>✨ Particle FX Editor</h3>`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "page-close-btn";
    closeBtn.textContent = "✕ Fermer";
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Main: preview + controls
    const main = document.createElement("div");
    main.className = "particle-main";

    // Phaser canvas container
    const canvasContainer = document.createElement("div");
    canvasContainer.className = "particle-canvas-container";
    canvasContainer.id = "particle-canvas-container";
    main.appendChild(canvasContainer);

    // Control panel
    this.controlPanel = document.createElement("div");
    this.controlPanel.className = "particle-controls";
    this._buildControls();
    main.appendChild(this.controlPanel);

    this.container.appendChild(main);
  }

  private _buildControls(): void {
    const c = this.controlPanel;
    c.innerHTML = "";

    const addSlider = (
      label: string,
      key: keyof ParticleConfig,
      min: number,
      max: number,
      step: number,
      unit = ""
    ) => {
      const row = document.createElement("div");
      row.className = "particle-control-row";

      const lbl = document.createElement("label");
      lbl.textContent = label;
      lbl.style.minWidth = "80px";
      row.appendChild(lbl);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(this.config[key]);
      input.className = "particle-slider";
      input.addEventListener("input", () => {
        (this.config as any)[key] = parseFloat(input.value);
        valSpan.textContent = `${input.value}${unit}`;
        this._applyConfig();
      });
      row.appendChild(input);

      const valSpan = document.createElement("span");
      valSpan.textContent = `${input.value}${unit}`;
      valSpan.className = "particle-val";
      row.appendChild(valSpan);

      c.appendChild(row);
    };

    const addColor = (label: string, key: keyof ParticleConfig) => {
      const row = document.createElement("div");
      row.className = "particle-control-row";

      const lbl = document.createElement("label");
      lbl.textContent = label;
      lbl.style.minWidth = "80px";
      row.appendChild(lbl);

      const input = document.createElement("input");
      input.type = "color";
      input.value = this.config[key] as string;
      input.addEventListener("input", () => {
        (this.config as any)[key] = input.value;
        this._applyConfig();
      });
      row.appendChild(input);

      c.appendChild(row);
    };

    const addSelect = (label: string, key: keyof ParticleConfig, options: string[]) => {
      const row = document.createElement("div");
      row.className = "particle-control-row";

      const lbl = document.createElement("label");
      lbl.textContent = label;
      lbl.style.minWidth = "80px";
      row.appendChild(lbl);

      const select = document.createElement("select");
      select.className = "prop-input-text";
      select.style.width = "100px";
      for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === this.config[key]) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener("change", () => {
        (this.config as any)[key] = select.value;
        this._applyConfig();
      });
      row.appendChild(select);

      c.appendChild(row);
    };

    // Emitter position
    addSlider("Emitter X", "emitterX", 0, 400, 5, "px");
    addSlider("Emitter Y", "emitterY", 0, 400, 5, "px");

    // Speed
    addSlider("Speed Min", "speedMin", 0, 500, 10, "px/s");
    addSlider("Speed Max", "speedMax", 0, 500, 10, "px/s");

    // Angle
    addSlider("Angle Min", "angleMin", 0, 360, 5, "°");
    addSlider("Angle Max", "angleMax", 0, 360, 5, "°");

    // Gravity
    addSlider("Gravity X", "gravityX", -500, 500, 10, "");
    addSlider("Gravity Y", "gravityY", -500, 500, 10, "");

    // Lifespan
    addSlider("Lifespan", "lifespan", 100, 5000, 50, "ms");

    // Quantity
    addSlider("Quantity", "quantity", 1, 50, 1, "");
    addSlider("Frequency", "frequency", -1, 2000, 50, "ms");

    // Scale
    addSlider("Scale Start", "scaleStart", 0.1, 5, 0.1, "x");
    addSlider("Scale End", "scaleEnd", 0, 5, 0.1, "x");

    // Alpha
    addSlider("Alpha Start", "alphaStart", 0, 1, 0.05, "");
    addSlider("Alpha End", "alphaEnd", 0, 1, 0.05, "");

    // Color
    addColor("Tint", "tint");

    // Blend mode
    addSelect("Blend", "blendMode", ["ADD", "NORMAL", "SCREEN", "MULTIPLY", "ERASE"]);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "particle-actions";

    const pauseBtn = document.createElement("button");
    pauseBtn.className = "panel-btn";
    pauseBtn.textContent = "⏯ Pause";
    pauseBtn.addEventListener("click", () => {
      this.scene?.togglePause();
      pauseBtn.textContent = this.scene && (this.scene as any).running !== false ? "⏯ Pause" : "▶ Resume";
    });
    actions.appendChild(pauseBtn);

    const burstBtn = document.createElement("button");
    burstBtn.className = "panel-btn primary";
    burstBtn.textContent = "💥 Burst";
    burstBtn.addEventListener("click", () => this.scene?.burst(20));
    actions.appendChild(burstBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "panel-btn";
    resetBtn.textContent = "↺ Reset";
    resetBtn.addEventListener("click", () => {
      this.config = { ...DEFAULT_CONFIG };
      this._buildControls();
      this._applyConfig();
    });
    actions.appendChild(resetBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className = "panel-btn";
    exportBtn.textContent = "📋 Copier JSON";
    exportBtn.addEventListener("click", () => {
      const json = JSON.stringify(this.config, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        exportBtn.textContent = "✓ Copié!";
        setTimeout(() => { exportBtn.textContent = "📋 Copier JSON"; }, 1500);
      });
    });
    actions.appendChild(exportBtn);

    c.appendChild(actions);
  }

  private _applyConfig(): void {
    if (this.scene) {
      this.scene.updateConfig(this.config);
    }
  }

  private _startGame(): void {
    const canvasContainer = document.getElementById("particle-canvas-container");
    if (!canvasContainer) return;

    canvasContainer.innerHTML = "";
    // Destroy previous instance to prevent memory leaks
    if (this.game) { this.game.destroy(true); this.game = null; }

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 400,
      height: 400,
      parent: "particle-canvas-container",
      backgroundColor: "#111118",
      pixelArt: true,
      antialias: false,
      scale: { mode: Phaser.Scale.NONE },
      scene: ParticlePreviewScene,
    });

    // Wait for scene ready
    const checkReady = () => {
      const s = this.game!.scene.getScene("ParticlePreviewScene") as ParticlePreviewScene;
      if (s && s.scene.isActive()) {
        this.scene = s;
        s.updateConfig(this.config);
      } else {
        setTimeout(checkReady, 50);
      }
    };
    setTimeout(checkReady, 100);
  }
}
