import { emitEditorEvent, onEditorEvent } from "./EditorBridge";
import { LevelMeta, loadLevelIndex, getCompletedLevels, getUnlockedLevels } from "../level/LevelLoader";

interface HubNode {
  meta: LevelMeta;
  x: number;
  y: number;
  completed: boolean;
  unlocked: boolean;
}

export class WorldHubUI {
  private root: HTMLElement;
  private nodes: HubNode[] = [];
  private unsubs: Array<() => void> = [];

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`WorldHubUI: #${containerId} not found`);

    this.unsubs.push(
      onEditorEvent("hub-show", () => this.show())
    );
    this.unsubs.push(
      onEditorEvent("hub-hide", () => this.hide())
    );
  }

  async show(): Promise<void> {
    const index = await loadLevelIndex();
    const completed = getCompletedLevels();
    const unlocked = getUnlockedLevels(index);

    // Position nodes in a horizontal layout
    const startX = 20; // percentage
    const spacing = 30; // percentage
    this.nodes = index.map((meta, i) => ({
      meta,
      x: startX + i * spacing,
      y: 45,
      completed: completed.includes(meta.id),
      unlocked: unlocked.includes(meta.id),
    }));

    this._render();
    this.root.classList.add("visible");
  }

  hide(): void {
    this.root.classList.remove("visible");
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _render(): void {
    this.root.innerHTML = "";

    // Title
    const title = document.createElement("h1");
    title.className = "hub-title";
    title.textContent = "Carte du Monde";
    this.root.appendChild(title);

    // Map area
    const map = document.createElement("div");
    map.className = "hub-map";

    // Draw connections between unlocked nodes
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "hub-lines");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";

    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i];
      const b = this.nodes[i + 1];
      const x1 = `${a.x}%`;
      const y1 = `${a.y}%`;
      const x2 = `${b.x}%`;
      const y2 = `${b.y}%`;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", a.unlocked && b.unlocked ? "#89b4fa" : "#45475a");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", a.unlocked && b.unlocked ? "none" : "6,4");
      svg.appendChild(line);
    }
    map.appendChild(svg);

    // Nodes
    for (const node of this.nodes) {
      const el = document.createElement("div");
      el.className = "hub-node";
      if (node.completed) el.classList.add("completed");
      else if (node.unlocked) el.classList.add("unlocked");
      else el.classList.add("locked");

      el.style.left = `${node.x}%`;
      el.style.top = `${node.y}%`;

      // Icon
      const icon = document.createElement("div");
      icon.className = "hub-node-icon";
      icon.textContent = node.completed ? "✓" : node.unlocked ? "●" : "🔒";
      el.appendChild(icon);

      // Name
      const name = document.createElement("div");
      name.className = "hub-node-name";
      name.textContent = node.meta.name;
      el.appendChild(name);

      // Click handler
      if (node.unlocked || node.completed) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          emitEditorEvent("hub-select-level", { levelId: node.meta.id });
        });
      }

      map.appendChild(el);
    }

    this.root.appendChild(map);

    // Back button
    const back = document.createElement("button");
    back.className = "hub-back";
    back.textContent = "← Retour au menu";
    back.addEventListener("click", () => {
      emitEditorEvent("hub-hide", {});
      emitEditorEvent("menu-show", {});
    });
    this.root.appendChild(back);
  }
}
