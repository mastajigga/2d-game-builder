import { EditorMode, emitEditorEvent, onEditorEvent } from "./EditorBridge";

const MODES: Array<{ mode: EditorMode; label: string; color: string; hint: string }> = [
  { mode: "stage", label: "Stage", color: "#44ff88", hint: "S" },
  { mode: "entity", label: "Entities", color: "#ffaa44", hint: "E" },
  { mode: "background", label: "BG", color: "#8df5e8", hint: "B" },
  { mode: "collision", label: "Coll", color: "#ff4444", hint: "H" },
  { mode: "select", label: "Select", color: "#44aaff", hint: "V" },
  { mode: "delete", label: "Delete", color: "#ff4444", hint: "Del" },
  { mode: "pan", label: "Pan", color: "#ffaa44", hint: "Space" },
];

export class ToolbarUI {
  private root: HTMLElement;
  private modeButtons = new Map<EditorMode, HTMLButtonElement>();
  private currentMode: EditorMode = "stage";
  private unsubscribers: Array<() => void> = [];

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`ToolbarUI: #${containerId} not found`);

    this._buildModes();
    this._buildSeparator();
    this._buildActions();

    // Listen to mode changes from scene (keyboard shortcuts, etc.)
    this.unsubscribers.push(
      onEditorEvent("set-mode", (evt) => {
        this._setMode(evt.detail.mode);
      })
    );
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  private _buildModes(): void {
    const group = document.createElement("div");
    group.className = "toolbar-group modes";

    for (const m of MODES) {
      const btn = document.createElement("button");
      btn.className = `toolbar-btn mode-btn ${m.mode === this.currentMode ? "active" : ""}`;
      btn.style.setProperty("--mode-color", m.color);
      btn.innerHTML = `<span class="mode-label">${m.label}</span><span class="mode-hint">${m.hint}</span>`;
      btn.addEventListener("click", () => {
        emitEditorEvent("set-mode", { mode: m.mode });
        this._setMode(m.mode);
      });
      this.modeButtons.set(m.mode, btn);
      group.appendChild(btn);
    }

    this.root.appendChild(group);
  }

  private _buildSeparator(): void {
    const sep = document.createElement("div");
    sep.className = "toolbar-separator";
    this.root.appendChild(sep);
  }

  private _buildActions(): void {
    const group = document.createElement("div");
    group.className = "toolbar-group actions";

    const addBtn = (icon: string, title: string, onClick: () => void, extraClass = "") => {
      const btn = document.createElement("button");
      btn.className = `toolbar-btn action-btn ${extraClass}`;
      btn.title = title;
      btn.innerHTML = icon;
      btn.addEventListener("click", onClick);
      group.appendChild(btn);
      return btn;
    };

    addBtn("💾", "Sauvegarder (Ctrl+S)", () => emitEditorEvent("save-level", {}));
    addBtn("↩", "Undo (Ctrl+Z)", () => emitEditorEvent("trigger-undo", {}));
    addBtn("↪", "Redo (Ctrl+Y)", () => emitEditorEvent("trigger-redo", {}));
    this._buildSeparator();
    addBtn("⬆", "Exporter (Ctrl+E)", () => emitEditorEvent("export-level", {}));
    addBtn("⬇", "Importer (Ctrl+I)", () => emitEditorEvent("import-level", {}));
    this._buildSeparator();
    addBtn("🔍+", "Zoom In", () => emitEditorEvent("zoom", { direction: "in" }));
    addBtn("🔍−", "Zoom Out", () => emitEditorEvent("zoom", { direction: "out" }));
    addBtn("🔍", "Zoom Reset", () => emitEditorEvent("zoom", { direction: "reset" }));
    this._buildSeparator();
    addBtn("⊞", "Toggle Grid (G)", () => emitEditorEvent("toggle-grid", {}));
    addBtn("▶", "Playtest (Tab)", () => emitEditorEvent("playtest", {}));
    addBtn("🧪", "Test Runner (T)", () => emitEditorEvent("toggle-test-runner", {}));
    addBtn("⚙", "World Settings", () => emitEditorEvent("toggle-world-settings", {}));
    addBtn("🧩", "Prefabs", () => emitEditorEvent("prefab-toggle", {}));

    this.root.appendChild(group);
  }

  private _setMode(mode: EditorMode): void {
    this.currentMode = mode;
    this.modeButtons.forEach((btn, m) => {
      btn.classList.toggle("active", m === mode);
    });
  }
}
