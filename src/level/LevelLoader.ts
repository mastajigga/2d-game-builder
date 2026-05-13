import type { LevelData } from "./LevelData";

export interface LevelMeta {
  id: string;
  name: string;
  unlockCondition: string;
}

// ─── Level Index ─────────────────────────────────────────────────────────────

let cachedIndex: LevelMeta[] | null = null;

export async function loadLevelIndex(): Promise<LevelMeta[]> {
  if (cachedIndex) return cachedIndex;
  try {
    const resp = await fetch("/levels/level-index.json");
    const data = await resp.json() as { levels?: LevelMeta[] };
    cachedIndex = data.levels ?? [];
    return cachedIndex;
  } catch {
    console.warn("LevelLoader: Failed to load level index");
    return [];
  }
}

// ─── Level Data ──────────────────────────────────────────────────────────────

const levelCache = new Map<string, LevelData>();

export function getCachedLevel(id: string): LevelData | undefined {
  return levelCache.get(id);
}

export async function loadLevel(id: string): Promise<LevelData | null> {
  // Check cache first
  if (levelCache.has(id)) return levelCache.get(id)!;

  try {
    const resp = await fetch(`/levels/${id}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as LevelData;
    levelCache.set(id, data);
    return data;
  } catch {
    console.warn(`LevelLoader: Failed to load ${id}.json`);
    return null;
  }
}

// ─── Progression ─────────────────────────────────────────────────────────────

const PROGRESS_KEY = "oakwoods-progress";

export function getCompletedLevels(): string[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw).completedLevels ?? [];
  } catch { /* ignore */ }
  return [];
}

export function completeLevel(id: string): void {
  const completed = getCompletedLevels();
  if (!completed.includes(id)) {
    completed.push(id);
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ completedLevels: completed }));
    } catch { /* ignore */ }
  }
}

export function getUnlockedLevels(index: LevelMeta[]): string[] {
  const completed = getCompletedLevels();
  const unlocked: string[] = [];

  for (const meta of index) {
    if (meta.unlockCondition === "start") {
      unlocked.push(meta.id);
    } else if (meta.unlockCondition.startsWith("complete:")) {
      const req = meta.unlockCondition.replace("complete:", "");
      if (completed.includes(req)) {
        unlocked.push(meta.id);
      }
    }
  }

  return unlocked;
}
