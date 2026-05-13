import { PlacedEntity, newUid } from "../level/LevelData";

export interface PrefabDef {
  id: string;
  name: string;
  icon: string;
  /** Partial entities — x/y are relative to prefab origin */
  entities: Partial<PlacedEntity>[];
}

interface PrefabFile {
  prefabs: PrefabDef[];
}

let cachedPrefabs: PrefabDef[] | null = null;

export async function loadPrefabs(): Promise<PrefabDef[]> {
  if (cachedPrefabs) return cachedPrefabs;
  try {
    const resp = await fetch("/prefabs/prefabs.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as PrefabFile;
    cachedPrefabs = data.prefabs ?? [];
    return cachedPrefabs;
  } catch {
    console.warn("PrefabManager: Failed to load prefabs.json");
    return [];
  }
}

export function getCachedPrefabs(): PrefabDef[] {
  return cachedPrefabs ?? [];
}

/**
 * Instantiate a prefab at world position (ox, oy).
 * All prefab-relative coords are offset by (ox, oy).
 * Fills in uid, scale, flipX, rotation defaults.
 */
export function instantiatePrefab(
  prefab: PrefabDef,
  ox: number,
  oy: number,
): PlacedEntity[] {
  return prefab.entities.map((e) => ({
    uid: newUid("pf"),
    assetId: e.assetId ?? "",
    x: ox + (e.x ?? 0),
    y: oy + (e.y ?? 0),
    scale: e.scale ?? 1,
    flipX: e.flipX ?? false,
    flipY: (e as any).flipY ?? false,
    rotation: e.rotation ?? 0,
    width: e.width,
    height: e.height,
    name: e.name,
    hp: e.hp,
    maxHp: e.maxHp,
    damage: e.damage,
    patrolMin: e.patrolMin,
    patrolMax: e.patrolMax,
  }));
}
