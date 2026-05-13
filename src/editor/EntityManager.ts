import Phaser from "phaser";
import { CATALOG_BY_ID, AssetDef, getAssetDefaultSize } from "../level/AssetCatalog";
import { PlacedEntity, LevelData, newUid } from "../level/LevelData";
import { UndoAction, UndoManager } from "../level/UndoManager";

export interface PlacedView {
  data: PlacedEntity;
  obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
  outline: Phaser.GameObjects.Graphics;
}

export class EntityManager {
  private scene: Phaser.Scene;
  private placedViews = new Map<string, PlacedView>();
  private undo = new UndoManager();
  private selectedEntity: string | null = null;
  private multiSelected = new Set<string>();

  onSelect?: (uid: string | null) => void;
  onSpawn?: (view: PlacedView) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getViews(): Map<string, PlacedView> { return this.placedViews; }
  getSelected(): string | null { return this.selectedEntity; }
  getMultiSelected(): Set<string> { return this.multiSelected; }
  getUndoManager(): UndoManager { return this.undo; }

  setSelected(uid: string | null): void {
    this.selectedEntity = uid;
    this.onSelect?.(uid);
  }

  toggleMultiSelect(uid: string): void {
    if (this.multiSelected.has(uid)) this.multiSelected.delete(uid);
    else this.multiSelected.add(uid);
  }

  clearSelection(): void {
    this.selectedEntity = null;
    this.multiSelected.clear();
    this.onSelect?.(null);
  }

  spawn(data: PlacedEntity, activeLayerId?: string): PlacedView {
    const def = CATALOG_BY_ID[data.assetId];
    if (!def) {
      console.warn("Asset inconnu:", data.assetId);
      return null as unknown as PlacedView;
    }

    let obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

    if (def.sourceFrame) {
      const size = getAssetDefaultSize(def);
      const w = data.width ?? size.width;
      const h = data.height ?? size.height;
      const im = this.scene.add.image(data.x, data.y, def.textureKey, def.id).setOrigin(0, 0);
      im.setDisplaySize(w, h);
      obj = im;
    } else if (def.category === "platform" || (def.tileOffsetX !== undefined && def.tileOffsetY !== undefined)) {
      const w = data.width ?? (def.tileOffsetX ? 256 : 192);
      const h = data.height ?? (def.tileOffsetY ? 256 : 96);
      obj = this.scene.add.tileSprite(data.x, data.y, w, h, def.textureKey).setOrigin(0, 0);
      (obj as Phaser.GameObjects.TileSprite).setTilePosition(def.tileOffsetX ?? 0, def.tileOffsetY ?? 0);
    } else if (def.category === "system") {
      // System entities are rendered as shapes, not sprites
      obj = this.scene.add.sprite(data.x, data.y, "__DEFAULT")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(def.defaultWidth ?? 32, def.defaultHeight ?? 32)
        .setAlpha(0.5);
      if (def.id === "checkpoint") obj.setTint(0x44ff44);
      else if (def.id === "victory") obj.setTint(0xffaa00);
    } else {
      obj = this.scene.add.sprite(data.x, data.y, def.textureKey, 0);
      obj.setOrigin(def.originX ?? 0.5, def.originY ?? 1);
      obj.setScale(data.scale);
      obj.setFlipX(data.flipX);
      obj.setFlipY((data as any).flipY ?? false);
      obj.setAngle(data.rotation ?? 0);
      if (data.tint) obj.setTint(Phaser.Display.Color.HexStringToColor(data.tint).color);
      if (def.defaultAnim && (def.category === "enemy" || def.category === "spawn")) {
        (obj as Phaser.GameObjects.Sprite).anims.play(def.defaultAnim.key);
      }
      if (def.category === "spawn") obj.setAlpha(0.7);
    }

    if (def.category === "background" && activeLayerId && !data.backgroundLayerId) {
      data.backgroundLayerId = activeLayerId;
    }

    const outline = this.scene.add.graphics().setDepth(50);
    const view: PlacedView = { data, obj, outline };
    this.placedViews.set(data.uid, view);
    return view;
  }

  destroyView(uid: string): void {
    const v = this.placedViews.get(uid);
    if (!v) return;
    v.obj.destroy();
    v.outline.destroy();
    this.placedViews.delete(uid);
  }

  remove(uid: string, recordUndo = true): PlacedEntity | null {
    const v = this.placedViews.get(uid);
    if (!v) return null;
    if (recordUndo) {
      this.undo.push({ type: "delete", entities: [this.clone(v.data)] });
    }
    this.destroyView(uid);
    this.multiSelected.delete(uid);
    if (this.selectedEntity === uid) {
      this.selectedEntity = null;
      this.onSelect?.(null);
    }
    return v.data;
  }

  upsert(data: PlacedEntity): void {
    this.destroyView(data.uid);
    const copy = this.clone(data);
    this.spawn(copy);
  }

  reloadAll(entities: PlacedEntity[], activeLayerId?: string): void {
    for (const v of Array.from(this.placedViews.values())) {
      v.obj.destroy();
      v.outline.destroy();
    }
    this.placedViews.clear();
    this.multiSelected.clear();
    this.selectedEntity = null;
    this.onSelect?.(null);
    for (const e of entities) this.spawn(e, activeLayerId);
  }

  findAt(x: number, y: number): PlacedView | null {
    let best: PlacedView | null = null;
    let bestArea = Infinity;
    for (const v of Array.from(this.placedViews.values())) {
      const b = v.obj.getBounds();
      if (b.contains(x, y)) {
        const area = b.width * b.height;
        if (area < bestArea) { bestArea = area; best = v; }
      }
    }
    return best;
  }

  applyUndo(action: UndoAction): void {
    if (action.type === "place") {
      for (const e of action.entities) this.destroyView(e.uid);
      return;
    }
    if (action.type === "delete") {
      for (const e of action.entities) this.upsert(e);
      return;
    }
    if (action.previous) {
      for (const e of action.previous) this.upsert(e);
    }
  }

  applyRedo(action: UndoAction): void {
    if (action.type === "delete") {
      for (const e of action.entities) this.destroyView(e.uid);
      return;
    }
    if (action.type === "place") {
      for (const e of action.entities) this.upsert(e);
      return;
    }
    for (const e of action.entities) this.upsert(e);
  }

  clone(entity: PlacedEntity): PlacedEntity {
    return JSON.parse(JSON.stringify(entity)) as PlacedEntity;
  }

  createEntityFromAsset(a: AssetDef, x: number, y: number, activeLayerId?: string): PlacedEntity {
    const newE: PlacedEntity = {
      uid: newUid(a.category[0]),
      assetId: a.id,
      x, y,
      scale: a.defaultScale,
      flipX: false,
      rotation: 0,
    };

    if (a.sourceFrame) {
      const size = getAssetDefaultSize(a);
      newE.width = size.width;
      newE.height = size.height;
      if (a.category === "background") newE.backgroundLayerId = activeLayerId;
    } else if (a.category === "platform") {
      newE.width = 192;
      newE.height = 96;
    } else if (a.category === "enemy") {
      newE.patrolMin = x - 200;
      newE.patrolMax = x + 200;
      newE.hp = 3;
      newE.maxHp = 3;
      newE.damage = 1;
      newE.tint = "#ffffff";
      newE.name = "Ennemi";
    } else if (a.category === "spawn") {
      // Remove existing spawn
      for (const [uid, v] of Array.from(this.placedViews.entries())) {
        if (v.data.assetId === "spawn-player") {
          this.destroyView(uid);
        }
      }
    }

    // Initialise collision box centrée sur l'asset par défaut
    const cw = newE.width ?? 64;
    const ch = newE.height ?? 64;
    newE.collision = {
      enabled: false,
      x: -cw / 2,
      y: -ch / 2,
      width: cw,
      height: ch,
    };

    return newE;
  }

  updateOutlines(selectedUid: string | null): void {
    for (const v of Array.from(this.placedViews.values())) {
      v.outline.clear();
      const b = v.obj.getBounds();
      const def = CATALOG_BY_ID[v.data.assetId];
      const isSel = v.data.uid === selectedUid;
      const isMulti = this.multiSelected.has(v.data.uid);
      const isEnemy = def?.category === "enemy";
      const isSpawn = def?.category === "spawn";
      const isHazard = def?.category === "hazard";

      if (isSel) {
        v.outline.lineStyle(3, 0x44ff88);
        v.outline.strokeRect(b.x - 1, b.y - 1, b.width + 2, b.height + 2);
      } else if (isMulti) {
        v.outline.lineStyle(2, 0xffaa00);
        v.outline.strokeRect(b.x, b.y, b.width, b.height);
      } else if (isEnemy) {
        v.outline.lineStyle(1, 0xff6655, 0.5);
        v.outline.strokeRect(
          (v.data.patrolMin ?? v.data.x - 100), b.y - 6,
          ((v.data.patrolMax ?? v.data.x + 100) - (v.data.patrolMin ?? v.data.x - 100)),
          b.height + 12,
        );
      } else if (isSpawn) {
        v.outline.lineStyle(2, 0xffff00, 0.6);
        v.outline.strokeRect(b.x, b.y, b.width, b.height);
      } else if (isHazard) {
        v.outline.lineStyle(1, 0xff4444, 0.35);
        v.outline.strokeRect(b.x, b.y, b.width, b.height);
      }
    }
  }
}
