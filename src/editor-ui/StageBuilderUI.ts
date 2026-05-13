import { StageBuilderCanvas } from "./StageBuilderCanvas";
import { loadPrefabs, instantiatePrefab, getCachedPrefabs, type PrefabDef } from "../editor/PrefabManager";
import { getFullCatalog } from "../level/AssetCatalog";
import { saveLevel, type LevelData, type PlacedEntity } from "../level/LevelData";
import { DEFAULT_LEVEL } from "../level/LevelData";
import { emitEditorEvent } from "./EditorBridge";

type BuildMode = "prefabs" | "resize" | "select" | "autofill" | "zones";

export class StageBuilderUI {
  private root: HTMLElement;
  private canvas: StageBuilderCanvas;
  private visible = false;

  // State
  private level: LevelData;
  private mode: BuildMode = "prefabs";
  private selectedPrefab: PrefabDef | null = null;

  // DOM refs
  private leftPanel!: HTMLElement;
  private rightPanel!: HTMLElement;
  private statusEl!: HTMLElement;
  private modeButtons = new Map<BuildMode, HTMLElement>();

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`StageBuilderUI: #${containerId} not found`);
    this.root = el;

    // Load saved level or default
    const saved = localStorage.getItem("gym-level-v6");
    this.level = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_LEVEL));

    this.canvas = new StageBuilderCanvas("sb-canvas");
    this._build();
  }

  async show(): Promise<void> {
    this.root.classList.add("visible");
    this.visible = true;

    await this.canvas.init(this.level.worldW, this.level.worldH);
    this.canvas.resizeCanvas();

    // Render existing entities
    this.canvas.renderEntities(this.level.entities);

    // Wire placement
    this.canvas.setOnPlaceEntity((wx, wy) => this._onCanvasClick(wx, wy));

    // Wire deletion (from select mode)
    this.canvas.setOnDeleteEntity((idx) => this._onDeleteEntity(idx));

    // Wire drag & drop from prefab panel to canvas
    const canvasEl = document.getElementById("sb-canvas")!;
    canvasEl.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    });
    canvasEl.addEventListener("drop", (e: DragEvent) => {
      e.preventDefault();
      const prefabId = e.dataTransfer!.getData("text/plain");
      if (!prefabId) return;
      const pf = [...getCachedPrefabs(), ...this._getCustomPrefabs()].find(p => p.id === prefabId);
      if (!pf) return;
      // Convert screen coords to world coords using canvas position and camera
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // We need camera scroll + zoom to convert. Use a reasonable approximation.
      const wx = Math.round(sx / 16) * 16;
      const wy = Math.round(sy / 16) * 16;
      const entities = instantiatePrefab(pf, wx, wy);
      for (const ent of entities) this.level.entities.push(ent);
      this.canvas.renderEntities(this.level.entities);
      saveLevel(this.level);
      this._updateStatus();
    });

    // Load prefabs into left panel
    await loadPrefabs();
    this._buildLeftPanel();

    this._updateStatus();
  }

  hide(): void {
    this.root.classList.remove("visible");
    this.visible = false;
    this.canvas.destroy();
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this._buildToolbar();
    this._buildRightPanel();
    // Left panel is rebuilt on show (after prefabs load)
    this.leftPanel = document.getElementById("sb-left-panel")!;
    this.statusEl = document.getElementById("sb-status")!;
  }

  private _buildToolbar(): void {
    const tb = document.getElementById("sb-toolbar")!;
    tb.innerHTML = "";

    const backBtn = document.createElement("button");
    backBtn.className = "sb-toolbar-btn";
    backBtn.textContent = "← Menu";
    backBtn.addEventListener("click", () => {
      saveLevel(this.level);
      this.hide();
      emitEditorEvent("menu-show", {});
    });
    tb.appendChild(backBtn);

    const sep = (): void => {
      const s = document.createElement("span");
      s.className = "sb-toolbar-sep";
      tb.appendChild(s);
    };
    sep();

    const addMode = (mode: BuildMode, icon: string, label: string): void => {
      const btn = document.createElement("button");
      btn.className = "sb-toolbar-btn";
      if (mode === this.mode) btn.classList.add("active");
      btn.innerHTML = `${icon} ${label}`;
      btn.addEventListener("click", () => this._setMode(mode));
      this.modeButtons.set(mode, btn);
      tb.appendChild(btn);
    };

    addMode("prefabs", "🧩", "Prefabs");
    addMode("resize", "↔️", "Resize");
    addMode("select", "🖱️", "Select");
    addMode("autofill", "🪄", "Auto-fill");
    addMode("zones", "🔲", "Zones");

    sep();

    // Auto-fill entity selector (only visible in autofill mode)
    const fillSelect = document.createElement("select");
    fillSelect.className = "prop-input-text";
    fillSelect.style.width = "140px";
    fillSelect.style.display = "none";
    fillSelect.id = "sb-fill-select";
    const platformAssets = getFullCatalog().filter(a => a.category === "platform" || a.category === "enemy");
    for (const a of platformAssets) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.label;
      fillSelect.appendChild(opt);
    }
    (tb as any).__fillSelect = fillSelect;
    tb.appendChild(fillSelect);

    const fillBtn = document.createElement("button");
    fillBtn.className = "sb-toolbar-btn active";
    fillBtn.style.display = "none";
    fillBtn.id = "sb-fill-btn";
    fillBtn.textContent = "Remplir";
    fillBtn.title = "Remplir la zone sélectionnée (drag sur le canvas)";
    (tb as any).__fillBtn = fillBtn;
    tb.appendChild(fillBtn);

    sep();

    const resetBtn = document.createElement("button");
    resetBtn.className = "sb-toolbar-btn";
    resetBtn.style.color = "var(--danger)";
    resetBtn.style.borderColor = "var(--danger)";
    resetBtn.textContent = "🗑 Reset";
    resetBtn.title = "Supprimer TOUS les assets du niveau";
    resetBtn.addEventListener("click", () => this._showResetModal());
    tb.appendChild(resetBtn);

    sep();

    const spacer = document.createElement("span");
    spacer.className = "sb-toolbar-spacer";
    tb.appendChild(spacer);

    const exportBtn = document.createElement("button");
    exportBtn.className = "sb-toolbar-btn";
    exportBtn.style.background = "var(--accent)";
    exportBtn.style.color = "var(--bg-primary)";
    exportBtn.style.fontWeight = "700";
    exportBtn.textContent = "Exporter → Éditeur";
    exportBtn.addEventListener("click", () => this._exportToEditor());
    tb.appendChild(exportBtn);
  }

  private async _buildLeftPanel(): Promise<void> {
    const panel = this.leftPanel;
    panel.innerHTML = "";

    const title = document.createElement("div");
    title.className = "sb-panel-title";
    title.textContent = "🧩 Prefabs";
    panel.appendChild(title);

    const list = document.createElement("div");
    list.className = "sb-prefab-list";

    const prefabs = getCachedPrefabs();
    // Also load custom prefabs from localStorage
    let customPrefabs: PrefabDef[] = [];
    try {
      customPrefabs = JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]");
    } catch { /* ignore */ }
    const allPrefabs = [...prefabs, ...customPrefabs];
    if (allPrefabs.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:var(--text-secondary);font-size:11px;padding:12px;text-align:center";
      empty.textContent = "Aucun prefab disponible";
      list.appendChild(empty);
    }

    for (const pf of allPrefabs) {
      const card = document.createElement("div");
      card.className = "sb-prefab-card";
      if (this.selectedPrefab?.id === pf.id) card.classList.add("selected");

      const icon = document.createElement("span");
      icon.className = "sb-prefab-icon";
      icon.textContent = pf.icon;
      card.appendChild(icon);

      const info = document.createElement("div");
      info.className = "sb-prefab-info";
      const name = document.createElement("div");
      name.className = "sb-prefab-name";
      name.textContent = pf.name;
      const count = document.createElement("div");
      count.className = "sb-prefab-count";
      count.textContent = `${pf.entities.length} entités`;
      info.appendChild(name);
      info.appendChild(count);
      card.appendChild(info);

      card.addEventListener("click", () => {
        if (this.selectedPrefab?.id === pf.id) {
          this.selectedPrefab = null;
          card.classList.remove("selected");
          this.canvas.setGhostPrefab(null);
        } else {
          this.selectedPrefab = pf;
          list.querySelectorAll(".sb-prefab-card").forEach(c => c.classList.remove("selected"));
          card.classList.add("selected");
          // Show ghost preview
          this.canvas.setGhostPrefab(pf.entities as any);
        }
        this._updateStatus();
      });

      // Drag & drop support
      card.draggable = true;
      card.addEventListener("dragstart", (e: DragEvent) => {
        e.dataTransfer!.setData("text/plain", pf.id);
        e.dataTransfer!.effectAllowed = "copy";
        card.style.opacity = "0.5";
      });
      card.addEventListener("dragend", () => {
        card.style.opacity = "1";
      });

      list.appendChild(card);
    }

    panel.appendChild(list);

    // "+ Nouveau prefab" button
    const addBtn = document.createElement("button");
    addBtn.className = "panel-btn";
    addBtn.style.margin = "8px";
    addBtn.textContent = "+ Sauvegarder comme prefab";
    addBtn.title = "Sauvegarder les entités actuelles comme nouveau prefab";
    addBtn.addEventListener("click", () => this._showSavePrefabModal());
    panel.appendChild(addBtn);
  }

  private _showSavePrefabModal(): void {
    if (this.level.entities.length === 0) {
      this._showConfirmModal("Aucune entité", "Placez d'abord des entités sur le canvas avant de créer un prefab.", () => {}, false);
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "300";
    const box = document.createElement("div");
    box.className = "modal-box";
    box.innerHTML = `
      <h3>Nouveau prefab</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin:4px 0">${this.level.entities.length} entités seront sauvegardées</p>
      <input type="text" class="prop-input-text" id="pf-name" placeholder="Nom du prefab" style="width:100%;margin:8px 0" />
      <input type="text" class="prop-input-text" id="pf-icon" placeholder="Icône (emoji)" style="width:100%;margin-bottom:8px" maxlength="4" />
      <div class="modal-actions">
        <button class="panel-btn" id="pf-cancel">Annuler</button>
        <button class="panel-btn primary" id="pf-save">Sauvegarder</button>
      </div>
    `;
    overlay.appendChild(box);
    this.root.appendChild(overlay);
    const nameInput = box.querySelector("#pf-name") as HTMLInputElement;
    nameInput.focus();
    box.querySelector("#pf-cancel")!.addEventListener("click", () => overlay.remove());
    box.querySelector("#pf-save")!.addEventListener("click", () => {
      const name = nameInput.value.trim() || "Prefab " + Date.now().toString(36);
      const icon = (box.querySelector("#pf-icon") as HTMLInputElement).value.trim() || "📦";
      this._saveCurrentAsPrefab(name, icon);
      overlay.remove();
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  private _getCustomPrefabs(): PrefabDef[] {
    try {
      return JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]");
    } catch { return []; }
  }

  private _saveCurrentAsPrefab(name: string, icon: string): void {
    const key = "oakwoods-custom-prefabs";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const ents = this.level.entities;
    // Entities are already in EntityManager convention (center-X, bottom-Y for sprites).
    // Just normalize by subtracting the bounding box origin.
    let minX = Infinity, minY = Infinity;
    for (const e of ents) {
      if (e.x < minX) minX = e.x;
      if (e.y < minY) minY = e.y;
    }
    const ox = minX === Infinity ? 0 : minX;
    const oy = minY === Infinity ? 0 : minY;
    const entities = ents.map(e => ({
      assetId: e.assetId,
      x: e.x - ox,
      y: e.y - oy,
      width: e.width, height: e.height,
      scale: e.scale, flipX: e.flipX, flipY: (e as any).flipY ?? false, rotation: e.rotation,
      name: e.name, hp: e.hp, maxHp: e.maxHp,
      damage: e.damage, patrolMin: e.patrolMin, patrolMax: e.patrolMax,
    }));
    existing.push({ id: "custom-" + Date.now().toString(36), name, icon, entities });
    localStorage.setItem(key, JSON.stringify(existing));
    this._buildLeftPanel(); // refresh
  }

  private async _buildRightPanel(): Promise<void> {
    const panel = document.getElementById("sb-right-panel")!;
    panel.innerHTML = "";

    const title = document.createElement("div");
    title.className = "sb-panel-title";
    title.textContent = "⚙ Propriétés";
    panel.appendChild(title);

    // Width
    const wGroup = document.createElement("div");
    wGroup.className = "sb-prop-group";
    const wLabel = document.createElement("label");
    wLabel.className = "sb-prop-label";
    wLabel.textContent = "Largeur (W)";
    const wInput = document.createElement("input");
    wInput.className = "sb-prop-input";
    wInput.type = "number";
    wInput.value = String(this.level.worldW);
    wInput.min = "800";
    wInput.max = "20000";
    wInput.step = "16";
    wGroup.appendChild(wLabel);
    wGroup.appendChild(wInput);
    panel.appendChild(wGroup);

    // Height
    const hGroup = document.createElement("div");
    hGroup.className = "sb-prop-group";
    const hLabel = document.createElement("label");
    hLabel.className = "sb-prop-label";
    hLabel.textContent = "Hauteur (H)";
    const hInput = document.createElement("input");
    hInput.className = "sb-prop-input";
    hInput.type = "number";
    hInput.value = String(this.level.worldH);
    hInput.min = "600";
    hInput.max = "5000";
    hInput.step = "16";
    hGroup.appendChild(hLabel);
    hGroup.appendChild(hInput);
    panel.appendChild(hGroup);

    // Presets
    const presetGroup = document.createElement("div");
    presetGroup.className = "sb-preset-group";
    const presets: Array<{ label: string; w: number; h: number }> = [
      { label: "S", w: 1600, h: 900 },
      { label: "M", w: 3200, h: 900 },
      { label: "L", w: 5000, h: 1200 },
      { label: "XL", w: 6400, h: 1600 },
    ];
    for (const p of presets) {
      const btn = document.createElement("button");
      btn.className = "sb-preset-btn";
      btn.textContent = p.label;
      btn.title = `${p.w}×${p.h}`;
      btn.addEventListener("click", () => {
        wInput.value = String(p.w);
        hInput.value = String(p.h);
      });
      presetGroup.appendChild(btn);
    }
    panel.appendChild(presetGroup);

    // Background color
    const bgGroup = document.createElement("div");
    bgGroup.className = "sb-prop-group";
    const bgLabel = document.createElement("label");
    bgLabel.className = "sb-prop-label";
    bgLabel.textContent = "Fond";
    const bgInput = document.createElement("input");
    bgInput.className = "sb-prop-input";
    bgInput.type = "color";
    bgInput.value = this.level.backgroundColor || "#1a1a1a";
    bgGroup.appendChild(bgLabel);
    bgGroup.appendChild(bgInput);
    panel.appendChild(bgGroup);

    // Apply button
    const applyBtn = document.createElement("button");
    applyBtn.className = "sb-apply-btn";
    applyBtn.textContent = "Appliquer";
    applyBtn.addEventListener("click", () => {
      const newW = parseInt(wInput.value) || 3200;
      const newH = parseInt(hInput.value) || 900;
      this.level.worldW = newW;
      this.level.worldH = newH;
      this.level.backgroundColor = bgInput.value;
      this.canvas.setWorldSize(newW, newH);
      this.canvas.renderEntities(this.level.entities);
      saveLevel(this.level);
      this._updateStatus();
    });
    panel.appendChild(applyBtn);

    this.rightPanel = panel;
  }

  // ── Modes ───────────────────────────────────────────────────────────────

  private _setMode(mode: BuildMode): void {
    this.mode = mode;
    this.selectedPrefab = null;
    this.canvas.setGhostPrefab(null);
    this.modeButtons.forEach((btn, m) => {
      btn.classList.toggle("active", m === mode);
    });
    this._buildLeftPanel();

    // Enable/disable resize handles
    if (mode === "resize") {
      this.canvas.setResizeMode(true, (w, h) => {
        this.level.worldW = w;
        this.level.worldH = h;
        this._updateStatus();
      });
    } else {
      this.canvas.setResizeMode(false);
    }

    // Enable/disable select mode (for deletion)
    this.canvas.setSelectMode(mode === "select");

    // Show/hide autofill controls
    const fillSelect = document.getElementById("sb-fill-select");
    const fillBtn = document.getElementById("sb-fill-btn");
    if (fillSelect && fillBtn) {
      fillSelect.style.display = mode === "autofill" ? "" : "none";
      fillBtn.style.display = mode === "autofill" ? "" : "none";
    }

    this._updateStatus();
  }

  // ── Canvas click handler ────────────────────────────────────────────────

  private _onCanvasClick(wx: number, wy: number): void {
    if (this.mode === "autofill") {
      this._doAutofill(wx, wy);
      return;
    }
    if (this.mode === "zones") {
      this._doZone(wx, wy);
      return;
    }
    if (this.mode === "prefabs" && this.selectedPrefab) {
      const entities = instantiatePrefab(this.selectedPrefab, wx, wy);
      for (const e of entities) {
        this.level.entities.push(e);
      }
      this.canvas.renderEntities(this.level.entities);
      saveLevel(this.level);
      this._updateStatus();
    }
    // Placeholder for select/resize modes (T6)
  }

  private _doAutofill(wx: number, wy: number): void {
    // Use a simple 3x1 strip fill at the clicked position
    const fillSelect = document.getElementById("sb-fill-select") as HTMLSelectElement;
    const assetId = fillSelect?.value || "platform-mossy";
    const def = getFullCatalog().find(a => a.id === assetId);
    const tileW = def?.defaultWidth ?? 192;
    const tileH = def?.defaultHeight ?? 96;
    // Fill a 3-wide horizontal strip
    const count = 3;
    for (let i = 0; i < count; i++) {
      this.level.entities.push({
        uid: "af" + Date.now().toString(36) + i,
        assetId,
        x: wx + i * tileW,
        y: wy,
        scale: 1,
        flipX: false,
        rotation: 0,
        width: tileW,
        height: tileH,
      });
    }
    this.canvas.renderEntities(this.level.entities);
    saveLevel(this.level);
    this._updateStatus();
  }

  private _doZone(wx: number, wy: number): void {
    // Show a modal to pick zone role, then generate content
    const zoneW = 800, zoneH = 300;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "300";
    const roles: Array<{ id: string; label: string; icon: string }> = [
      { id: "spawn", label: "Spawn", icon: "🚪" },
      { id: "combat", label: "Combat", icon: "⚔️" },
      { id: "boss", label: "Boss", icon: "👑" },
      { id: "platform", label: "Plateformes", icon: "🪜" },
    ];
    const box = document.createElement("div");
    box.className = "modal-box";
    box.innerHTML = `<h3>Nouvelle zone</h3><p style="font-size:12px;color:var(--text-secondary)">Choisis le rôle de la zone (${zoneW}×${zoneH}px autour du clic)</p>`;
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:12px 0";
    for (const r of roles) {
      const btn = document.createElement("button");
      btn.className = "panel-btn";
      btn.style.flex = "1";
      btn.textContent = `${r.icon} ${r.label}`;
      btn.addEventListener("click", () => {
        overlay.remove();
        this._generateZone(wx, wy, zoneW, zoneH, r.id);
      });
      btnContainer.appendChild(btn);
    }
    box.appendChild(btnContainer);
    const cancel = document.createElement("button");
    cancel.className = "panel-btn";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", () => overlay.remove());
    box.appendChild(cancel);
    overlay.appendChild(box);
    this.root.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  private _generateZone(ox: number, oy: number, w: number, h: number, role: string): void {
    const tileW = 192;
    const tilesX = Math.floor(w / tileW);
    // Ground platform
    for (let i = 0; i < tilesX; i++) {
      this.level.entities.push({
        uid: "z" + Date.now().toString(36) + i,
        assetId: i % 2 === 0 ? "platform-mossy" : "platform-mossy-2",
        x: ox + i * tileW,
        y: oy,
        scale: 1, flipX: false, rotation: 0,
        width: tileW, height: 96,
      });
    }
    if (role === "spawn") {
      this.level.entities.push({
        uid: "zsp", assetId: "spawn-player",
        x: ox + w / 2, y: oy - 100,
        scale: 1, flipX: false, rotation: 0,
      });
    } else if (role === "combat") {
      for (let i = 0; i < 2; i++) {
        this.level.entities.push({
          uid: "ze" + i, assetId: "enemy-mushroom",
          x: ox + tileW * 2 + i * tileW * 3, y: oy - 100,
          scale: 1, flipX: false, rotation: 0,
          name: "Soldat", patrolMin: -64, patrolMax: 64,
        });
      }
    } else if (role === "boss") {
      this.level.entities.push({
        uid: "zboss", assetId: "enemy-mushroom",
        x: ox + w / 2, y: oy - 100,
        scale: 1, flipX: false, rotation: 0,
        name: "Mini-boss", hp: 5, maxHp: 5, damage: 2,
        patrolMin: -80, patrolMax: 80,
      });
    } else if (role === "platform") {
      for (let j = 0; j < 2; j++) {
        this.level.entities.push({
          uid: "zfp" + j, assetId: "fp-wide-top",
          x: ox + tileW + j * tileW * 2, y: oy - 160 - j * 160,
          scale: 1, flipX: false, rotation: 0,
        });
      }
    }
    this.canvas.renderEntities(this.level.entities);
    saveLevel(this.level);
    this._updateStatus();
  }

  // ── Export ──────────────────────────────────────────────────────────────

  private _exportToEditor(): void {
    saveLevel(this.level);
    this.hide();
    // Tell editor to reload from localStorage
    emitEditorEvent("save-level", {});
    emitEditorEvent("playtest", {});
  }

  // ── Delete & Reset ──────────────────────────────────────────────────────

  private async _onDeleteEntity(idx: number): Promise<void> {
    const e = this.level.entities[idx];
    if (!e) return;
    const def = (await import("../level/AssetCatalog")).CATALOG_BY_ID[e.assetId];
    const label = def?.label ?? e.assetId;
    this._showConfirmModal(
      `Supprimer "${label}" ?`,
      "Cette action est irréversible.",
      () => {
        this.level.entities.splice(idx, 1);
        this.canvas.renderEntities(this.level.entities);
        saveLevel(this.level);
        this._updateStatus();
      },
    );
  }

  private _showResetModal(): void {
    this._showConfirmModal(
      "⚠️ Réinitialiser le niveau ?",
      `Cette action supprimera TOUS les assets (${this.level.entities.length} entités). Le monde sera vidé. Cette action est IRRÉVERSIBLE.`,
      () => {
        this.level.entities = [];
        this.canvas.renderEntities([]);
        saveLevel(this.level);
        this._updateStatus();
      },
      true, // danger mode
    );
  }

  private _showConfirmModal(
    title: string,
    message: string,
    onConfirm: () => void,
    danger = false,
  ): void {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "300";

    const box = document.createElement("div");
    box.className = "modal-box";
    box.innerHTML = `
      <h3>${title}</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin:8px 0">${message}</p>
      <div class="modal-actions" style="margin-top:16px">
        <button class="panel-btn" id="sb-cancel">Annuler</button>
        <button class="panel-btn ${danger ? "danger" : "primary"}" id="sb-confirm">
          ${danger ? "⚠️ Tout supprimer" : "Supprimer"}
        </button>
      </div>
    `;
    overlay.appendChild(box);
    this.root.appendChild(overlay);

    box.querySelector("#sb-cancel")!.addEventListener("click", () => overlay.remove());
    box.querySelector("#sb-confirm")!.addEventListener("click", () => {
      overlay.remove();
      onConfirm();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── Status ──────────────────────────────────────────────────────────────

  private _updateStatus(): void {
    const modeLabel = this.mode === "prefabs" ? "Prefabs" : this.mode === "resize" ? "Resize" : "Select";
    const prefabInfo = this.selectedPrefab ? ` | Prefab: ${this.selectedPrefab.name}` : "";
    this.statusEl.innerHTML = `
      <span class="sb-status-item">📐 ${this.level.entities.length} entités</span>
      <span class="sb-status-item">📏 ${this.level.worldW}×${this.level.worldH}</span>
      <span class="sb-status-item">🖱️ Mode: ${modeLabel}${prefabInfo}</span>
    `;
  }
}
