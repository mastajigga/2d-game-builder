import { emitEditorEvent } from "./EditorBridge";
import { getAllSlots } from "../save-system/SaveManager";
import type { SaveSlot } from "../save-system/SaveSlot";

export class MainMenuUI {
  private root: HTMLElement;
  private resumePanel: HTMLElement | null = null;
  private resumeBtn: HTMLButtonElement | null = null;

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`MainMenuUI: #${containerId} not found`);
    this._build();
  }

  show(): void {
    this.root.classList.add("visible");
    // Refresh saves on each show
    const saves = getAllSlots();
    if (this.resumeBtn) {
      this.resumeBtn.disabled = saves.length === 0;
      this.resumeBtn.title = saves.length === 0 ? "Aucune sauvegarde" : "";
    }
    if (this.resumePanel) this.resumePanel.remove();
    this.resumePanel = null;
  }

  hide(): void {
    this.root.classList.remove("visible");
  }

  // ──────────────────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.root.innerHTML = "";

    // Title
    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "ORION & SIRIUS";
    this.root.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.className = "menu-subtitle";
    subtitle.textContent = "Studio Builder \u2022 2026";
    this.root.appendChild(subtitle);

    const sep = document.createElement("div");
    sep.className = "menu-separator";
    this.root.appendChild(sep);

    // Buttons container
    const btns = document.createElement("div");
    btns.className = "menu-buttons";

    const playBtn = this._makeBtn("▶ Jouer", "play", () => {
      emitEditorEvent("menu-play", {});
    });
    btns.appendChild(playBtn);

    this.resumeBtn = this._makeBtn("↻ Reprendre", "resume", () => {
      this._toggleResume();
    });
    const saves = getAllSlots();
    this.resumeBtn.disabled = saves.length === 0;
    this.resumeBtn.title = saves.length === 0 ? "Aucune sauvegarde" : "";
    btns.appendChild(this.resumeBtn);

    const devBtn = this._makeBtn("⚙ Développement", "develop", () => {
      emitEditorEvent("menu-develop", {});
    });
    btns.appendChild(devBtn);

    const hubBtn = this._makeBtn("🗺 Carte du monde", "hub", () => {
      emitEditorEvent("hub-show", {});
    });
    btns.appendChild(hubBtn);

    const testBtn = this._makeBtn("🧪 Test Center", "test", () => {
      emitEditorEvent("menu-test", {});
    });
    btns.appendChild(testBtn);

    const animBtn = this._makeBtn("🎨 Animation Lab", "animation", () => {
      emitEditorEvent("menu-animation", {});
    });
    btns.appendChild(animBtn);

    const buildBtn = this._makeBtn("🏗 Stage Builder", "stage-builder", () => {
      emitEditorEvent("menu-stage-builder", {});
    });
    btns.appendChild(buildBtn);

    const pfbBtn = this._makeBtn("🧩 Prefab Builder", "prefab-builder", () => {
      emitEditorEvent("menu-prefab-builder", {});
    });
    btns.appendChild(pfbBtn);

    const quitBtn = this._makeBtn("✕ Quitter", "quit", () => {
      emitEditorEvent("menu-quit", {});
    });
    btns.appendChild(quitBtn);

    this.root.appendChild(btns);
  }

  private _makeBtn(
    label: string,
    cls: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `menu-btn menu-btn-${cls}`;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private _toggleResume(): void {
    if (this.resumePanel) {
      this.resumePanel.remove();
      this.resumePanel = null;
      return;
    }

    const saves = getAllSlots();
    if (saves.length === 0) return;

    const panel = document.createElement("div");
    panel.className = "menu-resume-panel";

    for (const save of saves) {
      const row = document.createElement("div");
      row.className = "menu-resume-row";

      const info = document.createElement("div");
      info.className = "menu-resume-info";
      const nameSpan = document.createElement("span");
      nameSpan.className = "menu-resume-name";
      nameSpan.textContent = save.label;
      const dateSpan = document.createElement("span");
      dateSpan.className = "menu-resume-date";
      dateSpan.textContent = this._formatDate(new Date(save.createdAt));
      info.appendChild(nameSpan);
      info.appendChild(dateSpan);

      const loadBtn = document.createElement("button");
      loadBtn.className = "menu-resume-load";
      loadBtn.textContent = "Charger";
      loadBtn.addEventListener("click", () => {
        emitEditorEvent("menu-resume", { slotId: save.id });
      });

      row.appendChild(info);
      row.appendChild(loadBtn);
      panel.appendChild(row);
    }

    this.resumeBtn!.insertAdjacentElement("afterend", panel);
    this.resumePanel = panel;
  }

  private _formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
