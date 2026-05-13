import Phaser from "phaser";
import { BackgroundShape, BackgroundShapeKind, LevelData, BackgroundLayer } from "../level/LevelData";

const W = 1600;
const H = 900;

export const BG_COLORS = ["#063247", "#07556a", "#0a7f82", "#102a4a", "#031424"];
export const BG_SHAPE_COLORS = ["#9dfff1", "#2ebfc0", "#063247", "#021225", "#ddfff6", "#58d68d"];
export const BG_SHAPE_KINDS: BackgroundShapeKind[] = ["circle", "ellipse", "rect"];

export class BackgroundBuilder {
  private scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private parallaxPreview = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getParallaxPreview(): boolean { return this.parallaxPreview; }
  setParallaxPreview(v: boolean): void { this.parallaxPreview = v; }

  clear(): void {
    for (const obj of this.objects) obj.destroy();
    this.objects = [];
  }

  render(level: LevelData): void {
    this.clear();

    const base = this.scene.add.rectangle(level.worldW / 2, H / 2, level.worldW, H, this._color(level.backgroundColor))
      .setDepth(-130)
      .setScrollFactor(this.parallaxPreview ? 0.05 : 1);
    this.objects.push(base);

    // Trier les layers par depth croissant (plus loin = dessous)
    const sortedLayers = [...level.backgroundLayers].sort((a, b) => a.depth - b.depth);

    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      const shapes = level.backgroundShapes.filter((s) => s.backgroundLayerId === layer.id);
      for (const shape of shapes) {
        this.objects.push(this._drawShape(shape, layer));
      }
    }
  }

  private _color(hex: string): number {
    return Number.parseInt(hex.replace("#", ""), 16);
  }

  private _drawShape(shape: BackgroundShape, layer: BackgroundLayer): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics()
      .setDepth(layer.depth - 6)
      .setScrollFactor(this.parallaxPreview ? layer.parallax : 1);

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
      alpha = alpha * (layer.alpha ?? 1);
    }

    gfx.fillStyle(color, alpha);
    if (shape.kind === "rect") {
      gfx.fillRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.kind === "circle") {
      gfx.fillCircle(shape.x, shape.y, shape.width / 2);
    } else {
      gfx.fillEllipse(shape.x, shape.y, shape.width, shape.height);
    }
    return gfx;
  }

  createShape(
    wx: number, wy: number,
    kind: BackgroundShapeKind,
    color: string,
    layerId: string,
  ): BackgroundShape {
    return {
      id: `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind,
      x: wx, y: wy,
      width: kind === "rect" ? 520 : kind === "ellipse" ? 560 : 320,
      height: kind === "rect" ? 280 : kind === "ellipse" ? 300 : 320,
      color,
      alpha: kind === "rect" ? 0.22 : 0.18,
      backgroundLayerId: layerId,
    };
  }
}
