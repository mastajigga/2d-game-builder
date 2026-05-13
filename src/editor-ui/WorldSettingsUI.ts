import { emitEditorEvent, onEditorEvent } from "./EditorBridge";
import { BG_COLORS } from "../editor/BackgroundBuilder";

export class WorldSettingsUI {
  private root: HTMLElement;
  private visible = false;

  // Field refs
  private wInput!: HTMLInputElement;
  private hInput!: HTMLInputElement;
  private colorInput!: HTMLInputElement;
  private gravityInput!: HTMLInputElement;

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`WorldSettingsUI: #${containerId} not found`);
    this._build();

    // Listen for open from toolbar
    onEditorEvent("toggle-world-settings", () => this.toggle());

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.visible) this.hide();
    });
  }

  show(currentW: number, currentH: number, currentBg: string, currentGravity: number): void {
    this.wInput.value = String(currentW);
    this.hInput.value = String(currentH);
    this.colorInput.value = currentBg;
    this.gravityInput.value = String(currentGravity);
    this.root.classList.add("visible");
    this.visible = true;
  }

  hide(): void {
    this.root.classList.remove("visible");
    this.visible = false;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show(3000, 900, "#1a1a1a", 1800);
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.root.innerHTML = "";

    const title = document.createElement("div");
    title.className = "ws-title";
    title.textContent = "Paramètres Monde";
    this.root.appendChild(title);

    // World W
    this.wInput = this._addNumRow("Largeur (W)", 3000, 800, 20000);

    // World H
    this.hInput = this._addNumRow("Hauteur (H)", 900, 600, 5000);

    // Background color
    this.colorInput = this._addColorRow("Couleur fond", "#1a1a1a");

    // Gravity
    this.gravityInput = this._addNumRow("Gravité Y", 1800, 0, 5000);

    // Footer
    const footer = document.createElement("div");
    footer.className = "ws-footer";

    const applyBtn = document.createElement("button");
    applyBtn.className = "ws-btn primary";
    applyBtn.textContent = "Appliquer";
    applyBtn.addEventListener("click", () => {
      emitEditorEvent("update-world-settings", {
        worldW: Number(this.wInput.value) || 3000,
        worldH: Number(this.hInput.value) || 900,
        backgroundColor: this.colorInput.value,
        gravityY: Number(this.gravityInput.value) || 1800,
      });
      this.hide();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ws-btn";
    cancelBtn.textContent = "Annuler";
    cancelBtn.addEventListener("click", () => this.hide());

    footer.appendChild(applyBtn);
    footer.appendChild(cancelBtn);
    this.root.appendChild(footer);
  }

  private _addNumRow(label: string, value: number, min: number, max: number): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "ws-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = "100";
    row.appendChild(lbl);
    row.appendChild(input);
    this.root.appendChild(row);
    return input;
  }

  private _addColorRow(label: string, value: string): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "ws-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "color";
    input.value = value;
    row.appendChild(lbl);
    row.appendChild(input);
    this.root.appendChild(row);
    return input;
  }
}
