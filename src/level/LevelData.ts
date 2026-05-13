// Shared level data format for EditorScene and GymScene.

export interface CollisionBox {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedEntity {
  uid: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  rotation: number;           // 0 | 90 | 180 | 270
  width?: number;
  height?: number;
  collision?: CollisionBox;   // hitbox editable
  // Enemy / Entity props
  name?: string;
  hp?: number;
  maxHp?: number;
  damage?: number;
  tint?: string;              // hex color for tint
  patrolMin?: number;
  patrolMax?: number;
  // Background
  backgroundLayerId?: string;
}

export interface BackgroundLayer {
  id: string;
  label: string;
  parallax: number;
  depth: number;
  alpha: number;
  visible: boolean;
  tint?: string; // couleur de sombrification/désaturation (ex: "#555555")
}

export type BackgroundShapeKind = "rect" | "circle" | "ellipse";

export interface BackgroundShape {
  id: string;
  kind: BackgroundShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  backgroundLayerId: string;
}

export interface PlayerStats {
  maxHp: number;
  jumpForce: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldownMs: number;
}

export interface LevelData {
  version: number;
  worldW: number;
  worldH: number;
  backgroundColor: string;
  backgroundLayers: BackgroundLayer[];
  backgroundShapes: BackgroundShape[];
  entities: PlacedEntity[];
  playerStats: PlayerStats;
}

// v6: rotation, collision boxes, enemy name/tint/damage/maxHp, playerStats
export const STORAGE_KEY = "gym-level-v6";

export const DEFAULT_BACKGROUND_LAYERS: BackgroundLayer[] = [
  { id: "sky", label: "Ciel", parallax: 0.02, depth: -125, alpha: 0.08, visible: true, tint: "#0a1a2a" },
  { id: "very-far", label: "Tr\u00e8s loin", parallax: 0.05, depth: -110, alpha: 0.15, visible: true, tint: "#333333" },
  { id: "far", label: "Far", parallax: 0.18, depth: -95, alpha: 0.28, visible: true, tint: "#555555" },
  { id: "mid", label: "Mid", parallax: 0.45, depth: -80, alpha: 0.46, visible: true, tint: "#888888" },
  { id: "near", label: "Near", parallax: 0.72, depth: -65, alpha: 0.72, visible: true, tint: "#bbbbbb" },
  { id: "foreground", label: "Premier plan", parallax: 0.95, depth: -40, alpha: 0.9, visible: true, tint: "#dddddd" },
  { id: "front", label: "Avant-plan", parallax: 1.05, depth: -25, alpha: 0.92, visible: true, tint: "#e0e0e0" },
];

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  maxHp: 8,
  jumpForce: 1040,
  moveSpeed: 320,
  attackDamage: 1,
  attackRange: 144,
  attackCooldownMs: 0,
};

export const DEFAULT_LEVEL: LevelData = {
  version: 6,
  worldW: 3200,
  worldH: 900,
  backgroundColor: "#063247",
  backgroundLayers: JSON.parse(JSON.stringify(DEFAULT_BACKGROUND_LAYERS)) as BackgroundLayer[],
  backgroundShapes: [
    { id: "shape-glow-left", kind: "circle", x: 210, y: 325, width: 720, height: 720, color: "#9dfff1", alpha: 0.28, backgroundLayerId: "far" },
    { id: "shape-glow-center", kind: "ellipse", x: 940, y: 365, width: 620, height: 430, color: "#7cefe5", alpha: 0.14, backgroundLayerId: "far" },
    { id: "shape-mist-low", kind: "rect", x: 0, y: 520, width: 3200, height: 380, color: "#2ebfc0", alpha: 0.18, backgroundLayerId: "far" },
    { id: "shape-trunk-mid", kind: "rect", x: 920, y: -60, width: 170, height: 900, color: "#043745", alpha: 0.42, backgroundLayerId: "mid" },
    { id: "shape-trunk-right", kind: "rect", x: 2590, y: 120, width: 210, height: 780, color: "#052f3b", alpha: 0.38, backgroundLayerId: "mid" },
    { id: "shape-shadow-floor", kind: "rect", x: 0, y: 770, width: 3200, height: 190, color: "#02091a", alpha: 0.76, backgroundLayerId: "near" },
  ],
  entities: [
    { uid: "bg-hill-left", assetId: "hill-tall-mid", x: 70, y: 250, scale: 1, flipX: false, rotation: 0, width: 430, height: 450, backgroundLayerId: "far" },
    { uid: "bg-hill-center", assetId: "hill-tall-right", x: 710, y: 250, scale: 1, flipX: false, rotation: 0, width: 390, height: 570, backgroundLayerId: "far" },
    { uid: "bg-hill-right", assetId: "hill-tall-left", x: 2500, y: 435, scale: 1, flipX: true, rotation: 0, width: 420, height: 480, backgroundLayerId: "far" },
    { uid: "bg-vines-top-left", assetId: "hang-side-leaves", x: -40, y: -170, scale: 1, flipX: false, rotation: 0, width: 250, height: 470, backgroundLayerId: "near" },
    { uid: "bg-vines-top-mid", assetId: "hang-vine-wide", x: 600, y: -210, scale: 1, flipX: false, rotation: 0, width: 210, height: 440, backgroundLayerId: "near" },
    { uid: "bg-vines-top-right", assetId: "hang-curved-leaf", x: 2050, y: -120, scale: 1, flipX: true, rotation: 0, width: 360, height: 230, backgroundLayerId: "near" },
    { uid: "bg-column-center", assetId: "hang-moss-column", x: 890, y: -20, scale: 1, flipX: false, rotation: 0, width: 190, height: 720, backgroundLayerId: "mid" },
    { uid: "bg-column-right", assetId: "hang-moss-column2", x: 2580, y: 190, scale: 1, flipX: false, rotation: 0, width: 220, height: 610, backgroundLayerId: "mid" },

    { uid: "spawn-1", assetId: "spawn-player", x: 385, y: 665, scale: 3.2, flipX: false, rotation: 0 },

    { uid: "p-left-main", assetId: "fp-extra-wide", x: 0, y: 670, scale: 1, flipX: false, rotation: 0, width: 600, height: 190 },
    { uid: "p-center-top", assetId: "fp-wide-top", x: 970, y: 285, scale: 1, flipX: false, rotation: 0, width: 430, height: 176 },
    { uid: "p-center-wall", assetId: "fp-tall-vert", x: 1035, y: 430, scale: 1, flipX: false, rotation: 0, width: 150, height: 420 },
    { uid: "p-right-arch-1", assetId: "fp-wide-mid", x: 1420, y: 360, scale: 1, flipX: false, rotation: 0, width: 470, height: 120 },
    { uid: "p-right-arch-2", assetId: "fp-wide-mid", x: 1840, y: 300, scale: 1, flipX: false, rotation: 0, width: 450, height: 120 },
    { uid: "p-ground-shadow", assetId: "platform-mossy", x: 0, y: 832, scale: 1, flipX: false, rotation: 0, width: 3200, height: 96 },

    { uid: "d-left-grass-1", assetId: "plant5", x: 90, y: 670, scale: 0.46, flipX: false, rotation: 0 },
    { uid: "d-left-grass-2", assetId: "plant7", x: 250, y: 670, scale: 0.42, flipX: true, rotation: 0 },
    { uid: "d-left-flower", assetId: "blueFlower1", x: 610, y: 670, scale: 0.35, flipX: false, rotation: 0 },
    { uid: "d-center-grass", assetId: "plant3", x: 965, y: 832, scale: 0.45, flipX: false, rotation: 0 },
    { uid: "d-right-grass", assetId: "plantWind", x: 2270, y: 832, scale: 0.42, flipX: true, rotation: 0 },
    { uid: "d-right-flower", assetId: "blueFlower2", x: 2420, y: 832, scale: 0.33, flipX: false, rotation: 0 },
  ],
  playerStats: { ...DEFAULT_PLAYER_STATS },
};

export function cloneLevel(level: LevelData): LevelData {
  return JSON.parse(JSON.stringify(level)) as LevelData;
}

function migrateV5Entity(e: any): PlacedEntity {
  return {
    ...e,
    rotation: e.rotation ?? 0,
    collision: e.collision ?? undefined,
    name: e.name ?? undefined,
    maxHp: e.maxHp ?? e.hp ?? 3,
    damage: e.damage ?? 1,
    tint: e.tint ?? undefined,
  };
}

export function ensureLevelDefaults(level: LevelData): LevelData {
  const next = cloneLevel(level);
  next.version = next.version ?? 6;
  next.backgroundColor = next.backgroundColor ?? DEFAULT_LEVEL.backgroundColor;
  // Merge in any missing default layers
  const existingIds = new Set(next.backgroundLayers?.map((l) => l.id) ?? []);
  const mergedLayers = next.backgroundLayers ? [...next.backgroundLayers] : [];
  for (const defLayer of DEFAULT_BACKGROUND_LAYERS) {
    if (!existingIds.has(defLayer.id)) {
      mergedLayers.push({ ...defLayer });
    }
  }
  // Sort by depth so renderer order stays correct
  mergedLayers.sort((a, b) => a.depth - b.depth);
  next.backgroundLayers = mergedLayers;
  next.backgroundShapes = next.backgroundShapes ?? [];
  next.playerStats = next.playerStats ?? { ...DEFAULT_PLAYER_STATS };
  next.entities = (next.entities ?? []).map(migrateV5Entity);
  for (const entity of next.entities) {
    if (entity.assetId.startsWith("hang-") && !entity.backgroundLayerId) entity.backgroundLayerId = "near";
    if (entity.assetId.startsWith("hill-") && !entity.backgroundLayerId) entity.backgroundLayerId = "far";
  }
  return next;
}

export function getBackgroundLayer(level: LevelData, layerId?: string): BackgroundLayer {
  return level.backgroundLayers.find((layer) => layer.id === layerId)
    ?? level.backgroundLayers[1]
    ?? DEFAULT_BACKGROUND_LAYERS[1];
}

export function loadLevel(): LevelData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LevelData;
      if (parsed.version === DEFAULT_LEVEL.version) return ensureLevelDefaults(parsed);
      // Migrate from v5
      if (parsed.version === 5 && parsed.entities) {
        const migrated: LevelData = {
          ...DEFAULT_LEVEL,
          backgroundColor: parsed.backgroundColor ?? DEFAULT_LEVEL.backgroundColor,
          backgroundLayers: parsed.backgroundLayers ?? DEFAULT_LEVEL.backgroundLayers,
          backgroundShapes: parsed.backgroundShapes ?? DEFAULT_LEVEL.backgroundShapes,
          entities: parsed.entities.map(migrateV5Entity),
          playerStats: { ...DEFAULT_PLAYER_STATS },
        };
        return ensureLevelDefaults(migrated);
      }
    }
  } catch (e) {
    console.warn("loadLevel failed:", e);
  }
  return cloneLevel(DEFAULT_LEVEL);
}

export function saveLevel(level: LevelData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
  } catch (e) {
    console.warn("saveLevel failed:", e);
  }
}

export function resetLevel(): LevelData {
  localStorage.removeItem(STORAGE_KEY);
  return cloneLevel(DEFAULT_LEVEL);
}

export function newUid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function autoSave(level: LevelData): void {
  saveLevel(level);
}

export function exportLevel(level: LevelData): void {
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `level-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLevel(): Promise<LevelData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("No file"));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as LevelData;
          if ((parsed.version === DEFAULT_LEVEL.version || parsed.version === 5) && parsed.entities) {
            resolve(ensureLevelDefaults(parsed));
          } else {
            reject(new Error("Invalid level format"));
          }
        } catch {
          reject(new Error("Invalid JSON"));
        }
      };
      reader.onerror = () => reject(new Error("Read error"));
      reader.readAsText(file);
    };
    input.click();
  });
}
