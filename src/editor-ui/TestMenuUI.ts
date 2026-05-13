import { emitEditorEvent } from "./EditorBridge";

export type TestType = "jump" | "attack" | "patrol" | "collision" | null;

export interface TestConfig {
  autoRun: boolean;
  showHitboxes: boolean;
  showPatrolZones: boolean;
}

const STORAGE_KEY = "oakwoods-test-config";

export class TestMenuUI {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private visible = false;
  private config: TestConfig;

  constructor(containerId: string, overlayId: string) {
    this.root = document.getElementById(containerId)!;
    this.overlay = document.getElementById(overlayId)!;
    if (!this.root) throw new Error(`TestMenuUI: #${containerId} not found`);
    if (!this.overlay) throw new Error(`TestMenuUI: #${overlayId} not found`);

    // Load persisted config
    this.config = this._loadConfig();
    this._build();
    this._syncToggles();

    // Close on overlay click
    this.overlay.addEventListener("click", () => this.hide());

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.visible) this.hide();
    });
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add("visible");
    this.root.classList.add("visible");
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove("visible");
    this.root.classList.remove("visible");
  }

  isVisible(): boolean {
    return this.visible;
  }

  getConfig(): TestConfig {
    return { ...this.config };
  }

  // ───────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.root.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.className = "test-menu-title";
    title.textContent = "TEST MENU";
    this.root.appendChild(title);

    // Test actions
    const actions = document.createElement("div");
    actions.className = "test-menu-actions";

    const tests: Array<{ label: string; type: TestType }> = [
      { label: "▶ Test de saut", type: "jump" },
      { label: "▶ Test d'attaque", type: "attack" },
      { label: "▶ Test de patrouille", type: "patrol" },
      { label: "▶ Test de collision", type: "collision" },
    ];

    for (const t of tests) {
      const btn = document.createElement("button");
      btn.className = "test-btn";
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        emitEditorEvent("run-test", { type: t.type });
      });
      actions.appendChild(btn);
    }

    this.root.appendChild(actions);

    // Toggles
    const toggles = document.createElement("div");
    toggles.className = "test-menu-toggles";

    const toggleDefs: Array<{
      key: keyof TestConfig;
      label: string;
    }> = [
      { key: "autoRun", label: "Auto-run on load" },
      { key: "showHitboxes", label: "Show hitboxes" },
      { key: "showPatrolZones", label: "Show patrol zones" },
    ];

    for (const td of toggleDefs) {
      const row = document.createElement("div");
      row.className = "test-toggle-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `test-toggle-${td.key}`;
      input.checked = this.config[td.key];
      input.addEventListener("change", () => {
        this.config[td.key] = input.checked;
        this._saveConfig();
        emitEditorEvent("test-toggle", {
          key: td.key,
          value: input.checked,
        });
      });

      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = td.label;

      row.appendChild(input);
      row.appendChild(label);
      toggles.appendChild(row);
    }

    this.root.appendChild(toggles);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "test-menu-close";
    closeBtn.textContent = "Fermer";
    closeBtn.addEventListener("click", () => this.hide());
    this.root.appendChild(closeBtn);
  }

  private _syncToggles(): void {
    for (const key of ["autoRun", "showHitboxes", "showPatrolZones"] as const) {
      const el = document.getElementById(`test-toggle-${key}`) as HTMLInputElement;
      if (el) el.checked = this.config[key];
    }
  }

  private _loadConfig(): TestConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { autoRun: false, showHitboxes: false, showPatrolZones: false };
  }

  private _saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch { /* ignore */ }
  }
}
