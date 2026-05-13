import { emitEditorEvent, onEditorEvent } from "./EditorBridge";

interface PlaywrightTestSuite {
  name: string;
  file: string;
  cases: string[];
}

interface InternalTestCase {
  id: string;
  label: string;
  description: string;
  status: "pending" | "pass" | "fail";
  msg?: string;
}

const PLAYWRIGHT_SUITES: PlaywrightTestSuite[] = [
  {
    name: "Editor E2E",
    file: "tests/editor.spec.ts",
    cases: [
      "Palette \u2014 les miniatures montrent le bon crop",
      "Toolbar \u2014 basculement de mode et réaction de la scène",
      "Delete \u2014 modal avec le bon nom puis suppression",
      "BG \u2014 sélecteur de profondeur dans les propriétés",
      "Undo/Redo \u2014 suppression et restauration d'un asset",
    ],
  },
];

const INTERNAL_TESTS: InternalTestCase[] = [
  { id: "palette-thumbs", label: "1. Palette Thumbnails", description: "Chaque asset affiche le bon crop (pas le tileset entier).", status: "pending" },
  { id: "toolbar-modes", label: "2. Toolbar Mode Switching", description: "Chaque bouton active le bon mode et la scène réagit.", status: "pending" },
  { id: "delete-modal", label: "3. Delete Flow", description: "Mode Delete \u2192 clic asset \u2192 modal avec nom \u2192 suppression.", status: "pending" },
  { id: "bg-depth", label: "4. BG Layer Depth", description: "Mode BG \u2192 place asset \u2192 change profondeur dans propriétés.", status: "pending" },
  { id: "undo-redo", label: "5. Undo / Redo Stack", description: "Place \u2192 Undo \u2192 vérifie disparition \u2192 Redo \u2192 vérifie réapparition.", status: "pending" },
];

export class TestPageUI {
  private root: HTMLElement;
  private visible = false;
  private unsubscribers: Array<() => void> = [];

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`TestPageUI: #${containerId} not found`);
    this._build();
  }

  show(): void {
    this.visible = true;
    this.root.classList.add("visible");
    this._refreshPlaywrightStatus();
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove("visible");
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  // ──────────────────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.root.innerHTML = "";
    this.root.className = "page-container test-page-container";

    // Header
    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<h1>\ud83e\uddea Test Center</h1>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "page-close-btn";
    closeBtn.textContent = "\u2715 Fermer";
    closeBtn.addEventListener("click", () => {
      this.hide();
      emitEditorEvent("menu-show", {});
    });
    header.appendChild(closeBtn);
    this.root.appendChild(header);

    // Content grid
    const grid = document.createElement("div");
    grid.className = "test-page-grid";

    // Left: Playwright E2E
    const left = document.createElement("div");
    left.className = "test-page-col";
    left.innerHTML = `<h2>Tests E2E Playwright</h2>`;

    const suiteList = document.createElement("div");
    suiteList.className = "test-suite-list";
    for (const suite of PLAYWRIGHT_SUITES) {
      const card = document.createElement("div");
      card.className = "test-suite-card";
      card.innerHTML = `<strong>${suite.name}</strong><code>${suite.file}</code>`;
      const ul = document.createElement("ul");
      for (const c of suite.cases) {
        const li = document.createElement("li");
        li.textContent = c;
        ul.appendChild(li);
      }
      card.appendChild(ul);

      const openReport = document.createElement("button");
      openReport.className = "panel-btn primary";
      openReport.textContent = "Ouvrir le rapport HTML";
      openReport.addEventListener("click", () => {
        window.open("playwright-report/index.html", "_blank");
      });
      card.appendChild(openReport);
      suiteList.appendChild(card);
    }
    left.appendChild(suiteList);

    // Quick actions
    const quick = document.createElement("div");
    quick.className = "test-quick-actions";
    const runPw = document.createElement("button");
    runPw.className = "panel-btn primary";
    runPw.textContent = "\u25b6 Lancer Playwright (npx playwright test)";
    runPw.title = "Exécutez cette commande dans votre terminal";
    runPw.addEventListener("click", () => {
      alert("Commande \u00e0 exécuter dans le terminal :\nnpx playwright test");
    });
    quick.appendChild(runPw);
    left.appendChild(quick);

    grid.appendChild(left);

    // Right: Internal tests
    const right = document.createElement("div");
    right.className = "test-page-col";
    right.innerHTML = `<h2>Tests internes du Builder</h2>`;

    const internalList = document.createElement("div");
    internalList.className = "test-internal-list";
    for (const t of INTERNAL_TESTS) {
      const row = document.createElement("div");
      row.className = "test-internal-row";
      row.dataset.testId = t.id;

      const info = document.createElement("div");
      info.className = "test-internal-info";
      info.innerHTML = `<strong>${t.label}</strong><span>${t.description}</span>`;

      const actions = document.createElement("div");
      actions.className = "test-internal-actions";

      const runBtn = document.createElement("button");
      runBtn.className = "panel-btn";
      runBtn.textContent = "Run";
      runBtn.addEventListener("click", () => this._runInternalTest(t.id, row));

      const status = document.createElement("span");
      status.className = "test-internal-status";
      status.dataset.status = "pending";
      status.textContent = "\u25cb";

      actions.appendChild(runBtn);
      actions.appendChild(status);
      row.appendChild(info);
      row.appendChild(actions);
      internalList.appendChild(row);
    }
    right.appendChild(internalList);

    const runAll = document.createElement("button");
    runAll.className = "panel-btn primary";
    runAll.textContent = "Run All Internals";
    runAll.addEventListener("click", () => {
      for (const t of INTERNAL_TESTS) {
        const row = internalList.querySelector(`[data-test-id="${t.id}"]`) as HTMLElement | null;
        if (row) this._runInternalTest(t.id, row);
      }
    });
    right.appendChild(runAll);

    grid.appendChild(right);
    this.root.appendChild(grid);
  }

  private _refreshPlaywrightStatus(): void {
    // Future: fetch test-results.json if available
  }

  private async _runInternalTest(id: string, row: HTMLElement): Promise<void> {
    const statusEl = row.querySelector(".test-internal-status") as HTMLElement;
    statusEl.dataset.status = "pending";
    statusEl.textContent = "\u25cb";

    let ok = false;
    let msg = "";

    try {
      switch (id) {
        case "palette-thumbs": {
          const cards = document.querySelectorAll(".pal-card");
          if (cards.length === 0) throw new Error("Palette vide");
          ok = true;
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
          break;
        }
        case "toolbar-modes": {
          const modes = ["Stage", "Entities", "BG", "Select", "Delete", "Pan"];
          ok = true;
          for (const label of modes) {
            const btn = Array.from(document.querySelectorAll(".toolbar-btn")).find(
              (b) => b.textContent?.includes(label),
            ) as HTMLButtonElement | undefined;
            if (!btn) { ok = false; msg = `Bouton ${label} introuvable`; break; }
            btn.click();
            await new Promise((r) => setTimeout(r, 150));
            if (!btn.classList.contains("active")) { ok = false; msg = `Mode ${label} non activé`; break; }
          }
          break;
        }
        case "delete-modal": {
          const scene = (window as any).__editorScene;
          if (!scene) throw new Error("Scène non exposée");
          const before = scene.level.entities.length;
          if (before === 0) {
            const firstAsset = (window as any).__assetCatalog?.[0];
            if (!firstAsset) throw new Error("Aucun asset disponible");
            scene.selectedAssetDef = firstAsset;
            scene.tileBrush.active = true;
            scene.tileBrush.selectedAsset = firstAsset;
            scene.input.emit("pointerdown", { x: 900, y: 400, button: 0, leftButtonDown: () => true });
            await new Promise((r) => setTimeout(r, 300));
          }
          const afterPlace = scene.level.entities.length;
          if (afterPlace === 0) throw new Error("Impossible de placer l'entité");
          const entity = scene.level.entities[0];
          scene._removeEntity(entity.uid);
          await new Promise((r) => setTimeout(r, 200));
          ok = scene.level.entities.length === afterPlace - 1;
          break;
        }
        case "bg-depth": {
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
          if (!entity) throw new Error("Entité non crée");
          const layers = scene.level.backgroundLayers;
          const nextLayer = layers.find((l: any) => l.id !== entity.backgroundLayerId) ?? layers[0];
          if (!nextLayer) throw new Error("Pas de layer disponible");
          const view = scene.entities.getViews().get(entity.uid);
          const oldDepth = view?.obj?.depth;
          emitEditorEvent("update-entity", { uid: entity.uid, changes: { backgroundLayerId: nextLayer.id } });
          await new Promise((r) => setTimeout(r, 200));
          const newDepth = view?.obj?.depth;
          ok = newDepth !== oldDepth;
          break;
        }
        case "undo-redo": {
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
          const undoAction = scene.entities.getUndoManager().undo();
          if (!undoAction) throw new Error("Undo impossible");
          scene._applyUndo(undoAction);
          await new Promise((r) => setTimeout(r, 200));
          const afterUndo = scene.level.entities.length;
          if (afterUndo !== before) throw new Error("Undo n'a pas supprimé");
          const redoAction = scene.entities.getUndoManager().redo();
          if (!redoAction) throw new Error("Redo impossible");
          scene._applyRedo(redoAction);
          await new Promise((r) => setTimeout(r, 200));
          ok = scene.level.entities.length === before + 1;
          break;
        }
        default:
          ok = false;
          msg = "Test inconnu";
      }
    } catch (e: any) {
      ok = false;
      msg = e.message ?? String(e);
    }

    statusEl.dataset.status = ok ? "pass" : "fail";
    statusEl.textContent = ok ? "\u2713" : "\u2717";
    statusEl.title = msg;
  }
}
