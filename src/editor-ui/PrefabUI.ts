import { loadPrefabs, getCachedPrefabs, instantiatePrefab, type PrefabDef } from "../editor/PrefabManager";
import { emitEditorEvent, onEditorEvent } from "./EditorBridge";
import type { PlacedEntity } from "../level/LevelData";

export class PrefabUI {
  private root: HTMLElement;
  private visible = false;
  private selectedPrefab: PrefabDef | null = null;
  private unsubs: Array<() => void> = [];

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`PrefabUI: #${containerId} not found`);

    this.unsubs.push(
      onEditorEvent("prefab-toggle", () => this.toggle()),
    );
    this.unsubs.push(
      onEditorEvent("prefab-hide", () => this.hide()),
    );
  }

  getSelected(): PrefabDef | null {
    return this.selectedPrefab;
  }

  isVisible(): boolean {
    return this.visible;
  }

  async show(): Promise<void> {
    await loadPrefabs();
    this._render();
    this.root.classList.add("visible");
    this.visible = true;
  }

  hide(): void {
    this.root.classList.remove("visible");
    this.visible = false;
    this.selectedPrefab = null;
    emitEditorEvent("prefab-deselected", {});
  }

  async toggle(): Promise<void> {
    if (this.visible) {
      this.hide();
    } else {
      await this.show();
    }
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _render(): void {
    this.root.innerHTML = "";
    this.root.className = "prefab-panel";

    const header = document.createElement("div");
    header.className = "prefab-header";
    header.innerHTML = `<strong>🧩 Prefabs</strong>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "prefab-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);
    this.root.appendChild(header);

    const list = document.createElement("div");
    list.className = "prefab-list";

    const prefabs = getCachedPrefabs();
    // Merge custom prefabs from localStorage
    let customs: PrefabDef[] = [];
    try { customs = JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]"); } catch { /* ignore */ }
    const allPrefabs = [...prefabs, ...customs];
    if (allPrefabs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "prefab-empty";
      empty.textContent = "Aucun prefab disponible.";
      list.appendChild(empty);
    }

    for (const pf of allPrefabs) {
      const card = document.createElement("div");
      card.className = "prefab-card";
      if (this.selectedPrefab?.id === pf.id) {
        card.classList.add("selected");
      }

      const icon = document.createElement("span");
      icon.className = "prefab-icon";
      icon.textContent = pf.icon;
      card.appendChild(icon);

      const name = document.createElement("span");
      name.className = "prefab-name";
      name.textContent = pf.name;
      card.appendChild(name);

      const count = document.createElement("span");
      count.className = "prefab-count";
      count.textContent = `${pf.entities.length} entités`;
      card.appendChild(count);

      card.addEventListener("click", () => {
        // Deselect if already selected
        if (this.selectedPrefab?.id === pf.id) {
          this.selectedPrefab = null;
          card.classList.remove("selected");
          emitEditorEvent("prefab-deselected", {});
          return;
        }
        // Select
        this.selectedPrefab = pf;
        list.querySelectorAll(".prefab-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        emitEditorEvent("prefab-selected", { prefab: pf });
      });

      list.appendChild(card);
    }

    this.root.appendChild(list);

    // Tip
    const tip = document.createElement("div");
    tip.className = "prefab-tip";
    tip.textContent = "Clique sur un prefab puis clique dans l'éditeur pour le placer.";
    this.root.appendChild(tip);
  }
}
