import { SaveSlot, PlayerState, WorldState, validateSaveSlot } from "./SaveSlot";

const STORAGE_KEY = "oakwoods-saves-v1";
const MAX_SLOTS = 5;

// ─── Core API ─────────────────────────────────────────────────────────────────

export function getAllSlots(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateSaveSlot)
      .filter((s): s is SaveSlot => s !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function getSlot(id: string): SaveSlot | null {
  return getAllSlots().find((s) => s.id === id) ?? null;
}

export function saveSlot(slot: SaveSlot): void {
  const slots = getAllSlots();
  // Remove existing slot with same ID
  const filtered = slots.filter((s) => s.id !== slot.id);
  // Prepend new slot (most recent first)
  filtered.unshift(slot);
  // Trim to max
  const trimmed = filtered.slice(0, MAX_SLOTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
    console.warn("SaveManager: Failed to write to localStorage");
  }
}

export function deleteSlot(id: string): void {
  const slots = getAllSlots().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch { /* ignore */ }
}

export function hasSaves(): boolean {
  return getAllSlots().length > 0;
}

export function getLatestSlot(): SaveSlot | null {
  const slots = getAllSlots();
  return slots.length > 0 ? slots[0] : null;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let slotCounter = Date.now();

export function createSaveSlot(
  label: string,
  levelName: string,
  playerState: PlayerState,
  worldState: WorldState,
  checkpointId?: string,
  playTimeMs?: number,
): SaveSlot {
  return {
    id: `slot-${++slotCounter}`,
    createdAt: Date.now(),
    label,
    levelName,
    checkpointId,
    playerState: { ...playerState },
    worldState: {
      deadEnemies: [...worldState.deadEnemies],
      collectedItems: [...worldState.collectedItems],
      triggeredEvents: [...worldState.triggeredEvents],
    },
    playTimeMs,
  };
}
