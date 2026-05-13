export interface GameStateFrame {
  timestamp: number;
  playerX: number;
  playerY: number;
  playerVelocityX: number;
  playerVelocityY: number;
  playerHp: number;
  deadEnemies: string[];
}

const BUFFER_SIZE = 180; // ~3 seconds at 60fps

export class RewindBuffer {
  private frames: GameStateFrame[] = [];
  private writeIndex = 0;
  private count = 0;

  push(state: GameStateFrame): void {
    this.frames[this.writeIndex] = state;
    this.writeIndex = (this.writeIndex + 1) % BUFFER_SIZE;
    if (this.count < BUFFER_SIZE) this.count++;
  }

  /**
   * Rewind to the state that was captured approximately `seconds` ago.
   * Returns null if buffer is empty or not enough history.
   */
  rewind(seconds: number): GameStateFrame | null {
    if (this.count === 0) return null;

    const targetTime = Date.now() - seconds * 1000;
    const startIdx = (this.writeIndex - this.count + BUFFER_SIZE) % BUFFER_SIZE;

    // Linear scan from oldest to newest to find the closest frame
    let best: GameStateFrame | null = null;
    let bestDiff = Infinity;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIdx + i) % BUFFER_SIZE;
      const frame = this.frames[idx];
      if (!frame) continue;
      const diff = Math.abs(frame.timestamp - targetTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = frame;
      }
    }

    return best;
  }

  clear(): void {
    this.frames = [];
    this.writeIndex = 0;
    this.count = 0;
  }

  getCount(): number {
    return this.count;
  }
}
