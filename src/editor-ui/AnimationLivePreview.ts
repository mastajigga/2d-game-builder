// src/editor-ui/AnimationLivePreview.ts
// Mini Phaser viewport that plays the current animation with left/right movement
// Gives immediate in-game render feedback without leaving the Animation Lab

import Phaser from "phaser";

interface LivePreviewConfig {
  parent: HTMLElement;
  width: number;
  height: number;
  sheetPath: string;      // URL to spritesheet image
  textureKey: string;
  frameW: number;
  frameH: number;
  anims: Array<{
    key: string;
    frameStart: number;
    frameEnd: number;
    frameRate: number;
    repeat: boolean;
  }>;
}

const GROUND_Y_RATIO = 0.8; // ground at 80% of canvas height
const MOVE_SPEED = 120;
const SCALE = 3;

class LivePreviewScene extends Phaser.Scene {
  private sprite!: Phaser.GameObjects.Sprite;
  private ground!: Phaser.GameObjects.Rectangle;
  private animConfigs!: LivePreviewConfig["anims"];
  private currentAnim = "idle";
  private direction = 1; // 1 = right, -1 = left
  private autoCycle = true;
  private cycleTimer = 0;
  private cyclePhase = 0; // 0 = idle, 1 = move right, 2 = idle, 3 = move left

  constructor() {
    super("LivePreviewScene");
  }

  init(data: { anims: LivePreviewConfig["anims"] }): void {
    this.animConfigs = data.anims;
  }

  preload(): void {
    // Texture and config are set externally
  }

  create(): void {
    this.children.removeAll(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const groundY = Math.floor(h * GROUND_Y_RATIO);

    // Ground
    this.ground = this.add.rectangle(w / 2, groundY + 4, w, 8, 0x333333);
    this.ground.setDepth(0);

    // Grid lines for reference
    const gfx = this.add.graphics().setDepth(-1).setAlpha(0.08);
    for (let x = 0; x < w; x += 16) {
      gfx.lineStyle(1, 0xffffff);
      gfx.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 16) {
      gfx.lineStyle(1, 0xffffff);
      gfx.lineBetween(0, y, w, y);
    }

    // Create sprite at center-bottom
    this.sprite = this.add.sprite(w / 2, groundY, "__PREVIEW_SHEET", 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(SCALE);
    this.sprite.setDepth(10);

    // Create animations
    for (const a of this.animConfigs) {
      if (!this.anims.exists(a.key)) {
        this.anims.create({
          key: a.key,
          frames: this.anims.generateFrameNumbers("__PREVIEW_SHEET", {
            start: a.frameStart,
            end: a.frameEnd,
          }),
          frameRate: a.frameRate,
          repeat: a.repeat ? -1 : 0,
        });
      }
    }

    // Debug info text
    this.add.text(4, 4, "LIVE PREVIEW", {
      fontSize: "9px", color: "#888888",
    }).setDepth(100).setScrollFactor(0);

    // Start with idle
    if (this.anims.exists("idle")) {
      this.sprite.anims.play("idle");
    } else if (this.animConfigs.length > 0) {
      this.sprite.anims.play(this.animConfigs[0].key);
    }

    this.cyclePhase = 0;
    this.cycleTimer = 0;
  }

  update(_time: number, delta: number): void {
    if (!this.sprite) return;

    if (this.autoCycle) {
      this.cycleTimer += delta;

      switch (this.cyclePhase) {
        case 0: // Idle right (2s)
          if (this.cycleTimer > 2000) {
            this.cycleTimer = 0;
            this.cyclePhase = 1;
            this.direction = 1;
            this.sprite.setFlipX(false);
            this._playAnim("run");
          }
          break;
        case 1: // Run right (1.5s)
          this.sprite.x += MOVE_SPEED * (delta / 1000) * this.direction;
          if (this.cycleTimer > 1500) {
            this.cycleTimer = 0;
            this.cyclePhase = 2;
            this._playAnim("idle");
          }
          break;
        case 2: // Idle right (1s)
          if (this.cycleTimer > 1000) {
            this.cycleTimer = 0;
            this.cyclePhase = 3;
            this.direction = -1;
            this._playAnim("run");
            this.sprite.setFlipX(true);
          }
          break;
        case 3: // Run left (1.5s)
          this.sprite.x += MOVE_SPEED * (delta / 1000) * this.direction;
          if (this.cycleTimer > 1500) {
            this.cycleTimer = 0;
            this.cyclePhase = 0;
            this._playAnim("idle");
            this.sprite.setFlipX(false);
          }
          break;
      }

      // Wrap around
      const w = this.cameras.main.width;
      if (this.sprite.x < -32) this.sprite.x = w + 32;
      if (this.sprite.x > w + 32) this.sprite.x = -32;
    }
  }

  private _playAnim(key: string): void {
    if (this.anims.exists(key) && this.currentAnim !== key) {
      this.currentAnim = key;
      this.sprite.anims.play(key);
    }
  }

  // Public API
  setAutoCycle(on: boolean): void {
    this.autoCycle = on;
    if (!on) {
      this.sprite.x = this.cameras.main.width / 2;
      this.sprite.setFlipX(false);
      this._playAnim("idle");
    }
  }

  setDirection(dir: number): void {
    this.direction = dir;
    this.sprite.setFlipX(dir < 0);
  }

  playAnim(key: string): void {
    this.autoCycle = false;
    this._playAnim(key);
  }
}

// ───────────────────────────────────────────────────────────────

export class AnimationLivePreview {
  private container: HTMLElement;
  private game: Phaser.Game | null = null;
  private config: LivePreviewConfig | null = null;
  private scene: LivePreviewScene | null = null;
  private visible = false;
  private loaded = false;

  constructor(parent: HTMLElement) {
    this.container = parent;
  }

  async load(config: LivePreviewConfig): Promise<void> {
    this.config = config;
    this.loaded = false;

    // Destroy previous game
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    // Clear container
    this.container.innerHTML = "";

    return new Promise((resolve) => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        width: config.width,
        height: config.height,
        parent: this.container,
        backgroundColor: "#111118",
        pixelArt: true,
        roundPixels: true,
        antialias: false,
        scale: { mode: Phaser.Scale.NONE },
        scene: LivePreviewScene,
      });

      // Wait for scene to be ready, then load texture
      const checkReady = () => {
        const scene = this.game!.scene.getScene("LivePreviewScene") as LivePreviewScene;
        if (scene && scene.scene.isActive()) {
          this.scene = scene;
          // Load the spritesheet texture
          this.game!.textures.addSpriteSheet(config.textureKey, new Image(), {
            frameWidth: config.frameW,
            frameHeight: config.frameH,
          });

          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            // Replace existing texture with loaded image
            const tex = this.game!.textures.get(config.textureKey);
            const src = tex.getSourceImage() as HTMLImageElement;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            src.src = canvas.toDataURL();
            // Trigger scene init
            scene.scene.restart({ anims: config.anims });
            this.loaded = true;
            if (!this.visible) this.game!.canvas.style.display = "none";
            resolve();
          };
          img.onerror = () => {
            this.loaded = false;
            resolve();
          };
          img.src = config.sheetPath;
        } else {
          setTimeout(checkReady, 50);
        }
      };
      setTimeout(checkReady, 100);
    });
  }

  show(): void {
    this.visible = true;
    if (this.game) this.game.canvas.style.display = "block";
  }

  hide(): void {
    this.visible = false;
    if (this.game) this.game.canvas.style.display = "none";
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
  }

  setAutoCycle(on: boolean): void {
    this.scene?.setAutoCycle(on);
  }

  playAnim(key: string): void {
    this.scene?.playAnim(key);
  }

  isLoaded(): boolean { return this.loaded; }
}
