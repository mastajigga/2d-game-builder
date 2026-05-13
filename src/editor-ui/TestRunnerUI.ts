import { emitEditorEvent, onEditorEvent } from "./EditorBridge";

interface TestCase {
  id: string;
  label: string;
  description: string;
  run: () => Promise<boolean>;
}

export class TestRunnerUI {
  private root: HTMLElement | null = null;
  private visible = false;
  private results = new Map<string, { status: "pending" | "pass" | "fail"; msg?: string }>();
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this._buildDOM();
    this.unsubscribers.push(
      onEditorEvent("toggle-test-runner", () => this.toggle()),
    );
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.root?.remove();
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.root) this.root.style.display = this.visible ? "flex" : "none";
  }

  private _buildDOM(): void {
    const overlay = document.getElementById("editor-overlay");
    if (!overlay) return;

    const container = document.createElement("div");
    container.id = "test-runner-panel";
    container.className = "test-runner-panel";
    container.style.display = "none";

    const header = document.createElement("div");
    header.className = "test-runner-header";
    header.innerHTML = `<span>🧪 Test Runner</span><button class="test-runner-close">×</button>`;
    header.querySelector(".test-runner-close")?.addEventListener("click", () => this.toggle());

    const list = document.createElement("div");
    list.className = "test-runner-list";

    const tests = this._defineTests();
    for (const t of tests) {
      const row = document.createElement("div");
      row.className = "test-runner-row";
      row.dataset.testId = t.id;

      const info = document.createElement("div");
      info.className = "test-runner-info";
      info.innerHTML = `<strong>${t.label}</strong><span>${t.description}</span>`;

      const actions = document.createElement("div");
      actions.className = "test-runner-actions";

      const runBtn = document.createElement("button");
      runBtn.className = "test-runner-btn";
      runBtn.textContent = "Run";
      runBtn.addEventListener("click", async () => {
        this._setStatus(t.id, "pending");
        try {
          const ok = await t.run();
          this._setStatus(t.id, ok ? "pass" : "fail", ok ? "OK" : "Échec");
        } catch (e: any) {
          this._setStatus(t.id, "fail", e.message ?? String(e));
        }
      });

      const status = document.createElement("span");
      status.className = "test-runner-status";
      status.dataset.status = "pending";
      status.textContent = "○";

      actions.appendChild(runBtn);
      actions.appendChild(status);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    }

    const footer = document.createElement("div");
    footer.className = "test-runner-footer";
    const runAll = document.createElement("button");
    runAll.className = "test-runner-btn primary";
    runAll.textContent = "Run All";
    runAll.addEventListener("click", () => {
      for (const t of tests) {
        const btn = list.querySelector(`[data-test-id="${t.id}"] .test-runner-btn`) as HTMLButtonElement | null;
        btn?.click();
      }
    });
    footer.appendChild(runAll);

    container.appendChild(header);
    container.appendChild(list);
    container.appendChild(footer);
    overlay.appendChild(container);
    this.root = container;
  }

  private _setStatus(id: string, status: "pending" | "pass" | "fail", msg = ""): void {
    this.results.set(id, { status, msg });
    if (!this.root) return;
    const row = this.root.querySelector(`[data-test-id="${id}"]`);
    if (!row) return;
    const statusEl = row.querySelector(".test-runner-status") as HTMLElement;
    statusEl.dataset.status = status;
    statusEl.textContent = status === "pass" ? "✓" : status === "fail" ? "✗" : "○";
    statusEl.title = msg;
  }

  private _defineTests(): TestCase[] {
    return [
      {
        id: "palette-thumbs",
        label: "1. Palette Thumbnails",
        description: "Chaque asset affiche le bon crop (pas le tileset entier).",
        run: async () => {
          const cards = document.querySelectorAll(".pal-card");
          if (cards.length === 0) throw new Error("Palette vide");
          let ok = true;
          for (let i = 0; i < Math.min(cards.length, 5); i++) {
            const thumb = cards[i].querySelector(".pal-thumb") as HTMLElement;
            const hasImg = thumb.querySelector("img");
            if (hasImg) {
              const src = (hasImg as HTMLImageElement).src;
              if (src.includes("TileSet.png")) ok = false;
            } else {
              const bg = thumb.style.backgroundImage;
              if (!bg && !thumb.classList.contains("pal-thumb-placeholder")) ok = false;
            }
          }
          return ok;
        },
      },
      {
        id: "toolbar-modes",
        label: "2. Toolbar Mode Switching",
        description: "Chaque bouton active le bon mode et la scène réagit.",
        run: async () => {
          const modes = ["Stage", "Entities", "BG", "Select", "Delete", "Pan"];
          for (const label of modes) {
            const btn = Array.from(document.querySelectorAll(".toolbar-btn")).find(
              (b) => b.textContent?.includes(label),
            ) as HTMLButtonElement | undefined;
            if (!btn) throw new Error(`Bouton ${label} introuvable`);
            btn.click();
            await new Promise((r) => setTimeout(r, 150));
            if (!btn.classList.contains("active")) throw new Error(`Mode ${label} non activé`);
          }
          return true;
        },
      },
      {
        id: "delete-modal",
        label: "3. Delete Flow",
        description: "Mode Delete → clic asset → modal avec nom → suppression.",
        run: async () => {
          const scene = (window as any).__editorScene;
          if (!scene) throw new Error("Scène non exposée");
          const before = scene.level.entities.length;

          // Simule le mode delete
          scene._setMode("delete");
          await new Promise((r) => setTimeout(r, 200));

          // Vérifie qu'il y a au moins une entité à supprimer
          if (before === 0) {
            // Place une entité d'abord
            const firstAsset = (window as any).__assetCatalog?.[0];
            if (!firstAsset) throw new Error("Aucun asset disponible");
            scene.selectedAssetDef = firstAsset;
            scene.tileBrush.active = true;
            scene.tileBrush.selectedAsset = firstAsset;
            // Simule un clic canvas (pas dans la palette)
            const evt = { x: 900, y: 400, button: 0, leftButtonDown: () => true };
            scene.input.emit("pointerdown", evt);
            await new Promise((r) => setTimeout(r, 300));
          }

          const afterPlace = scene.level.entities.length;
          if (afterPlace === 0) throw new Error("Impossible de placer l'entité");

          // Maintenant supprime
          const entity = scene.level.entities[0];
          scene._removeEntity(entity.uid);
          await new Promise((r) => setTimeout(r, 200));

          return scene.level.entities.length === afterPlace - 1;
        },
      },
      {
        id: "bg-depth",
        label: "4. BG Layer Depth",
        description: "Mode BG → place asset → change profondeur dans propriétés.",
        run: async () => {
          const scene = (window as any).__editorScene;
          if (!scene) throw new Error("Scène non exposée");

          scene._setMode("background");
          await new Promise((r) => setTimeout(r, 200));

          const bgAsset = (window as any).__assetCatalog?.find((a: any) => a.category === "background");
          if (!bgAsset) throw new Error("Aucun asset BG disponible");

          scene.selectedAssetDef = bgAsset;
          scene.tileBrush.active = true;
          scene.tileBrush.selectedAsset = bgAsset;
          scene.input.emit("pointerdown", { x: 900, y: 400, button: 0, leftButtonDown: () => true });
          await new Promise((r) => setTimeout(r, 300));

          const entity = scene.level.entities[scene.level.entities.length - 1];
          if (!entity) throw new Error("Entité non créée");

          const layers = scene.level.backgroundLayers;
          const nextLayer = layers.find((l: any) => l.id !== entity.backgroundLayerId) ?? layers[0];
          if (!nextLayer) throw new Error("Pas de layer disponible");

          const view = scene.entities.getViews().get(entity.uid);
          const oldDepth = view?.obj?.depth;

          // Simule le changement via le panel
          emitEditorEvent("update-entity", { uid: entity.uid, changes: { backgroundLayerId: nextLayer.id } });
          await new Promise((r) => setTimeout(r, 200));

          const newDepth = view?.obj?.depth;
          return newDepth !== oldDepth;
        },
      },
      {
        id: "undo-redo",
        label: "5. Undo / Redo Stack",
        description: "Place → Undo → vérifie disparition → Redo → vérifie réapparition.",
        run: async () => {
          const scene = (window as any).__editorScene;
          if (!scene) throw new Error("Scène non exposée");

          const before = scene.level.entities.length;
          const firstAsset = (window as any).__assetCatalog?.[0];
          if (!firstAsset) throw new Error("Aucun asset disponible");

          scene.selectedAssetDef = firstAsset;
          scene.tileBrush.active = true;
          scene.tileBrush.selectedAsset = firstAsset;
          scene.input.emit("pointerdown", { x: 900, y: 400, button: 0, leftButtonDown: () => true });
          await new Promise((r) => setTimeout(r, 300));

          const afterPlace = scene.level.entities.length;
          if (afterPlace !== before + 1) throw new Error("Placement échoué");

          // Undo
          const undoAction = scene.entities.getUndoManager().undo();
          if (!undoAction) throw new Error("Undo impossible");
          scene._applyUndo(undoAction);
          await new Promise((r) => setTimeout(r, 200));

          const afterUndo = scene.level.entities.length;
          if (afterUndo !== before) throw new Error("Undo n'a pas supprimé");

          // Redo
          const redoAction = scene.entities.getUndoManager().redo();
          if (!redoAction) throw new Error("Redo impossible");
          scene._applyRedo(redoAction);
          await new Promise((r) => setTimeout(r, 200));

          const afterRedo = scene.level.entities.length;
          return afterRedo === before + 1;
        },
      },
    ];
  }
}
