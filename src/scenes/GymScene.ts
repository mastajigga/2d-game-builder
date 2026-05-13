import Phaser from "phaser";
import { ASSET_CATALOG, CATALOG_BY_ID, ensureCatalogAnimations, ensureCatalogFrames, getAssetDefaultSize, preloadCatalog } from "../level/AssetCatalog";
import { BackgroundLayer, BackgroundShape, LevelData, PlacedEntity, PlayerStats, getBackgroundLayer, loadLevel } from "../level/LevelData";
import { pendingSaveSlot } from "../main";
import { createSaveSlot, saveSlot } from "../save-system/SaveManager";
import type { SaveSlot } from "../save-system/SaveSlot";
import { RewindBuffer, GameStateFrame } from "../gameplay/RewindBuffer";
import { completeLevel } from "../level/LevelLoader";

// ─── Joueur (Skeleton) ────────────────────────────────────────────────────────
const SKEL_BASE = "assets/Skeleton_With_VFX";
const FW        = 96;
const FH        = 64;

const SKELS = {
  idle:    { key: "skel-idle",    path: `${SKEL_BASE}/Skeleton_01_White_Idle.png`,    frames: 8  },
  walk:    { key: "skel-walk",    path: `${SKEL_BASE}/Skeleton_01_White_Walk.png`,    frames: 10 },
  attack1: { key: "skel-attack1", path: `${SKEL_BASE}/Skeleton_01_White_Attack1.png`, frames: 10 },
  hurt:    { key: "skel-hurt",    path: `${SKEL_BASE}/Skeleton_01_White_Hurt.png`,    frames: 5  },
  die:     { key: "skel-die",     path: `${SKEL_BASE}/Skeleton_01_White_Die.png`,     frames: 13 },
};

// ─── Mushroom (ennemis) ───────────────────────────────────────────────────────
const MUSH_BASE = "assets/Mushroom with VFX";
const MFW       = 80;
const MFH       = 64;

const MUSHROOMS = {
  idle:   { key: "mush-idle",   path: `${MUSH_BASE}/Mushroom-Idle.png`,   frames: 7  },
  run:    { key: "mush-run",    path: `${MUSH_BASE}/Mushroom-Run.png`,    frames: 8  },
  attack: { key: "mush-attack", path: `${MUSH_BASE}/Mushroom-Attack.png`, frames: 10 },
  hit:    { key: "mush-hit",    path: `${MUSH_BASE}/Mushroom-Hit.png`,    frames: 5  },
  die:    { key: "mush-die",    path: `${MUSH_BASE}/Mushroom-Die.png`,    frames: 15 },
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const W = 1600;
const H = 900;

const PLAYER_SCALE   = 3.2;
const HIT_W          = 56;
const HIT_H          = 116;
const ATK_W          = 144;
const ATK_H          = 140;

const ENEMY_HIT_FRAME_START = 4;
const ENEMY_HIT_FRAME_END   = 7;

const DEFAULT_PLAYER_STATS: PlayerStats = {
  maxHp: 8,
  jumpForce: 1040,
  moveSpeed: 320,
  attackDamage: 1,
  attackRange: 160,
  attackCooldownMs: 500,
};

// ─── Classe Enemy ─────────────────────────────────────────────────────────────
type EnemyState = "patrol" | "hurt" | "attacking" | "dead";

interface EnemyConfig {
  x: number; y: number;
  xMin: number; xMax: number;
  speed: number; maxHp: number;
  damage: number;
  scale?: number;
  rotation?: number;
  tint?: string;
  name?: string;
  onHitPlayer: () => void;
}

class Enemy {
  sprite:  Phaser.Physics.Arcade.Sprite;
  hp:      number;
  maxHp:   number;
  speed:   number;
  damage:  number;
  xMin:    number;
  xMax:    number;
  dir:     1 | -1 = 1;
  state:   EnemyState = "patrol";

  private bar:          Phaser.GameObjects.Graphics;
  private nameLabel:    Phaser.GameObjects.Text | null = null;
  private hasHitPlayer: boolean = false;
  private onHit:        () => void;

  readonly kWalk: string;
  readonly kHurt: string;
  readonly kDie:  string;
  readonly kAtk:  string;
  private static _id = 0;

  constructor(scene: Phaser.Scene, cfg: EnemyConfig) {
    const id = Enemy._id++;
    this.kWalk = `e-walk-${id}`;
    this.kHurt = `e-hurt-${id}`;
    this.kDie  = `e-die-${id}`;
    this.kAtk  = `e-atk-${id}`;

    this.xMin   = cfg.xMin;
    this.xMax   = cfg.xMax;
    this.speed  = cfg.speed;
    this.hp     = cfg.maxHp;
    this.maxHp  = cfg.maxHp;
    this.damage = cfg.damage;
    this.onHit  = cfg.onHitPlayer;

    const ESCALE = PLAYER_SCALE * 0.85 * (cfg.scale ?? 1);

    this.sprite = (scene.physics.add as Phaser.Physics.Arcade.Factory)
      .sprite(cfg.x, cfg.y, MUSHROOMS.run.key, 0);
    this.sprite.setScale(ESCALE);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(true);
    if (cfg.rotation) this.sprite.setAngle(cfg.rotation);
    if (cfg.tint) this.sprite.setTint(Phaser.Display.Color.HexStringToColor(cfg.tint).color);

    const bw = 64 / ESCALE;
    const bh = 104 / ESCALE;
    this.sprite.body?.setSize(bw, bh);
    this.sprite.body?.setOffset((MFW - bw) / 2, MFH - bh);

    this.bar = scene.add.graphics().setDepth(40);

    if (cfg.name) {
      this.nameLabel = scene.add.text(cfg.x, cfg.y - (MFH * ESCALE) - 28, cfg.name, {
        fontSize: "14px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#000000aa", padding: { x: 6, y: 2 },
      }).setOrigin(0.5, 1).setDepth(41);
    }

    scene.anims.create({ key: this.kWalk, frames: scene.anims.generateFrameNumbers(MUSHROOMS.run.key,    { start: 0, end: MUSHROOMS.run.frames    - 1 }), frameRate: 10, repeat: -1 });
    scene.anims.create({ key: this.kHurt, frames: scene.anims.generateFrameNumbers(MUSHROOMS.hit.key,    { start: 0, end: MUSHROOMS.hit.frames    - 1 }), frameRate: 12, repeat: 0  });
    scene.anims.create({ key: this.kDie,  frames: scene.anims.generateFrameNumbers(MUSHROOMS.die.key,    { start: 0, end: MUSHROOMS.die.frames    - 1 }), frameRate: 10, repeat: 0  });
    scene.anims.create({ key: this.kAtk,  frames: scene.anims.generateFrameNumbers(MUSHROOMS.attack.key, { start: 0, end: MUSHROOMS.attack.frames - 1 }), frameRate: 12, repeat: 0  });

    this.sprite.on("animationcomplete", (anim: Phaser.Animations.Animation) => {
      if (anim.key === this.kHurt && this.state === "hurt") this._goPatrol();
      if (anim.key === this.kAtk  && this.state === "attacking") {
        this.hasHitPlayer = false;
        this._goPatrol();
      }
    });

    this.sprite.anims.play(this.kWalk);
  }

  update(playerX: number, playerY: number): void {
    if (this.state === "dead") return;
    this._drawBar();
    if (this.nameLabel) this.nameLabel.setPosition(this.sprite.x, this.sprite.y - (MFH * this.sprite.scaleY) - 28);
    if (this.state === "hurt") return;

    if (this.state === "attacking") {
      const frameIdx = this.sprite.anims.currentFrame?.index ?? 0;
      if (!this.hasHitPlayer && frameIdx >= ENEMY_HIT_FRAME_START && frameIdx <= ENEMY_HIT_FRAME_END) {
        const dist = Math.abs(this.sprite.x - playerX);
        const sameLevel = Math.abs(this.sprite.y - playerY) < 60;
        if (dist < 160 && sameLevel) {
          this.hasHitPlayer = true;
          this.onHit();
        }
      }
      return;
    }

    const dist = Math.abs(this.sprite.x - playerX);
    const sameLevel = Math.abs(this.sprite.y - playerY) < 60;

    if (dist < 160 && sameLevel) {
      this._startAttack(playerX);
      return;
    }

    const vx = this.speed * this.dir;
    this.sprite.setVelocityX(vx);
    this.sprite.setFlipX(this.dir < 0);
    if (this.sprite.x >= this.xMax) this.dir = -1;
    if (this.sprite.x <= this.xMin) this.dir =  1;
  }

  hit(dmg: number): boolean {
    if (this.state === "dead" || this.state === "hurt") return false;

    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) { this._die(); return true; }

    this.state = "hurt";
    this.sprite.setVelocityX(0);
    this.sprite.clearTint();
    this.sprite.setTexture(MUSHROOMS.hit.key, 0);
    this.sprite.anims.play(this.kHurt, true);
    this._drawBar();
    return false;
  }

  destroy(): void { this.sprite.destroy(); this.bar.destroy(); this.nameLabel?.destroy(); }

  private _startAttack(playerX: number): void {
    this.state = "attacking";
    this.hasHitPlayer = false;
    this.sprite.setVelocityX(0);
    this.sprite.setFlipX(this.sprite.x > playerX);
    this.sprite.setTexture(MUSHROOMS.attack.key, 0);
    this.sprite.anims.play(this.kAtk, true);
  }

  private _goPatrol(): void {
    this.state = "patrol";
    this.sprite.clearTint();
    this.sprite.setTexture(MUSHROOMS.run.key, 0);
    this.sprite.anims.play(this.kWalk, true);
  }

  private _die(): void {
    this.state = "dead";
    this.sprite.setVelocityX(0);
    this.sprite.setTexture(MUSHROOMS.die.key, 0);
    this.sprite.anims.play(this.kDie, true);
    this.sprite.once("animationcomplete", () => { this.destroy(); });
  }

  private _drawBar(): void {
    if (this.state === "dead") return;
    this.bar.clear();

    const scale = this.sprite.scaleY;
    const bw  = 48 * scale;
    const bh  = 10;
    const bx  = this.sprite.x - bw / 2;
    const by  = this.sprite.y - (MFH * scale) - 18;
    const pct = this.hp / this.maxHp;
    const col = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;

    this.bar.fillStyle(0x222222); this.bar.fillRect(bx, by, bw, bh);
    this.bar.fillStyle(col);      this.bar.fillRect(bx, by, bw * pct, bh);
    this.bar.lineStyle(1, 0x888888); this.bar.strokeRect(bx, by, bw, bh);
  }
}

// ─── GymScene ─────────────────────────────────────────────────────────────────
type PlayerState = "idle" | "run" | "jump" | "fall" | "attack" | "hurt" | "dead";

export class GymScene extends Phaser.Scene {
  private level!: LevelData;
  private playerStats!: PlayerStats;

  private player!:      Phaser.Physics.Arcade.Sprite;
  private atkZone!:     Phaser.Physics.Arcade.Image;
  private platforms!:   Phaser.Physics.Arcade.StaticGroup;
  private pState:       PlayerState = "idle";
  private isAttacking   = false;
  private playerHp      = DEFAULT_PLAYER_STATS.maxHp;
  private playerHurtMs  = 0;
  private hitThisSwing  = new Set<Enemy>();
  private hpBar!:       Phaser.GameObjects.Graphics;
  private spawnX        = 150;
  private spawnY        = 300;

  private enemies: Enemy[] = [];

  private cursors!:    Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!:  Phaser.Input.Keyboard.Key;
  private respawnKey!: Phaser.Input.Keyboard.Key;
  private editorKey!:  Phaser.Input.Keyboard.Key;
  private saveKey!:    Phaser.Input.Keyboard.Key;
  private rewindKey!:  Phaser.Input.Keyboard.Key;

  // Rewind
  private rewindBuffer = new RewindBuffer();

  // Game Over
  private gameOver      = false;
  private goTimer       = 0;
  private goShowChoice  = false;
  private goSelected: "yes" | "no" = "yes";
  private goOverlay!:   Phaser.GameObjects.Rectangle;
  private goText!:      Phaser.GameObjects.Text;
  private goChoiceText!: Phaser.GameObjects.Text;
  private leftKey!:     Phaser.Input.Keyboard.Key;
  private rightKey!:    Phaser.Input.Keyboard.Key;
  private confirmKey!:  Phaser.Input.Keyboard.Key;

  // HUD
  private dbgState!:  Phaser.GameObjects.Text;
  private dbgPos!:    Phaser.GameObjects.Text;
  private modeBadge!: Phaser.GameObjects.Text;

  constructor() { super("GymScene"); }

  // ─── PRELOAD ──────────────────────────────────────────────────────────────
  preload(): void {
    for (const s of Object.values(SKELS))     this.load.spritesheet(s.key, s.path, { frameWidth: FW,  frameHeight: FH  });
    for (const m of Object.values(MUSHROOMS)) this.load.spritesheet(m.key, m.path, { frameWidth: MFW, frameHeight: MFH });
    preloadCatalog(this);
    this.load.image("mossy-bg",      "assets/Mossy Tileset/Mossy - BackgroundDecoration.png");
    this.load.image("mossy-hills",   "assets/Mossy Tileset/Mossy - MossyHills.png");
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────
  create(): void {
    this.level = (this.registry.get("level") as LevelData) ?? (window as any).__oakwoods_levelData ?? loadLevel();
    this.playerStats = this.level.playerStats ?? DEFAULT_PLAYER_STATS;
    ensureCatalogAnimations(this);
    ensureCatalogFrames(this);

    this._drawBackground();
    this._buildLevelEntities();
    this._spawnPlayer();
    this._createPlayerAnims();
    this._setupInput();
    this._setupCamera();
    this._buildHUD();
    this._buildGameOverUI();
    this._restoreFromSlot();
    this.game.canvas.focus();
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  update(_t: number, delta: number): void {
    if (this.gameOver) {
      this._updateGameOver(delta);
      if (Phaser.Input.Keyboard.JustDown(this.editorKey)) this._returnToEditor();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.editorKey)) { this._returnToEditor(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.respawnKey)) { this._respawnLevel(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.saveKey)) { this._saveGame(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.rewindKey)) { this._doRewind(); return; }

    // Push state to rewind buffer (every frame)
    this._pushRewindState();

    this._tickPlayerHurt(delta);
    this._handleInput();
    this._tickPlayerState();
    this._positionAtkZone();
    this._checkAttackHits();

    for (const e of this.enemies) e.update(this.player.x, this.player.y);

    this._refreshHUD();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Setup
  // ═════════════════════════════════════════════════════════════════════════

  private _drawBackground(): void {
    this.add.rectangle(this.level.worldW / 2, H / 2, this.level.worldW, H, this._color(this.level.backgroundColor))
      .setDepth(-130)
      .setScrollFactor(0.05);

    // Trier les layers par depth croissant (plus loin = dessous)
    const sortedLayers = [...this.level.backgroundLayers].sort((a, b) => a.depth - b.depth);
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      for (const shape of this.level.backgroundShapes) {
        if (shape.backgroundLayerId === layer.id) this._drawBackgroundShape(shape, layer);
      }
    }
  }

  private _color(hex: string): number {
    return Number.parseInt(hex.replace("#", ""), 16);
  }

  private _drawBackgroundShape(shape: BackgroundShape, layer: BackgroundLayer): void {
    const gfx = this.add.graphics()
      .setDepth(layer.depth - 6)
      .setScrollFactor(layer.parallax);

    let color = this._color(shape.color);
    let alpha = shape.alpha;

    // Appliquer le tint du layer (sombrification/désaturation)
    if (layer.tint) {
      const tintColor = Phaser.Display.Color.HexStringToColor(layer.tint);
      const shapeColor = Phaser.Display.Color.IntegerToColor(color);
      const r = Math.round(shapeColor.red * tintColor.red / 255);
      const g = Math.round(shapeColor.green * tintColor.green / 255);
      const b = Math.round(shapeColor.blue * tintColor.blue / 255);
      color = Phaser.Display.Color.GetColor(r, g, b);
      alpha = alpha * layer.alpha;
    }

    gfx.fillStyle(color, alpha);
    if (shape.kind === "rect") {
      gfx.fillRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.kind === "circle") {
      gfx.fillCircle(shape.x, shape.y, shape.width / 2);
    } else {
      gfx.fillEllipse(shape.x, shape.y, shape.width, shape.height);
    }
  }

  private _buildLevelEntities(): void {
    this.platforms = this.physics.add.staticGroup();
    this.enemies   = [];

    // 1. Backgrounds d'abord — triés par layer depth (loin → proche)
    const bgEntities = this.level.entities
      .filter((e) => CATALOG_BY_ID[e.assetId]?.category === "background")
      .sort((a, b) => {
        const la = getBackgroundLayer(this.level, a.backgroundLayerId);
        const lb = getBackgroundLayer(this.level, b.backgroundLayerId);
        return la.depth - lb.depth;
      });

    for (const e of bgEntities) {
      const def = CATALOG_BY_ID[e.assetId];
      if (!def) continue;
      const size = getAssetDefaultSize(def);
      const layer = getBackgroundLayer(this.level, e.backgroundLayerId);
      const bg = this.add.image(e.x, e.y, def.textureKey, def.id)
        .setOrigin(0, 0)
        .setDepth(layer.depth)
        .setAlpha(layer.visible ? layer.alpha : 0)
        .setFlipX(e.flipX)
        .setFlipY((e as any).flipY ?? false)
        .setAngle(e.rotation ?? 0)
        .setScrollFactor(layer.parallax);
      // Combiner tint du layer + tint perso de l'entité
      const layerTint = layer.tint ? Phaser.Display.Color.HexStringToColor(layer.tint).color : 0xffffff;
      const entityTint = e.tint ? Phaser.Display.Color.HexStringToColor(e.tint).color : 0xffffff;
      if (layerTint !== 0xffffff || entityTint !== 0xffffff) {
        const lc = Phaser.Display.Color.IntegerToColor(layerTint);
        const ec = Phaser.Display.Color.IntegerToColor(entityTint);
        const r = Math.round(lc.red * ec.red / 255);
        const g = Math.round(lc.green * ec.green / 255);
        const b = Math.round(lc.blue * ec.blue / 255);
        bg.setTint(Phaser.Display.Color.GetColor(r, g, b));
      }
      bg.setDisplaySize(e.width ?? size.width, e.height ?? size.height);
    }

    // 2. Entités de gameplay
    for (const e of this.level.entities) {
      const def = CATALOG_BY_ID[e.assetId];
      if (!def) continue;
      if (def.category === "background") continue; // déjà traité

      switch (def.category) {
        case "spawn":
          this.spawnX = e.x;
          this.spawnY = e.y;
          break;

        case "platform": {
          const size = getAssetDefaultSize(def);
          const w = e.width  ?? size.width;
          const h = e.height ?? size.height;
          if (def.sourceFrame) {
            const im = this.add.image(e.x, e.y, def.textureKey, def.id)
              .setOrigin(0, 0).setDepth(0).setAngle(e.rotation ?? 0);
            if (e.tint) im.setTint(Phaser.Display.Color.HexStringToColor(e.tint).color);
            im.setDisplaySize(w, h);
          } else {
            const ts = this.add.tileSprite(e.x, e.y, w, h, def.textureKey)
              .setOrigin(0, 0).setDepth(0).setAngle(e.rotation ?? 0);
            if (e.tint) ts.setTint(Phaser.Display.Color.HexStringToColor(e.tint).color);
            ts.setTilePosition(def.tileOffsetX ?? 0, def.tileOffsetY ?? 0);
          }
          // Physique
          const body = this.platforms.create(e.x + w / 2, e.y + h / 2) as Phaser.Physics.Arcade.Sprite;
          body.setVisible(false);
          if (e.collision?.enabled) {
            (body.body as Phaser.Physics.Arcade.StaticBody).setSize(e.collision.width, e.collision.height);
            (body.body as Phaser.Physics.Arcade.StaticBody).setOffset(e.collision.x, e.collision.y);
          } else {
            (body.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
          }
          body.refreshBody();
          break;
        }

        case "decoration": {
          const sp = this.add.image(e.x, e.y, def.textureKey, def.sourceFrame ? def.id : undefined)
            .setOrigin(def.sourceFrame ? 0 : (def.originX ?? 0.5), def.sourceFrame ? 0 : (def.originY ?? 1))
            .setFlipX(e.flipX)
            .setDepth(2)
            .setAngle(e.rotation ?? 0);
          if (e.tint) sp.setTint(Phaser.Display.Color.HexStringToColor(e.tint).color);
          if (def.sourceFrame) {
            const size = getAssetDefaultSize(def);
            sp.setDisplaySize(e.width ?? size.width, e.height ?? size.height);
          } else {
            sp.setScale(e.scale);
          }
          break;
        }

        case "hazard": {
          const size = getAssetDefaultSize(def);
          const im = this.add.image(e.x, e.y, def.textureKey, def.id)
            .setOrigin(0, 0)
            .setDepth(2)
            .setAngle(e.rotation ?? 0);
          if (e.tint) im.setTint(Phaser.Display.Color.HexStringToColor(e.tint).color);
          im.setDisplaySize(e.width ?? size.width, e.height ?? size.height);
          break;
        }

        case "enemy": {
          const en = new Enemy(this, {
            x: e.x, y: e.y,
            xMin: e.patrolMin ?? e.x - 100,
            xMax: e.patrolMax ?? e.x + 100,
            speed: 60,
            maxHp: e.maxHp ?? 3,
            damage: e.damage ?? 1,
            scale: e.scale,
            rotation: e.rotation,
            tint: e.tint,
            name: e.name,
            onHitPlayer: () => this._damagePlayer(e.damage ?? 1),
          });
          this.physics.add.collider(en.sprite, this.platforms);
          this.enemies.push(en);
          break;
        }

        case "system": {
          if (e.assetId === "checkpoint") {
            // Checkpoint: pulsing green zone
            const cw = e.width ?? def.defaultWidth ?? 48;
            const ch = e.height ?? def.defaultHeight ?? 48;
            const gfx = this.add.graphics().setDepth(1);
            const zone = this.add.zone(e.x + cw / 2, e.y + ch / 2, cw, ch);
            this.physics.add.existing(zone, true);
            this.physics.add.overlap(this.player, zone, () => this._onCheckpoint(e));
            // Pulsing animation
            this.tweens.add({
              targets: gfx,
              alpha: { from: 0.4, to: 1 },
              duration: 800,
              yoyo: true,
              repeat: -1,
              onUpdate: () => {
                gfx.clear();
                gfx.fillStyle(0x44ff44, gfx.alpha);
                gfx.fillRect(e.x, e.y, cw, ch);
                gfx.lineStyle(2, 0x88ff88, gfx.alpha);
                gfx.strokeRect(e.x, e.y, cw, ch);
              },
            });
            // Label
            this.add.text(e.x + cw / 2, e.y - 8, "Checkpoint", {
              fontSize: "12px", color: "#44ff44",
            }).setOrigin(0.5, 1).setDepth(2);
          } else if (e.assetId === "victory") {
            // Victory zone: pulsing gold
            const vw = e.width ?? def.defaultWidth ?? 96;
            const vh = e.height ?? def.defaultHeight ?? 96;
            const gfx = this.add.graphics().setDepth(1);
            const zone = this.add.zone(e.x + vw / 2, e.y + vh / 2, vw, vh);
            this.physics.add.existing(zone, true);
            this.physics.add.overlap(this.player, zone, () => this._onVictory());
            this.tweens.add({
              targets: gfx,
              alpha: { from: 0.3, to: 0.8 },
              duration: 1000,
              yoyo: true,
              repeat: -1,
              onUpdate: () => {
                gfx.clear();
                gfx.fillStyle(0xffaa00, gfx.alpha);
                gfx.fillRect(e.x, e.y, vw, vh);
                gfx.lineStyle(2, 0xffcc44, gfx.alpha);
                gfx.strokeRect(e.x, e.y, vw, vh);
              },
            });
            this.add.text(e.x + vw / 2, e.y - 8, "Victoire", {
              fontSize: "14px", color: "#ffaa00", fontStyle: "bold",
            }).setOrigin(0.5, 1).setDepth(2);
          }
          break;
        }
      }
    }
  }

  private _spawnPlayer(): void {
    this.playerHp     = this.playerStats.maxHp;
    this.playerHurtMs = 0;
    this.pState       = "idle";
    this.isAttacking  = false;

    const playtestFrom = this.registry.get("playtestFrom") as { x: number; y: number } | undefined;
    const sx = playtestFrom?.x ?? this.spawnX;
    const sy = (playtestFrom?.y ?? this.spawnY) - 10;

    if (this.player) {
      this.player.setPosition(sx, sy);
      this.player.setVelocity(0, 0);
      this.player.setAlpha(1);
      this.player.clearTint();
      this.player.setTexture(SKELS.idle.key, 0);
      this.player.anims.play("sa-idle", true);
      return;
    }

    this.player = this.physics.add.sprite(sx, sy, SKELS.idle.key, 0);
    this.player.setScale(PLAYER_SCALE);
    this.player.setOrigin(0.5, 1);
    this.player.setBounce(0);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);

    const bw = HIT_W / PLAYER_SCALE;
    const bh = HIT_H / PLAYER_SCALE;
    this.player.body?.setSize(bw, bh);
    this.player.body?.setOffset((FW - bw) / 2, FH - bh);

    this.physics.add.collider(this.player, this.platforms);

    this.atkZone = this.physics.add.image(0, 0, "__DEFAULT");
    this.atkZone.setVisible(false).setActive(false);
    (this.atkZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setEnable(false);

    this.player.on("animationcomplete", (anim: Phaser.Animations.Animation) => {
      if (anim.key === "sa-attack") {
        this.isAttacking = false;
        this.hitThisSwing.clear();
        (this.atkZone.body as Phaser.Physics.Arcade.Body).setEnable(false);
      }
    });
  }

  private _createPlayerAnims(): void {
    const mk = (key: string, tex: string, count: number, fps: number, repeat: number) => {
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: 0, end: count - 1 }), frameRate: fps, repeat });
    };

    mk("sa-idle",   SKELS.idle.key,    SKELS.idle.frames,    8,  -1);
    mk("sa-run",    SKELS.walk.key,    SKELS.walk.frames,    12, -1);
    mk("sa-jump",   SKELS.walk.key,    4,                    10, 0 );
    mk("sa-attack", SKELS.attack1.key, SKELS.attack1.frames, 14, 0 );
    mk("sa-die",    SKELS.die.key,     SKELS.die.frames,     10, 0 );

    this.player.anims.play("sa-idle");
  }

  private _setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors    = kb.createCursorKeys();
    this.attackKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.respawnKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.editorKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.leftKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.confirmKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.saveKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.rewindKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    kb.addCapture("TAB");
  }

  private _setupCamera(): void {
    this.physics.world.setBounds(0, 0, this.level.worldW, H);
    this.cameras.main.setBounds(0, 0, this.level.worldW, H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(80, 40);
  }

  private _buildHUD(): void {
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(1000);

    this.modeBadge = this.add.text(W - 20, 20, "MODE TEST", {
      fontSize: "28px", color: "#ffaa44", fontStyle: "bold",
      backgroundColor: "#000000aa", padding: { x: 14, y: 6 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);

    const s = { fontSize: "20px", color: "#00ff88", backgroundColor: "#000000aa", padding: { x: 8, y: 4 } };
    this.dbgState = this.add.text(12, 60,  "", s).setScrollFactor(0).setDepth(1000);
    this.dbgPos   = this.add.text(12, 92,  "", s).setScrollFactor(0).setDepth(1000);

    this.add.text(12, H - 20,
      "← → déplacer    ↑ sauter    Z attaquer    T respawn    TAB éditer",
      { fontSize: "18px", color: "#aaaaaa", backgroundColor: "#000000aa", padding: { x: 8, y: 4 } },
    ).setScrollFactor(0).setOrigin(0, 1).setDepth(1000);
  }

  private _buildGameOverUI(): void {
    this.goOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setScrollFactor(0).setDepth(2000);

    this.goText = this.add.text(W / 2, H / 2 - 80, "GAME OVER", {
      fontSize: "120px", color: "#ff2222", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 12,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

    this.goChoiceText = this.add.text(W / 2, H / 2 + 100, "", {
      fontSize: "48px", color: "#ffffff", stroke: "#000000", strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Logique joueur
  // ═════════════════════════════════════════════════════════════════════════

  private _tickPlayerHurt(delta: number): void {
    if (this.playerHurtMs > 0) {
      this.playerHurtMs -= delta;
      this.player.setAlpha(Math.floor(this.playerHurtMs / 80) % 2 === 0 ? 1 : 0.3);
      if (this.playerHurtMs <= 0) this.player.setAlpha(1);
    }
  }

  private _damagePlayer(dmg: number): void {
    if (this.playerHurtMs > 0 || this.pState === "dead" || this.gameOver) return;
    this.playerHp     -= dmg;
    this.playerHurtMs  = 700;
    if (this.playerHp <= 0) {
      this.playerHp = 0;
      this._playerDie();
    }
  }

  private _playerDie(): void {
    this.pState      = "dead";
    this.isAttacking = false;
    this.player.setVelocity(0, 0);
    this.player.setTexture(SKELS.die.key, 0);
    this.player.anims.play("sa-die", true);
    this.time.delayedCall(1200, () => this._showGameOver());
  }

  private _handleInput(): void {
    if (this.pState === "dead") return;
    const onGround = this.player.body?.blocked.down ?? false;

    if (this.isAttacking) { this.player.setVelocityX(0); return; }

    const speed = this.playerStats.moveSpeed;
    if (this.cursors.left.isDown)       { this.player.setVelocityX(-speed); this.player.setFlipX(true);  }
    else if (this.cursors.right.isDown) { this.player.setVelocityX(speed);  this.player.setFlipX(false); }
    else                                { this.player.setVelocityX(0); }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
      this.player.setVelocityY(-this.playerStats.jumpForce);
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && onGround) {
      this.isAttacking = true;
      this.hitThisSwing.clear();
      this.player.setVelocityX(0);
      this.player.setTexture(SKELS.attack1.key, 0);
      this.player.anims.play("sa-attack", true);
      (this.atkZone.body as Phaser.Physics.Arcade.Body).setEnable(true);
    }
  }

  private _tickPlayerState(): void {
    if (this.pState === "dead") return;
    if (this.isAttacking) { this.pState = "attack"; return; }

    const onGround = this.player.body?.blocked.down ?? false;
    const vy = this.player.body?.velocity.y ?? 0;
    const vx = this.player.body?.velocity.x ?? 0;

    let next: PlayerState;
    if (!onGround)             next = vy < 0 ? "jump" : "fall";
    else if (Math.abs(vx) > 4) next = "run";
    else                        next = "idle";

    if (next === this.pState) return;
    this.pState = next;

    const texMap: Record<string, string> = { idle: SKELS.idle.key, run: SKELS.walk.key, jump: SKELS.walk.key, fall: SKELS.walk.key };
    const animMap: Record<string, string> = { idle: "sa-idle", run: "sa-run", jump: "sa-jump", fall: "sa-jump" };
    this.player.setTexture(texMap[next], 0);
    this.player.anims.play(animMap[next], true);
  }

  private _positionAtkZone(): void {
    const facing  = this.player.flipX ? -1 : 1;
    const range   = this.playerStats.attackRange;
    const offsetX = facing * (HIT_W / 2 + range / 2 + 4);
    this.atkZone.setPosition(this.player.x + offsetX, this.player.y - HIT_H / 2);
    (this.atkZone.body as Phaser.Physics.Arcade.Body).setSize(range, ATK_H);
    this.atkZone.body?.reset(this.atkZone.x, this.atkZone.y);
  }

  private _checkAttackHits(): void {
    if (!this.isAttacking) return;
    for (const enemy of this.enemies) {
      if (enemy.state === "dead" || this.hitThisSwing.has(enemy)) continue;
      if (Phaser.Geom.Rectangle.Overlaps(this.atkZone.getBounds(), enemy.sprite.getBounds())) {
        this.hitThisSwing.add(enemy);
        const killed = enemy.hit(this.playerStats.attackDamage);
        this.tweens.add({ targets: this.player, alpha: 0.6, duration: 60, yoyo: true });
        if (killed) this.enemies = this.enemies.filter(e => e !== enemy);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Game Over
  // ═════════════════════════════════════════════════════════════════════════

  private _showGameOver(): void {
    this.gameOver     = true;
    this.goTimer      = 5000;
    this.goShowChoice = false;
    this.goSelected   = "yes";

    for (const e of this.enemies) {
      if (e.state !== "dead") e.sprite.setVelocityX(0);
    }

    this.tweens.add({ targets: this.goOverlay, alpha: 0.75, duration: 600 });
    this.goText.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.goText, alpha: 1, duration: 800 });
  }

  private _updateGameOver(delta: number): void {
    if (!this.goShowChoice) {
      this.goTimer -= delta;
      if (this.goTimer <= 0) {
        this.goShowChoice = true;
        this.goChoiceText.setVisible(true);
        this._renderChoice();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.rightKey)) {
      this.goSelected = this.goSelected === "yes" ? "no" : "yes";
      this._renderChoice();
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      if (this.goSelected === "yes") this._respawnLevel();
      else this.goChoiceText.setText("À bientôt — TAB pour éditer");
    }
  }

  private _renderChoice(): void {
    const yes = this.goSelected === "yes" ? "► Oui" : "  Oui";
    const no  = this.goSelected === "no"  ? "► Non" : "  Non";
    this.goChoiceText.setText(`Recommencer ?    ${yes}    ${no}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Respawn / Retour éditeur
  // ═════════════════════════════════════════════════════════════════════════

  private _respawnLevel(): void {
    this.gameOver = false;
    this.goShowChoice = false;
    this.goOverlay.setAlpha(0);
    this.goText.setVisible(false);
    this.goChoiceText.setVisible(false);

    for (const e of this.enemies) e.destroy();
    this.enemies = [];

    for (const e of this.level.entities) {
      const def = CATALOG_BY_ID[e.assetId];
      if (!def || def.category !== "enemy") continue;
      const en = new Enemy(this, {
        x: e.x, y: e.y,
        xMin: e.patrolMin ?? e.x - 100,
        xMax: e.patrolMax ?? e.x + 100,
        speed: 60,
        maxHp: e.maxHp ?? 3,
        damage: e.damage ?? 1,
        scale: e.scale,
        rotation: e.rotation,
        tint: e.tint,
        name: e.name,
        onHitPlayer: () => this._damagePlayer(e.damage ?? 1),
      });
      this.physics.add.collider(en.sprite, this.platforms);
      this.enemies.push(en);
    }
    this._spawnPlayer();
    this.hitThisSwing.clear();
    (this.atkZone.body as Phaser.Physics.Arcade.Body).setEnable(false);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Save / Restore
  // ═════════════════════════════════════════════════════════════════════════

  private _saveGame(): void {
    if (this.pState === "dead" || this.gameOver) return;

    const deadUids = this.enemies
      .filter((e) => e.state === "dead")
      .map((e) => {
        const matched = this.level.entities.find(
          (le) => CATALOG_BY_ID[le.assetId]?.category === "enemy"
            && Math.abs(le.x - e.sprite.x) < 10
            && Math.abs(le.y - e.sprite.y) < 10
        );
        return matched?.uid;
      })
      .filter((uid): uid is string => !!uid);

    const slot = createSaveSlot(
      "Sauvegarde rapide",
      "level-1",
      {
        x: this.player.x,
        y: this.player.y,
        hp: this.playerHp,
        maxHp: this.playerStats.maxHp,
      },
      {
        deadEnemies: deadUids,
        collectedItems: [],
        triggeredEvents: [],
      },
    );
    saveSlot(slot);

    // Toast
    const toast = this.add.text(W / 2, H / 2 - 60, "✓ Partie sauvegardée", {
      fontSize: "28px", color: "#a6e3a1", fontStyle: "bold",
      backgroundColor: "#000000cc", padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1500, delay: 600,
      onComplete: () => toast.destroy(),
    });
  }

  private _restoreFromSlot(): void {
    if (!pendingSaveSlot.current) return;

    const slot = pendingSaveSlot.current;
    // Restore player state
    this.playerHp = slot.playerState.hp;
    this.player.setPosition(slot.playerState.x, slot.playerState.y);
    this.player.setVelocity(0, 0);

    // Kill dead enemies
    const deadSet = new Set(slot.worldState.deadEnemies);
    for (const enemy of this.enemies) {
      // Match enemy by position (since UIDs change between sessions)
      const matched = this.level.entities.find(
        (e) => CATALOG_BY_ID[e.assetId]?.category === "enemy"
          && Math.abs(e.x - enemy.sprite.x) < 10
          && Math.abs(e.y - enemy.sprite.y) < 10
      );
      if (matched && deadSet.has(matched.uid)) {
        enemy.state = "dead";
        enemy.sprite.setVisible(false);
        if (enemy.sprite.body) (enemy.sprite.body as Phaser.Physics.Arcade.Body).setEnable(false);
      }
    }
    this.enemies = this.enemies.filter((e) => e.state !== "dead");

    // Camera follow player
    this.cameras.main.centerOn(slot.playerState.x, slot.playerState.y);

    // Clear the slot so next play starts fresh
    pendingSaveSlot.current = null;

    // Toast
    const toast = this.add.text(W / 2, H / 2 - 60, "Partie restaurée", {
      fontSize: "28px", color: "#89b4fa", fontStyle: "bold",
      backgroundColor: "#000000cc", padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1500, delay: 600,
      onComplete: () => toast.destroy(),
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Rewind
  // ═════════════════════════════════════════════════════════════════════════

  private _pushRewindState(): void {
    if (this.pState === "dead" || this.gameOver) return;
    const deadUids = this.enemies
      .filter((e) => e.state === "dead")
      .map((e) => {
        const matched = this.level.entities.find(
          (le) => CATALOG_BY_ID[le.assetId]?.category === "enemy"
            && Math.abs(le.x - e.sprite.x) < 10
            && Math.abs(le.y - e.sprite.y) < 10
        );
        return matched?.uid;
      })
      .filter((uid): uid is string => !!uid);

    this.rewindBuffer.push({
      timestamp: Date.now(),
      playerX: this.player.x,
      playerY: this.player.y,
      playerVelocityX: this.player.body?.velocity.x ?? 0,
      playerVelocityY: this.player.body?.velocity.y ?? 0,
      playerHp: this.playerHp,
      deadEnemies: deadUids,
    });
  }

  private _doRewind(): void {
    if (this.pState === "dead" || this.gameOver) return;
    const frame = this.rewindBuffer.rewind(3);
    if (!frame) return;

    // Teleport player
    this.player.setPosition(frame.playerX, frame.playerY);
    this.player.setVelocity(frame.playerVelocityX, frame.playerVelocityY);
    this.playerHp = frame.playerHp;

    // Flash effect
    this.cameras.main.flash(200, 255, 255, 255);

    // Toast
    const toast = this.add.text(W / 2, H / 2 - 60, "⟲ Rewind", {
      fontSize: "32px", color: "#89b4fa", fontStyle: "bold",
      backgroundColor: "#000000cc", padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 800, delay: 300,
      onComplete: () => toast.destroy(),
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Checkpoints & Victory
  // ═════════════════════════════════════════════════════════════════════════

  private checkpointActivated = new Set<string>();

  private _onCheckpoint(e: PlacedEntity): void {
    if (this.checkpointActivated.has(e.uid)) return;
    this.checkpointActivated.add(e.uid);

    // Save game
    const deadUids = this.enemies
      .filter((en) => en.state === "dead")
      .map((en) => {
        const matched = this.level.entities.find(
          (le) => CATALOG_BY_ID[le.assetId]?.category === "enemy"
            && Math.abs(le.x - en.sprite.x) < 10
            && Math.abs(le.y - en.sprite.y) < 10
        );
        return matched?.uid;
      })
      .filter((uid): uid is string => !!uid);

    const slot = createSaveSlot(
      `Checkpoint`,
      "level-1",
      {
        x: e.x, y: e.y,
        hp: this.playerHp,
        maxHp: this.playerStats.maxHp,
      },
      { deadEnemies: deadUids, collectedItems: [], triggeredEvents: [] },
      e.uid,
    );
    saveSlot(slot);

    // Toast
    const toast = this.add.text(W / 2, H / 2 - 60, "Checkpoint atteint — Partie sauvegardée", {
      fontSize: "26px", color: "#44ff44", fontStyle: "bold",
      backgroundColor: "#000000cc", padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1500, delay: 600,
      onComplete: () => toast.destroy(),
    });
  }

  private _onVictory(): void {
    if (this.pState === "dead" || this.gameOver) return;
    this.pState = "dead";
    this.player.setVelocity(0, 0);

    // Show victory overlay via DOM
    const overlay = document.getElementById("victory-overlay");
    if (overlay) {
      overlay.classList.add("visible");
      const resumeBtn = document.getElementById("victory-resume");
      if (resumeBtn) {
        resumeBtn.onclick = () => {
          overlay.classList.remove("visible");
          // Mark level as completed
          completeLevel("level-1");
          // Return to menu
          document.dispatchEvent(new CustomEvent("return-to-menu", { detail: {} }));
        };
      }
    }
  }

  private _returnToEditor(): void {
    this.scene.start("EditorScene");
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HUD refresh
  // ═════════════════════════════════════════════════════════════════════════

  private _refreshHUD(): void {
    this.hpBar.clear();
    const max = this.playerStats.maxHp;
    const bw  = 240;
    const bh  = 20;
    const bx  = W - bw - 20;
    const by  = 70;
    const pct = this.playerHp / max;
    const col = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.hpBar.fillStyle(0x222222); this.hpBar.fillRect(bx, by, bw, bh);
    this.hpBar.fillStyle(col);      this.hpBar.fillRect(bx, by, bw * pct, bh);
    this.hpBar.lineStyle(1, 0x888888); this.hpBar.strokeRect(bx, by, bw, bh);
    for (let i = 1; i < max; i++) {
      this.hpBar.lineStyle(1, 0x444444);
      this.hpBar.lineBetween(bx + (bw / max) * i, by, bx + (bw / max) * i, by + bh);
    }

    const alive = this.enemies.filter(e => e.state !== "dead").length;
    this.dbgState.setText(`HP: ${this.playerHp}/${max}  |  state: ${this.pState}`);
    this.dbgPos.setText(`ennemis: ${alive}/${this.enemies.length}  |  pos: ${this.player.x.toFixed(0)},${this.player.y.toFixed(0)}`);
  }
}

void ASSET_CATALOG;
