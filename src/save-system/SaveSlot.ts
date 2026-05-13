export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface WorldState {
  deadEnemies: string[];       // uid des ennemis tués
  collectedItems: string[];    // uid des items ramassés
  triggeredEvents: string[];   // uid des événements déjà déclenchés
}

export interface SaveSlot {
  id: string;                  // "slot-0" à "slot-4" ou timestamp
  createdAt: number;           // timestamp
  label: string;               // nom lisible (ex: "Niveau 1 — Checkpoint 3")
  levelName: string;           // identifiant du niveau
  checkpointId?: string;       // uid du checkpoint atteint
  playerState: PlayerState;
  worldState: WorldState;
  playTimeMs?: number;         // durée de jeu cumulée
}

// ─── Validation ──────────────────────────────────────────────────────────────

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

export function validateSaveSlot(data: unknown): SaveSlot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (!isString(d.id)) return null;
  if (!isNumber(d.createdAt)) return null;
  if (!isString(d.label)) return null;
  if (!isString(d.levelName)) return null;

  const ps = d.playerState;
  if (!ps || typeof ps !== "object") return null;
  const p = ps as Record<string, unknown>;
  if (!isNumber(p.x) || !isNumber(p.y) || !isNumber(p.hp) || !isNumber(p.maxHp)) return null;

  const ws = d.worldState;
  if (!ws || typeof ws !== "object") return null;
  const w = ws as Record<string, unknown>;
  if (!isStringArray(w.deadEnemies)) return null;
  if (!isStringArray(w.collectedItems)) return null;
  if (!isStringArray(w.triggeredEvents)) return null;

  return {
    id: d.id,
    createdAt: d.createdAt,
    label: d.label,
    levelName: d.levelName,
    checkpointId: d.checkpointId as string | undefined,
    playerState: { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp },
    worldState: {
      deadEnemies: w.deadEnemies as string[],
      collectedItems: w.collectedItems as string[],
      triggeredEvents: w.triggeredEvents as string[],
    },
    playTimeMs: isNumber(d.playTimeMs) ? d.playTimeMs : undefined,
  };
}
