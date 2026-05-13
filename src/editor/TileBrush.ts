import { AssetDef, CATALOG_BY_ID } from "../level/AssetCatalog";
import { PlacedEntity, newUid } from "../level/LevelData";

const PLACE_COOLDOWN_MS = 80; // max 12 placements/sec

export class TileBrush {
  active = false;
  selectedAsset: AssetDef | null = null;
  brushSize = 1; // 1x1, 2x2, 3x3
  snapToGrid = true;
  snapPx = 16;

  private lastPlaceTime = 0;
  private placedPositions = new Set<string>(); // "x,y" keys to avoid duplicates

  /** Clear placed cache (call on brush deactivate or mode change) */
  reset(): void {
    this.placedPositions.clear();
    this.lastPlaceTime = 0;
  }

  /**
   * Called every frame while dragging. Returns entities to place at this position.
   * Returns empty array if cooldown hasn't elapsed or position already occupied.
   */
  tick(worldX: number, worldY: number, existingEntities: PlacedEntity[]): PlacedEntity[] {
    if (!this.active || !this.selectedAsset) return [];

    const now = Date.now();
    if (now - this.lastPlaceTime < PLACE_COOLDOWN_MS) return [];
    this.lastPlaceTime = now;

    const snapped = this.snapToGrid
      ? {
          x: Math.round(worldX / this.snapPx) * this.snapPx,
          y: Math.round(worldY / this.snapPx) * this.snapPx,
        }
      : { x: worldX, y: worldY };

    const results: PlacedEntity[] = [];
    const a = this.selectedAsset;
    const def = CATALOG_BY_ID[a.id];
    const tileW = def?.defaultWidth ?? 192;
    const tileH = def?.defaultHeight ?? 96;

    for (let bx = 0; bx < this.brushSize; bx++) {
      for (let by = 0; by < this.brushSize; by++) {
        const px = snapped.x + bx * tileW;
        const py = snapped.y + by * tileH;
        const key = `${px},${py}`;

        // Skip if already placed at this position in this brush session
        if (this.placedPositions.has(key)) continue;

        // Skip if an entity already exists at this position (within tolerance)
        const exists = existingEntities.some(
          (e) => e.assetId === a.id
            && Math.abs(e.x - px) < 4
            && Math.abs(e.y - py) < 4
        );
        if (exists) continue;

        this.placedPositions.add(key);

        const entity: PlacedEntity = {
          uid: newUid("tb"),
          assetId: a.id,
          x: px,
          y: py,
          scale: a.defaultScale,
          width: tileW,
          height: tileH,
          flipX: false,
          rotation: 0,
        };

        results.push(entity);
      }
    }

    return results;
  }
}
