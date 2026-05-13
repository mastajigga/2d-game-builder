// Undo/Redo manager for the level editor.
// Usage: push action on every user operation (place, delete, move, modify).
// Ctrl+Z pops from undo stack, Ctrl+Y pops from redo stack.

import type { PlacedEntity } from "./LevelData";

export interface UndoAction {
  type: "place" | "delete" | "move" | "modify" | "batch";
  entities: PlacedEntity[];     // entities affected (current state for place, previous for delete/modify)
  previous?: PlacedEntity[];    // state before modification (for move/modify/batch delete)
}

const MAX_UNDO = 100;

export class UndoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];

  push(action: UndoAction): void {
    this.undoStack.push(action);
    this.redoStack = [];  // new branch clears redo
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): UndoAction | null {
    const a = this.undoStack.pop() ?? null;
    if (a) this.redoStack.push(a);
    return a;
  }

  redo(): UndoAction | null {
    const a = this.redoStack.pop() ?? null;
    if (a) this.undoStack.push(a);
    return a;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
