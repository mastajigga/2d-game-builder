import Phaser from "phaser";
import { ASSET_CATALOG, AssetDef, getAssetDefaultSize } from "../level/AssetCatalog";

const H = 900;
const PALETTE_W = 320;
const PALETTE_TILE = 96;
const PALETTE_PAD = 10;

export class PaletteManager {
  private container!: Phaser.GameObjects.Container;
  private scrollContent!: Phaser.GameObjects.Container;
  private items: Phaser.GameObjects.Container[] = [];
  private totalHeight = 0;
  private selectedAsset: AssetDef | null = null;
  private onSelect?: (asset: AssetDef) => void;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    const bg = scene.add.rectangle(PALETTE_W / 2, H / 2, PALETTE_W, H, 0x000000, 0.88);
    bg.setStrokeStyle(2, 0x44aaff, 0.6);
    this.container.add(bg);

    const title = scene.add.text(PALETTE_PAD, 8, "PALETTE", {
      fontSize: "20px", color: "#44aaff", fontStyle: "bold",
    });
    this.container.add(title);

    this.scrollContent = scene.add.container(0, 0);
    this.container.add(this.scrollContent);

    this._buildItems();

    // Mask
    const maskShape = scene.make.graphics();
    maskShape.fillRect(0, 0, PALETTE_W, H);
    this.container.setMask(maskShape.createGeometryMask());

    // Scroll wheel
    scene.input.on("wheel", (pointer: Phaser.Input.Pointer, _o: unknown, _dx: unknown, dy: number, _dz: unknown) => {
      if (pointer.x > PALETTE_W) return;
      const maxScroll = Math.max(0, this.totalHeight - H + 30);
      this.scrollContent.y = Phaser.Math.Clamp(this.scrollContent.y - dy, -maxScroll, 0);
    });
  }

  setOnSelect(cb: (asset: AssetDef) => void): void {
    this.onSelect = cb;
  }

  getSelected(): AssetDef | null { return this.selectedAsset; }

  clearSelection(): void {
    this.selectedAsset = null;
    for (const it of this.items) {
      const bg = it.getData("bg") as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(1, 0x444444);
    }
  }

  private _buildItems(): void {
    let y = 26;
    const cats: Array<{ label: string; filter: (a: AssetDef) => boolean }> = [
      { label: "Fond", filter: (a) => a.category === "background" },
      { label: "\u25a3 Plateformes", filter: (a) => a.category === "platform" },
      { label: "\u273f D\u00e9cor", filter: (a) => a.category === "decoration" },
      { label: "\u2620 Hazards", filter: (a) => a.category === "hazard" },
      { label: "\u2620 Ennemis", filter: (a) => a.category === "enemy" },
      { label: "\u2605 Spawn", filter: (a) => a.category === "spawn" },
    ];

    for (const c of cats) {
      const header = this.scene.add.text(PALETTE_PAD, y, c.label, {
        fontSize: "17px", color: "#ffaa00",
      });
      this.scrollContent.add(header);
      y += 16;

      const items = ASSET_CATALOG.filter(c.filter);
      let col = 0;

      for (const a of items) {
        const itemX = PALETTE_PAD + col * (PALETTE_TILE + PALETTE_PAD);
        const itemY = y;

        const itemBg = this.scene.add.rectangle(
          itemX + PALETTE_TILE / 2, itemY + PALETTE_TILE / 2,
          PALETTE_TILE, PALETTE_TILE, 0x222222,
        ).setStrokeStyle(1, 0x444444);
        itemBg.setInteractive({ useHandCursor: true });
        itemBg.on("pointerdown", () => this._select(a));

        const cx = itemX + PALETTE_TILE / 2;
        const cy = itemY + PALETTE_TILE / 2;
        const maxDim = PALETTE_TILE - 18;
        let thumb: Phaser.GameObjects.GameObject;

        if (a.sourceFrame) {
          const sp = this.scene.add.image(cx, cy - 4, a.textureKey, a.id).setOrigin(0.5);
          sp.setScale(Math.min(maxDim / a.sourceFrame.w, (maxDim - 4) / a.sourceFrame.h));
          thumb = sp;
        } else if (a.category === "platform") {
          const ts = this.scene.add.tileSprite(cx, cy - 4, maxDim, maxDim - 4, a.textureKey);
          ts.setOrigin(0.5, 0.5);
          ts.setTilePosition(a.tileOffsetX ?? 0, a.tileOffsetY ?? 0);
          thumb = ts;
        } else if (a.sheetPath && a.frameW && a.frameH) {
          const sp = this.scene.add.sprite(cx, cy - 4, a.textureKey, 0).setOrigin(0.5);
          sp.setScale(Math.min(maxDim / a.frameW, maxDim / a.frameH));
          thumb = sp;
        } else if (a.tileOffsetX || a.tileOffsetY) {
          const ts = this.scene.add.tileSprite(cx, cy - 4, maxDim, maxDim - 4, a.textureKey);
          ts.setOrigin(0.5, 0.5);
          ts.setTilePosition(a.tileOffsetX ?? 0, a.tileOffsetY ?? 0);
          thumb = ts;
        } else {
          const sp = this.scene.add.image(cx, cy - 4, a.textureKey).setOrigin(0.5);
          sp.setScale(Math.min(maxDim / sp.width, maxDim / sp.height));
          thumb = sp;
        }

        const lbl = this.scene.add.text(cx, itemY + PALETTE_TILE - 2,
          a.label.slice(0, 11), { fontSize: "12px", color: "#ffffff" },
        ).setOrigin(0.5, 1);

        const itemContainer = this.scene.add.container(0, 0, [itemBg, thumb as Phaser.GameObjects.Image, lbl]);
        itemContainer.setData("assetId", a.id);
        itemContainer.setData("bg", itemBg);
        this.items.push(itemContainer);
        this.scrollContent.add(itemContainer);

        col++;
        if (col >= 3) { col = 0; y += PALETTE_TILE + PALETTE_PAD; }
      }
      if (col > 0) y += PALETTE_TILE + PALETTE_PAD;
      y += 6;
    }

    this.totalHeight = y;
  }

  private _select(a: AssetDef): void {
    this.selectedAsset = a;
    for (const it of this.items) {
      const bg = it.getData("bg") as Phaser.GameObjects.Rectangle;
      const isSel = it.getData("assetId") === a.id;
      bg.setStrokeStyle(isSel ? 2 : 1, isSel ? 0x44ff88 : 0x444444);
    }
    this.onSelect?.(a);
  }
}
