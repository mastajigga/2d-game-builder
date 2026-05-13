import Phaser from "phaser";
import { CATALOG_BY_ID } from "../level/AssetCatalog";
import { PlacedEntity, PlayerStats, getBackgroundLayer, LevelData } from "../level/LevelData";

const W = 1600;

export class PropertiesPanel {
  private container!: Phaser.GameObjects.Container;
  private fieldsContainer!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private onChange?: (entity: PlacedEntity) => void;
  private onPlayerStatsChange?: (stats: PlayerStats) => void;
  private currentEntity: PlacedEntity | null = null;
  private currentLevel: LevelData | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(W - 240, 60).setDepth(1001).setScrollFactor(0).setVisible(false);

    const bg = scene.add.rectangle(120, 200, 240, 400, 0x000000, 0.85).setStrokeStyle(1, 0x666666);
    this.container.add(bg);

    this.title = scene.add.text(10, 10, "Propriétés", {
      fontSize: "18px", color: "#44ff88", fontStyle: "bold",
    });
    this.container.add(this.title);

    this.fieldsContainer = scene.add.container(0, 0);
    this.container.add(this.fieldsContainer);

    // Player stats button
    const psBtn = scene.add.rectangle(120, 340, 200, 26, 0x223322).setStrokeStyle(1, 0x44aa44);
    const psTxt = scene.add.text(120, 340, "Stats Joueur", { fontSize: "13px", color: "#88ff88" }).setOrigin(0.5);
    psBtn.setInteractive({ useHandCursor: true });
    psBtn.on("pointerdown", () => this.showPlayerStatsPrompt());
    this.container.add([psBtn, psTxt]);

    // OK / Close button
    const okBtn = scene.add.rectangle(120, 372, 200, 26, 0x333333).setStrokeStyle(1, 0x888888);
    const okTxt = scene.add.text(120, 372, "OK", { fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on("pointerdown", () => this.hide());
    this.container.add([okBtn, okTxt]);
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  isPointInside(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    // Zone fixe du panel : container.x=1360, y=60, taille 240x400
    const px = this.container.x;
    const py = this.container.y;
    return screenX >= px && screenX <= px + 240 && screenY >= py && screenY <= py + 400;
  }

  setOnChange(cb: (entity: PlacedEntity) => void): void {
    this.onChange = cb;
  }

  setOnPlayerStatsChange(cb: (stats: PlayerStats) => void): void {
    this.onPlayerStatsChange = cb;
  }

  showEntity(entity: PlacedEntity, level: LevelData): void {
    this.currentEntity = entity;
    this.currentLevel = level;
    this.container.setVisible(true);
    const def = CATALOG_BY_ID[entity.assetId];
    this.title.setText(def?.label ?? "Inconnu");

    this.fieldsContainer.removeAll(true);

    let y = 40;
    const addField = (label: string, value: string) => {
      const t = this.scene.add.text(15, y, `${label}: ${value}`, { fontSize: "15px", color: "#cccccc" });
      this.fieldsContainer.add(t);
      y += 22;
      return t;
    };

    const addNum = (
      label: string,
      getter: () => number,
      setter: (v: number) => void,
      min: number,
      max: number,
      step: number,
    ) => {
      const row = this.scene.add.container(15, y);
      const lbl = this.scene.add.text(0, 0, `${label}:`, { fontSize: "15px", color: "#cccccc" }).setOrigin(0, 0.5);
      const minus = this.scene.add.rectangle(100, 0, 20, 18, 0x333333).setStrokeStyle(1, 0x555555);
      const minusTxt = this.scene.add.text(100, 0, "-", { fontSize: "14px", color: "#ff8888" }).setOrigin(0.5);
      const valTxt = this.scene.add.text(130, 0, getter().toFixed(step < 1 ? 2 : 0), { fontSize: "14px", color: "#ffffff" }).setOrigin(0.5);
      const plus = this.scene.add.rectangle(160, 0, 20, 18, 0x333333).setStrokeStyle(1, 0x555555);
      const plusTxt = this.scene.add.text(160, 0, "+", { fontSize: "14px", color: "#88ff88" }).setOrigin(0.5);

      minus.setInteractive({ useHandCursor: true });
      plus.setInteractive({ useHandCursor: true });
      minus.on("pointerdown", () => {
        const v = Math.max(min, getter() - step);
        setter(v);
        valTxt.setText(v.toFixed(step < 1 ? 2 : 0));
        this.onChange?.(this.currentEntity!);
      });
      plus.on("pointerdown", () => {
        const v = Math.min(max, getter() + step);
        setter(v);
        valTxt.setText(v.toFixed(step < 1 ? 2 : 0));
        this.onChange?.(this.currentEntity!);
      });

      row.add([lbl, minus, minusTxt, valTxt, plus, plusTxt]);
      this.fieldsContainer.add(row);
      y += 24;
    };

    const addEditable = (label: string, getter: () => string, setter: (v: string) => void) => {
      const t = this.scene.add.text(15, y, `${label}: ${getter()} [edit]`, { fontSize: "15px", color: "#88ccff" });
      t.setInteractive({ useHandCursor: true });
      t.on("pointerdown", () => {
        const n = prompt(`${label}:`, getter());
        if (n !== null) { setter(n); t.setText(`${label}: ${n} [edit]`); this.onChange?.(this.currentEntity!); }
      });
      this.fieldsContainer.add(t);
      y += 22;
      return t;
    };

    addField("UID", entity.uid.slice(0, 18));
    addField("Position", `${entity.x}, ${entity.y}`);

    addNum("Rot", () => entity.rotation ?? 0, (v) => {
      entity.rotation = v;
      if (entity.collision?.enabled) {
        const cw = entity.collision.width;
        const ch = entity.collision.height;
        entity.collision.width = ch;
        entity.collision.height = cw;
      }
    }, 0, 270, 90);
    addNum("Scale", () => entity.scale, (v) => { entity.scale = v; }, 0.1, 5, 0.1);

    if (def?.category === "enemy") {
      addEditable("Nom", () => entity.name ?? "", (v) => { entity.name = v; });
      addNum("HP", () => entity.hp ?? 3, (v) => { entity.hp = v; }, 1, 50, 1);
      addNum("Max HP", () => entity.maxHp ?? 3, (v) => { entity.maxHp = v; }, 1, 50, 1);
      addNum("Dégâts", () => entity.damage ?? 1, (v) => { entity.damage = v; }, 1, 20, 1);
      addEditable("Teinte", () => entity.tint ?? "#ffffff", (v) => { entity.tint = v; });
      addField("Patrol", `${entity.patrolMin ?? 0} — ${entity.patrolMax ?? 0}`);
    }

    if (def?.category === "background") {
      const layer = getBackgroundLayer(level, entity.backgroundLayerId);
      addField("Layer", `${layer.label} (${layer.parallax.toFixed(2)})`);

      // Bouton cycle layer
      const layerBtn = this.scene.add.rectangle(130, y, 180, 22, 0x333344).setStrokeStyle(1, 0x6666aa);
      const layerBtnTxt = this.scene.add.text(130, y, "Changer Layer", { fontSize: "12px", color: "#aaaaff" }).setOrigin(0.5);
      layerBtn.setInteractive({ useHandCursor: true });
      layerBtn.on("pointerdown", () => {
        const layers = level.backgroundLayers;
        const idx = layers.findIndex((l) => l.id === entity.backgroundLayerId);
        const next = layers[(idx + 1) % layers.length];
        entity.backgroundLayerId = next.id;
        this.showEntity(entity, level);
        this.onChange?.(entity);
      });
      this.fieldsContainer.add([layerBtn, layerBtnTxt]);
      y += 28;
    }

    if (def?.sourceFrame || def?.category === "platform" || def?.category === "decoration" || def?.category === "hazard") {
      addNum("W", () => entity.width ?? 192, (v) => { entity.width = v; }, 16, 2000, 16);
      addNum("H", () => entity.height ?? 96, (v) => { entity.height = v; }, 16, 2000, 16);
    }

    // Collision box editor
    if (entity.collision) {
      const coll = entity.collision;
      // Toggle ON/OFF
      const toggleBtn = this.scene.add.rectangle(130, y, 180, 22, coll.enabled ? 0x224422 : 0x442222).setStrokeStyle(1, coll.enabled ? 0x44aa44 : 0xaa4444);
      const toggleTxt = this.scene.add.text(130, y, coll.enabled ? "Collision ON" : "Collision OFF", { fontSize: "12px", color: coll.enabled ? "#88ff88" : "#ff8888" }).setOrigin(0.5);
      toggleBtn.setInteractive({ useHandCursor: true });
      toggleBtn.on("pointerdown", () => {
        coll.enabled = !coll.enabled;
        this.showEntity(entity, level);
        this.onChange?.(entity);
      });
      this.fieldsContainer.add([toggleBtn, toggleTxt]);
      y += 28;

      if (coll.enabled) {
        addNum("Col X", () => coll.x, (v) => { coll.x = v; }, -500, 500, 1);
        addNum("Col Y", () => coll.y, (v) => { coll.y = v; }, -500, 500, 1);
        addNum("Col W", () => coll.width, (v) => { coll.width = v; }, 1, 2000, 1);
        addNum("Col H", () => coll.height, (v) => { coll.height = v; }, 1, 2000, 1);
      }
    } else {
      // Bouton activer collision
      const actBtn = this.scene.add.rectangle(130, y, 180, 22, 0x333344).setStrokeStyle(1, 0x6666aa);
      const actTxt = this.scene.add.text(130, y, "Activer Collision", { fontSize: "12px", color: "#aaaaff" }).setOrigin(0.5);
      actBtn.setInteractive({ useHandCursor: true });
      actBtn.on("pointerdown", () => {
        entity.collision = { enabled: true, x: 0, y: 0, width: entity.width ?? 64, height: entity.height ?? 64 };
        this.showEntity(entity, level);
        this.onChange?.(entity);
      });
      this.fieldsContainer.add([actBtn, actTxt]);
      y += 28;
    }

    if (entity.flipX) addField("Flip", "Horizontal ✓");
  }

  showPlayerStatsPrompt(): void {
    const level = this.currentLevel;
    if (!level) return;
    const stats = level.playerStats;
    const maxHp = prompt("Max HP joueur:", String(stats.maxHp));
    if (maxHp !== null) stats.maxHp = Math.max(1, Number.parseInt(maxHp, 10) || stats.maxHp);
    const jump = prompt("Jump Force:", String(stats.jumpForce));
    if (jump !== null) stats.jumpForce = Math.max(100, Number.parseInt(jump, 10) || stats.jumpForce);
    const speed = prompt("Move Speed:", String(stats.moveSpeed));
    if (speed !== null) stats.moveSpeed = Math.max(50, Number.parseInt(speed, 10) || stats.moveSpeed);
    const dmg = prompt("Attack Damage:", String(stats.attackDamage));
    if (dmg !== null) stats.attackDamage = Math.max(1, Number.parseInt(dmg, 10) || stats.attackDamage);
    const range = prompt("Attack Range:", String(stats.attackRange));
    if (range !== null) stats.attackRange = Math.max(10, Number.parseInt(range, 10) || stats.attackRange);
    this.onPlayerStatsChange?.(stats);
  }

  hide(): void {
    this.container.setVisible(false);
    this.currentEntity = null;
    this.currentLevel = null;
  }
}
