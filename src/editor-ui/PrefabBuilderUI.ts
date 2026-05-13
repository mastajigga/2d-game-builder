import { PrefabBuilderCanvas } from "./PrefabBuilderCanvas";
import { getFullCatalog } from "../level/AssetCatalog";
import { type PlacedEntity } from "../level/LevelData";
import { emitEditorEvent } from "./EditorBridge";

export class PrefabBuilderUI {
  private root: HTMLElement;
  private canvas: PrefabBuilderCanvas;
  private visible = false;
  private selectedAsset: string | null = null;
  private collisionMode = false;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`PrefabBuilderUI: #${containerId} not found`);
    this.root = el;
    this.canvas = new PrefabBuilderCanvas("pfb-canvas");
    this._build();
  }

  async show(): Promise<void> {
    this.root.classList.add("visible");
    this.visible = true;
    await this.canvas.init();
    this.canvas.onContextMenu = (idx, sx, sy) => this._showEntityMenu(idx, sx, sy);
    this._buildLeftPanel();
    this._buildRightPanel();
  }

  hide(): void {
    this.root.classList.remove("visible");
    this.visible = false;
    this.canvas.destroy();
  }

  private _build(): void { this._buildToolbar(); }

  private _buildToolbar(): void {
    const tb = document.getElementById("pfb-toolbar")!;
    tb.innerHTML = "";
    const back = document.createElement("button");
    back.className = "sb-toolbar-btn";
    back.textContent = "← Menu";
    back.addEventListener("click", () => { this.hide(); emitEditorEvent("menu-show", {}); });
    tb.appendChild(back);
    const sep = () => { const s = document.createElement("span"); s.className = "sb-toolbar-sep"; tb.appendChild(s); };
    sep();

    const colBtn = document.createElement("button");
    colBtn.className = "sb-toolbar-btn";
    colBtn.id = "pfb-collision-btn";
    colBtn.textContent = "📐 Zone collision";
    colBtn.addEventListener("click", () => {
      this.collisionMode = !this.collisionMode;
      colBtn.classList.toggle("active", this.collisionMode);
      this.canvas.setCollisionMode(this.collisionMode);
    });
    tb.appendChild(colBtn);
    sep();

    const moveBtn = document.createElement("button");
    moveBtn.className = "sb-toolbar-btn";
    moveBtn.id = "pfb-move-btn";
    moveBtn.textContent = "🖐️ Déplacer";
    moveBtn.title = "Mode déplacement seul";
    moveBtn.addEventListener("click", () => {
      this.canvas.toggleMoveOnly();
      moveBtn.classList.toggle("active", this.canvas.isMoveOnly());
    });
    tb.appendChild(moveBtn);
    sep();

    // Zoom controls
    const zoomOut = document.createElement("button");
    zoomOut.className = "sb-toolbar-btn";
    zoomOut.textContent = "🔍−";
    zoomOut.title = "Dézoomer";
    zoomOut.addEventListener("click", () => this.canvas.zoom(-0.2));
    tb.appendChild(zoomOut);

    const zoomLabel = document.createElement("span");
    zoomLabel.className = "sb-toolbar-btn";
    zoomLabel.style.cssText = "pointer-events:none;min-width:40px;text-align:center;font-size:11px";
    zoomLabel.textContent = "1x";
    zoomLabel.id = "pfb-zoom-label";
    tb.appendChild(zoomLabel);

    const zoomIn = document.createElement("button");
    zoomIn.className = "sb-toolbar-btn";
    zoomIn.textContent = "🔍+";
    zoomIn.title = "Zoomer";
    zoomIn.addEventListener("click", () => this.canvas.zoom(0.2));
    tb.appendChild(zoomIn);

    const zoomReset = document.createElement("button");
    zoomReset.className = "sb-toolbar-btn";
    zoomReset.textContent = "1:1";
    zoomReset.title = "Zoom 100%";
    zoomReset.addEventListener("click", () => this.canvas.zoom(0, true));
    tb.appendChild(zoomReset);

    sep();

    const spacer = document.createElement("span"); spacer.className = "sb-toolbar-spacer"; tb.appendChild(spacer);

    const saveBtn = document.createElement("button");
    saveBtn.className = "sb-toolbar-btn";
    saveBtn.style.background = "var(--accent)"; saveBtn.style.color = "var(--bg-primary)"; saveBtn.style.fontWeight = "700";
    saveBtn.textContent = "💾 Sauvegarder Prefab";
    saveBtn.addEventListener("click", () => this._savePrefab());
    tb.appendChild(saveBtn);
  }

  private _buildLeftPanel(): void {
    const panel = document.getElementById("pfb-left-panel")!;
    panel.innerHTML = "<div class='sb-panel-title'>📦 Assets</div>";
    const assets = getFullCatalog().filter(a =>
      a.category === "platform" || a.category === "enemy" || a.category === "spawn" ||
      a.category === "decoration" || a.category === "hazard" || a.category === "background"
    );
    for (const a of assets) {
      const card = document.createElement("div");
      card.className = "pfb-asset-card";
      if (this.selectedAsset === a.id) card.classList.add("selected");
      card.title = a.id;

      // Thumbnail canvas
      const thumb = document.createElement("canvas");
      thumb.width = 40; thumb.height = 40;
      thumb.className = "pfb-thumb";
      this._drawThumb(thumb, a);

      const label = document.createElement("span");
      label.className = "pfb-asset-label";
      label.textContent = a.label;

      card.appendChild(thumb);
      card.appendChild(label);
      card.addEventListener("click", () => {
        this.selectedAsset = a.id;
        this.canvas.setAsset(a.id);
        panel.querySelectorAll(".pfb-asset-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
      });
      panel.appendChild(card);
    }

    // ── Custom prefabs section ──
    let customs: any[] = [];
    try { customs = JSON.parse(localStorage.getItem("oakwoods-custom-prefabs") || "[]"); } catch { /* ignore */ }
    if (customs.length > 0) {
      const sep = document.createElement("div");
      sep.className = "sb-panel-title";
      sep.style.marginTop = "12px";
      sep.textContent = "🧩 Mes Prefabs";
      panel.appendChild(sep);

      for (const pf of customs) {
        const card = document.createElement("div");
        card.className = "pfb-asset-card";
        card.title = pf.name;

        const thumb = document.createElement("canvas");
        thumb.width = 40; thumb.height = 40;
        thumb.className = "pfb-thumb";
        // Show emoji icon as thumbnail
        const ctx = thumb.getContext("2d")!;
        ctx.fillStyle = "#2a2a3a";
        ctx.fillRect(0, 0, 40, 40);
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pf.icon || "📦", 20, 20);

        const label = document.createElement("span");
        label.className = "pfb-asset-label";
        label.textContent = pf.name;

        card.appendChild(thumb);
        card.appendChild(label);
        card.addEventListener("click", () => {
          // Place all entities of this prefab into the canvas
          this.selectedAsset = null;
          this.canvas.placePrefabEntities(pf.entities);
          panel.querySelectorAll(".pfb-asset-card").forEach(c => c.classList.remove("selected"));
          card.classList.add("selected");
        });
        panel.appendChild(card);
      }
    }
  }

  private _drawThumb(canvas: HTMLCanvasElement, asset: any): void {
    const ctx = canvas.getContext("2d")!;
    const basePath = (window as any).__oakwoods_basePath ?? "";
    const imgPath = asset.imagePath ?? asset.sheetPath ?? `${asset.textureKey}.png`;
    const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http") ? imgPath : `${basePath}/${imgPath}`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const sf = asset.sourceFrame;
      let sx = sf?.x ?? 0, sy = sf?.y ?? 0;
      let sw = sf?.w ?? img.naturalWidth, sh = sf?.h ?? img.naturalHeight;
      // If spritesheet with frame dimensions, take first frame
      if (asset.frameW && asset.frameH) {
        sw = asset.frameW;
        sh = asset.frameH;
      }
      ctx.clearRect(0, 0, 40, 40);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 40, 40);
    };
    img.onerror = () => {
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, 40, 40);
    };
    img.src = fullPath;
  }

  private _buildRightPanel(): void {
    const panel = document.getElementById("pfb-right-panel")!;
    panel.innerHTML = `
      <div class="sb-panel-title">⚙ Propriétés</div>
      <div class="sb-prop-group">
        <label class="sb-prop-label">Nom du prefab</label>
        <input type="text" class="sb-prop-input" id="pfb-name" placeholder="Mon prefab" />
      </div>
      <div class="sb-prop-group">
        <label class="sb-prop-label">Icône (emoji)</label>
        <input type="text" class="sb-prop-input" id="pfb-icon" placeholder="📦" maxlength="4" />
      </div>
      <div class="sb-prop-group">
        <label class="sb-prop-label">Échelle: <span id="pfb-scale-val">0.5x</span></label>
        <input type="range" class="sb-prop-input" id="pfb-scale" min="0.25" max="2" step="0.25" value="0.5"
          oninput="const v=this.value;const s=document.getElementById('pfb-scale-val');if(s)s.textContent=v+'x';" />
      </div>
      <p style="font-size:10px;color:var(--text-secondary);margin-top:4px">
        🖱️ Clic gauche : placer / drag<br>
        🖱️ Clic droit : menu (rotation, supprimer)<br>
        📐 Zone collision : hitbox du prefab
      </p>
    `;
  }

  private _showEntityMenu(index: number, sx: number, sy: number): void {
    // Remove any existing menu
    document.getElementById("pfb-ctx-menu")?.remove();

    const menu = document.createElement("div");
    menu.id = "pfb-ctx-menu";
    menu.style.cssText = `
      position:fixed;left:${sx}px;top:${sy}px;z-index:350;
      background:var(--bg-secondary);border:1px solid var(--border);
      border-radius:var(--radius);padding:4px;display:flex;flex-direction:column;gap:2px;
      font-family:var(--font);font-size:12px;min-width:100px;box-shadow:0 4px 12px rgba(0,0,0,0.5);
    `;

    const rotations = [0, 90, 180, 270];
    for (const r of rotations) {
      const btn = document.createElement("button");
      btn.className = "panel-btn";
      btn.style.textAlign = "left";
      btn.textContent = `↻ ${r}°`;
      btn.addEventListener("click", () => {
        this.canvas.rotateEntity(index, r);
        menu.remove();
      });
      menu.appendChild(btn);
    }
    // Flip controls
    const flipXBtn = document.createElement("button");
    flipXBtn.className = "panel-btn";
    flipXBtn.style.textAlign = "left";
    flipXBtn.textContent = "↔️ Flip X";
    flipXBtn.addEventListener("click", () => {
      this.canvas.flipEntity(index, true);
      menu.remove();
    });
    menu.appendChild(flipXBtn);

    const flipYBtn = document.createElement("button");
    flipYBtn.className = "panel-btn";
    flipYBtn.style.textAlign = "left";
    flipYBtn.textContent = "↕️ Flip Y";
    flipYBtn.addEventListener("click", () => {
      this.canvas.flipEntity(index, false);
      menu.remove();
    });
    menu.appendChild(flipYBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "panel-btn";
    delBtn.style.color = "var(--danger)";
    delBtn.textContent = "🗑 Supprimer";
    delBtn.addEventListener("click", () => {
      this.canvas.deleteEntity(index);
      menu.remove();
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    // Close on outside click
    const close = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener("click", close); }
    };
    setTimeout(() => document.addEventListener("click", close), 10);
  }

  private _savePrefab(): void {
    const name = (document.getElementById("pfb-name") as HTMLInputElement)?.value?.trim() || "Prefab";
    const icon = (document.getElementById("pfb-icon") as HTMLInputElement)?.value?.trim() || "📦";
    const entities = this.canvas.getEntities();
    if (entities.length === 0) {
      alert("Place au moins un asset sur le canvas.");
      return;
    }
    const collision = this.canvas.getCollision();
    // Entity coords are already center-X / bottom-Y (matching EntityManager origin).
    // Just normalize by subtracting the bounding box origin.
    let ox = 0, oy = 0;
    if (collision) {
      ox = collision.x + collision.w / 2;
      oy = collision.y + collision.h;
    } else {
      let minX = Infinity, minY = Infinity;
      for (const e of entities) {
        if (e.x < minX) minX = e.x;
        if (e.y < minY) minY = e.y;
      }
      ox = minX === Infinity ? 0 : minX;
      oy = minY === Infinity ? 0 : minY;
    }
    const normEntities = entities.map(e => ({
      assetId: e.assetId,
      x: e.x - ox,
      y: e.y - oy,
      width: e.width, height: e.height,
      name: e.name, hp: e.hp, maxHp: e.maxHp,
      damage: e.damage, patrolMin: e.patrolMin, patrolMax: e.patrolMax,
      scale: e.scale, flipX: e.flipX, flipY: (e as any).flipY, rotation: e.rotation,
    }));

    const key = "oakwoods-custom-prefabs";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push({ id: "custom-" + Date.now().toString(36), name, icon, entities: normEntities });
    localStorage.setItem(key, JSON.stringify(existing));
    this.hide();
    emitEditorEvent("menu-show", {});
  }
}
