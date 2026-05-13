import { ASSET_CATALOG, AssetDef, AssetCategory, CATALOG_BY_ID } from "../level/AssetCatalog";
import { emitEditorEvent, onEditorEvent } from "./EditorBridge";

const CATEGORY_META: Array<{
  key: AssetCategory | "all";
  label: string;
  emoji: string;
  color: string;
}> = [
  { key: "all", label: "Tous", emoji: "★", color: "#89b4fa" },
  { key: "background", label: "Fond", emoji: "🌿", color: "#8df5e8" },
  { key: "platform", label: "Plat.", emoji: "▣", color: "#a6e3a1" },
  { key: "decoration", label: "Décor", emoji: "✿", color: "#f9e2af" },
  { key: "hazard", label: "Hazard", emoji: "☠", color: "#f38ba8" },
  { key: "enemy", label: "Ennemi", emoji: "👾", color: "#fab387" },
  { key: "spawn", label: "Spawn", emoji: "🎮", color: "#cba6f7" },
  { key: "system", label: "Syst.", emoji: "⚙", color: "#f5c2e7" },
  { key: "prefab", label: "Prefab", emoji: "🧩", color: "#74c7ec" },
];

export class PaletteUI {
  private root: HTMLElement;
  private content: HTMLElement;
  private searchInput!: HTMLInputElement;
  private filterButtons = new Map<string, HTMLButtonElement>();
  private selectedAssetId: string | null = null;
  private activeFilter: AssetCategory | "all" = "all";
  private assetElements = new Map<string, HTMLElement>();
  private unsubscribers: Array<() => void> = [];

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`PaletteUI: #${containerId} not found`);

    this._buildHeader();
    this._buildFilters();
    this.content = document.createElement("div");
    this.content.className = "pal-content";
    this.root.appendChild(this.content);
    this._renderContent();

    // Listen to external clear
    this.unsubscribers.push(
      onEditorEvent("palette-clear", () => this.clearSelection())
    );
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  getSelectedAssetId(): string | null {
    return this.selectedAssetId;
  }

  clearSelection(): void {
    if (this.selectedAssetId) {
      const el = this.assetElements.get(this.selectedAssetId);
      if (el) el.classList.remove("selected");
    }
    this.selectedAssetId = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  private _buildHeader(): void {
    const header = document.createElement("div");
    header.className = "pal-header";

    const title = document.createElement("div");
    title.className = "pal-title";
    title.textContent = "PALETTE";

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.className = "pal-search";
    this.searchInput.placeholder = "Rechercher...";
    this.searchInput.addEventListener("input", () => this._renderContent());

    header.appendChild(title);
    header.appendChild(this.searchInput);
    this.root.appendChild(header);
  }

  private _buildFilters(): void {
    const row = document.createElement("div");
    row.className = "pal-filters";

    for (const meta of CATEGORY_META) {
      const btn = document.createElement("button");
      btn.className = `pal-filter ${meta.key === "all" ? "active" : ""}`;
      btn.title = meta.label;
      btn.style.setProperty("--cat-color", meta.color);
      btn.innerHTML = `<span>${meta.emoji}</span>`;
      btn.addEventListener("click", () => {
        this.activeFilter = meta.key as AssetCategory | "all";
        this.filterButtons.forEach((b, k) => b.classList.toggle("active", k === meta.key));
        this._renderContent();
      });
      this.filterButtons.set(meta.key, btn);
      row.appendChild(btn);
    }

    this.root.appendChild(row);
  }

  private _renderContent(): void {
    this.content.innerHTML = "";
    this.assetElements.clear();

    const query = this.searchInput.value.trim().toLowerCase();

    // Build filtered catalog
    const filtered = ASSET_CATALOG.filter((a) => {
      if (this.activeFilter !== "all" && a.category !== this.activeFilter) return false;
      if (query) {
        const text = `${a.label} ${a.id}`.toLowerCase();
        return text.includes(query);
      }
      return true;
    });

    // Inject custom prefabs from localStorage
    if (this.activeFilter === "all" || this.activeFilter === "prefab") {
      try {
        const customs = JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]");
        for (const pf of customs) {
          if (query && !pf.name.toLowerCase().includes(query)) continue;
          // Create a synthetic AssetDef-like entry
          (filtered as any).push({
            id: "prefab:" + pf.id,
            label: pf.icon + " " + pf.name,
            category: "prefab" as AssetCategory,
            textureKey: "__DEFAULT",
            defaultWidth: 32, defaultHeight: 32,
            _prefabData: pf,
          });
        }
      } catch { /* ignore */ }
    }

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pal-empty";
      empty.textContent = "Aucun asset trouvé";
      this.content.appendChild(empty);
      return;
    }

    // Group by category when showing all or filtered by search
    if (this.activeFilter === "all" && !query) {
      for (const meta of CATEGORY_META) {
        if (meta.key === "all") continue;
        const groupAssets = filtered.filter((a) => a.category === meta.key);
        if (groupAssets.length === 0) continue;
        this._addSection(meta.label, meta.emoji, meta.color, groupAssets);
      }
    } else {
      // Flat grid
      const grid = document.createElement("div");
      grid.className = "pal-grid";
      for (const a of filtered) {
        grid.appendChild(this._buildAssetCard(a));
      }
      this.content.appendChild(grid);
    }
  }

  private _addSection(
    label: string,
    emoji: string,
    color: string,
    assets: AssetDef[],
  ): void {
    const sec = document.createElement("div");
    sec.className = "pal-section";

    const hdr = document.createElement("div");
    hdr.className = "pal-section-header";
    hdr.style.color = color;
    hdr.textContent = `${emoji} ${label}`;
    sec.appendChild(hdr);

    const grid = document.createElement("div");
    grid.className = "pal-grid";
    for (const a of assets) {
      grid.appendChild(this._buildAssetCard(a));
    }
    sec.appendChild(grid);

    this.content.appendChild(sec);
  }

  private _buildAssetCard(asset: AssetDef): HTMLElement {
    const card = document.createElement("div");
    card.className = "pal-card";
    card.dataset.assetId = asset.id;
    if (this.selectedAssetId === asset.id) card.classList.add("selected");

    const thumb = this._buildThumb(asset);
    const lbl = document.createElement("div");
    lbl.className = "pal-card-label";
    lbl.textContent = asset.label;
    lbl.title = asset.label;

    card.appendChild(thumb);
    card.appendChild(lbl);

    card.addEventListener("click", () => {
      this._selectAsset(asset.id);
    });

    this.assetElements.set(asset.id, card);
    return card;
  }

  private _buildThumb(asset: AssetDef): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "pal-thumb";

    // Use canvas-cropped thumbnail for sourceFrame assets
    if (asset.sourceFrame && asset.imagePath) {
      this._buildCroppedThumb(asset, wrap);
    } else if (asset.imagePath && (asset.tileOffsetX !== undefined || asset.tileOffsetY !== undefined)) {
      // Tileset crop: show the specific tile region
      this._buildCroppedThumb(asset, wrap, {
        x: asset.tileOffsetX ?? 0,
        y: asset.tileOffsetY ?? 0,
        w: 128,
        h: 128,
      });
    } else if (asset.sheetPath && asset.frameW && asset.frameH) {
      // Spritesheet: show as background with first frame cropped
      wrap.style.backgroundImage = `url(${asset.sheetPath})`;
      wrap.style.backgroundSize = "auto";
      wrap.style.backgroundRepeat = "no-repeat";
      // Position to show first frame top-left
      wrap.style.backgroundPosition = "0px 0px";
      // Scale down to fit
      wrap.style.backgroundSize = `${asset.frameW * 2}px ${asset.frameH * 2}px`;
    } else if (asset.sheetPath) {
      // Full spritesheet as img
      const img = document.createElement("img");
      img.src = asset.sheetPath;
      img.className = "pal-thumb-img";
      img.draggable = false;
      img.onerror = () => { img.style.display = "none"; };
      wrap.appendChild(img);
    } else if (asset.imagePath) {
      const img = document.createElement("img");
      img.src = asset.imagePath;
      img.className = "pal-thumb-img";
      img.draggable = false;
      img.onerror = () => { img.style.display = "none"; };
      wrap.appendChild(img);
    } else {
      const emoji = CATEGORY_META.find((c) => c.key === asset.category)?.emoji ?? "❓";
      wrap.classList.add("pal-thumb-placeholder");
      wrap.textContent = emoji;
    }

    return wrap;
  }

  private _buildCroppedThumb(asset: AssetDef, wrap: HTMLElement, sfOverride?: { x: number; y: number; w: number; h: number }): void {
    const sf = sfOverride ?? asset.sourceFrame;
    if (!sf) return;
    const img = new Image();
    img.src = asset.imagePath!;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.min(size / sf.w, size / sf.h);
      const dw = sf.w * scale;
      const dh = sf.h * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.drawImage(img, sf.x, sf.y, sf.w, sf.h, dx, dy, dw, dh);
      wrap.style.backgroundImage = `url(${canvas.toDataURL()})`;
      wrap.style.backgroundSize = "contain";
      wrap.style.backgroundRepeat = "no-repeat";
      wrap.style.backgroundPosition = "center";
    };
    img.onerror = () => {
      const emoji = CATEGORY_META.find((c) => c.key === asset.category)?.emoji ?? "❓";
      wrap.classList.add("pal-thumb-placeholder");
      wrap.textContent = emoji;
    };
  }

  private _selectAsset(id: string): void {
    this.clearSelection();
    this.selectedAssetId = id;
    const el = this.assetElements.get(id);
    if (el) el.classList.add("selected");
    emitEditorEvent("palette-select", { assetId: id });
  }
}
