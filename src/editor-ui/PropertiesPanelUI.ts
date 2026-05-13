import { CATALOG_BY_ID } from "../level/AssetCatalog";
import { PlacedEntity, PlayerStats, LevelData, getBackgroundLayer } from "../level/LevelData";
import { editorBus, emitEditorEvent, onEditorEvent } from "./EditorBridge";

interface FieldRefs {
  name?: HTMLInputElement;
  hp?: HTMLInputElement;
  maxHp?: HTMLInputElement;
  damage?: HTMLInputElement;
  tint?: HTMLInputElement;
  scale?: HTMLInputElement;
  rotation?: HTMLInputElement;
  width?: HTMLInputElement;
  height?: HTMLInputElement;
  colX?: HTMLInputElement;
  colY?: HTMLInputElement;
  colW?: HTMLInputElement;
  colH?: HTMLInputElement;
  colToggle?: HTMLButtonElement;
  layerBtn?: HTMLButtonElement;
}

export class PropertiesPanelUI {
  private root: HTMLElement;
  private currentEntity: PlacedEntity | null = null;
  private currentLevel: LevelData | null = null;
  private fieldRefs: FieldRefs = {};
  private unsubscribers: Array<() => void> = [];
  private isRendering = false;

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`PropertiesPanelUI: #${containerId} not found`);

    // Listen to bridge events
    this.unsubscribers.push(
      onEditorEvent("entity-selected", (evt) => {
        this.showEntity(evt.detail.entity, evt.detail.level);
      })
    );
    this.unsubscribers.push(
      onEditorEvent("entity-deselected", () => {
        this.hide();
      })
    );
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  isVisible(): boolean {
    return this.root.classList.contains("visible");
  }

  showEntity(entity: PlacedEntity, level?: LevelData | null): void {
    this.currentEntity = entity;
    if (level) this.currentLevel = level;
    this.fieldRefs = {};
    this.isRendering = true;

    const def = CATALOG_BY_ID[entity.assetId];
    const cat = def?.category;

    // Build HTML
    this.root.innerHTML = "";
    this.root.classList.add("visible");

    // Title
    const title = document.createElement("div");
    title.className = "panel-title";
    title.textContent = def?.label ?? "Inconnu";
    this.root.appendChild(title);

    // UID (read-only)
    this._addReadOnlyRow("UID", entity.uid.slice(0, 18));
    this._addReadOnlyRow("Position", `${Math.round(entity.x)}, ${Math.round(entity.y)}`);

    // Rotation
    this._addNumRow("Rot", entity.rotation ?? 0, 0, 270, 90, (v) => {
      const changes: Partial<PlacedEntity> = { rotation: v };
      if (entity.collision?.enabled) {
        const cw = entity.collision.width;
        const ch = entity.collision.height;
        changes.collision = { ...entity.collision, width: ch, height: cw };
      }
      this._emitUpdate(changes);
    });

    // Scale
    this._addNumRow("Scale", entity.scale, 0.1, 5, 0.1, (v) => {
      this._emitUpdate({ scale: v });
    });

    // Enemy-specific fields
    if (cat === "enemy") {
      this._addSeparator();
      this._addSection("Ennemi");
      this.fieldRefs.name = this._addTextRow("Nom", entity.name ?? "", (v) => {
        this._emitUpdate({ name: v });
      });
      this.fieldRefs.hp = this._addNumRow("HP", entity.hp ?? 3, 1, 50, 1, (v) => {
        this._emitUpdate({ hp: v });
      });
      this.fieldRefs.maxHp = this._addNumRow("Max HP", entity.maxHp ?? 3, 1, 50, 1, (v) => {
        this._emitUpdate({ maxHp: v });
      });
      this.fieldRefs.damage = this._addNumRow("Dégâts", entity.damage ?? 1, 1, 20, 1, (v) => {
        this._emitUpdate({ damage: v });
      });
      this.fieldRefs.tint = this._addColorRow("Teinte", entity.tint ?? "#ffffff", (v) => {
        this._emitUpdate({ tint: v });
      });
      this._addReadOnlyRow("Patrol", `${entity.patrolMin ?? 0} — ${entity.patrolMax ?? 0}`);
    }

    // Background layer (all except enemy & spawn)
    if (cat !== "enemy" && cat !== "spawn" && this.currentLevel) {
      this._addSeparator();
      const layer = getBackgroundLayer(this.currentLevel, entity.backgroundLayerId);
      this._addReadOnlyRow("Profondeur", `${layer.label} (${layer.parallax.toFixed(2)})`);
      const select = document.createElement("select");
      select.className = "prop-select";
      for (const l of this.currentLevel.backgroundLayers) {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = `${l.label} (depth ${l.depth})`;
        if (l.id === (entity.backgroundLayerId ?? this.currentLevel.backgroundLayers[0]?.id)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        this._emitUpdate({ backgroundLayerId: select.value });
        const newLayer = getBackgroundLayer(this.currentLevel!, select.value);
        // Re-render to show updated read-only row
        this.showEntity({ ...entity, backgroundLayerId: select.value }, this.currentLevel!);
      });
      this.root.appendChild(select);
    }

    // Width / Height
    if (def?.sourceFrame || cat === "platform" || cat === "decoration" || cat === "hazard") {
      this._addSeparator();
      this.fieldRefs.width = this._addNumRow("W", entity.width ?? 192, 16, 2000, 16, (v) => {
        this._emitUpdate({ width: v });
      });
      this.fieldRefs.height = this._addNumRow("H", entity.height ?? 96, 16, 2000, 16, (v) => {
        this._emitUpdate({ height: v });
      });
    }

    // Collision
    this._addSeparator();
    this._addSection("Collision");
    if (entity.collision) {
      const coll = entity.collision;
      this.fieldRefs.colToggle = this._addToggleButton(
        coll.enabled ? "ON" : "OFF",
        coll.enabled,
        () => {
          this._emitUpdate({ collision: { ...coll, enabled: !coll.enabled } });
          this.showEntity({ ...entity, collision: { ...coll, enabled: !coll.enabled } }, this.currentLevel);
        }
      );
      if (coll.enabled) {
        this.fieldRefs.colX = this._addNumRow("Col X", coll.x, -500, 500, 1, (v) => {
          this._emitUpdate({ collision: { ...coll, x: v } });
        });
        this.fieldRefs.colY = this._addNumRow("Col Y", coll.y, -500, 500, 1, (v) => {
          this._emitUpdate({ collision: { ...coll, y: v } });
        });
        this.fieldRefs.colW = this._addNumRow("Col W", coll.width, 1, 2000, 1, (v) => {
          this._emitUpdate({ collision: { ...coll, width: v } });
        });
        this.fieldRefs.colH = this._addNumRow("Col H", coll.height, 1, 2000, 1, (v) => {
          this._emitUpdate({ collision: { ...coll, height: v } });
        });
      }
    } else {
      this._addActionButton("Activer Collision", () => {
        const newColl = {
          enabled: true,
          x: 0,
          y: 0,
          width: entity.width ?? 64,
          height: entity.height ?? 64,
        };
        this._emitUpdate({ collision: newColl });
        this.showEntity({ ...entity, collision: newColl }, this.currentLevel);
      });
    }

    // Flip
    if (entity.flipX) {
      this._addReadOnlyRow("Flip", "Horizontal ✓");
    }

    // Footer
    const footer = document.createElement("div");
    footer.className = "panel-footer";

    const okBtn = document.createElement("button");
    okBtn.className = "panel-btn primary";
    okBtn.textContent = "OK";
    okBtn.addEventListener("click", () => this.hide());

    const delBtn = document.createElement("button");
    delBtn.className = "panel-btn danger";
    delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", () => {
      if (this.currentEntity) {
        emitEditorEvent("delete-entity", { uid: this.currentEntity.uid });
        this.hide();
      }
    });

    footer.appendChild(okBtn);
    footer.appendChild(delBtn);
    this.root.appendChild(footer);

    this.isRendering = false;
  }

  hide(): void {
    this.root.classList.remove("visible");
    this.currentEntity = null;
    this.fieldRefs = {};
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _emitUpdate(changes: Partial<PlacedEntity>): void {
    if (!this.currentEntity) return;
    // Apply locally immediately so UI stays in sync
    Object.assign(this.currentEntity, changes);
    emitEditorEvent("update-entity", { uid: this.currentEntity.uid, changes });
  }

  private _createRow(label?: string): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "prop-row";
    if (label) {
      const lbl = document.createElement("span");
      lbl.className = "prop-label";
      lbl.textContent = label;
      row.appendChild(lbl);
    }
    return row;
  }

  private _addReadOnlyRow(label: string, value: string): void {
    const row = this._createRow(label);
    const val = document.createElement("span");
    val.className = "prop-value";
    val.textContent = value;
    row.appendChild(val);
    this.root.appendChild(row);
  }

  private _addNumRow(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
  ): HTMLInputElement {
    const row = this._createRow(label);

    const minus = document.createElement("button");
    minus.className = "prop-btn minus";
    minus.textContent = "−";

    const input = document.createElement("input");
    input.type = "number";
    input.className = "prop-input-number";
    input.value = String(value);
    input.step = String(step);

    const plus = document.createElement("button");
    plus.className = "prop-btn plus";
    plus.textContent = "+";

    const apply = (delta: number) => {
      const current = Number.parseFloat(input.value) || 0;
      const next = Math.max(min, Math.min(max, Math.round((current + delta) / step) * step));
      input.value = String(step < 1 ? Number(next.toFixed(2)) : next);
      onChange(next);
    };

    minus.addEventListener("click", () => apply(-step));
    plus.addEventListener("click", () => apply(step));
    input.addEventListener("change", () => {
      const v = Number.parseFloat(input.value);
      if (!Number.isNaN(v)) {
        const clamped = Math.max(min, Math.min(max, v));
        input.value = String(step < 1 ? Number(clamped.toFixed(2)) : clamped);
        onChange(clamped);
      }
    });

    row.appendChild(minus);
    row.appendChild(input);
    row.appendChild(plus);
    this.root.appendChild(row);
    return input;
  }

  private _addTextRow(label: string, value: string, onChange: (v: string) => void): HTMLInputElement {
    const row = this._createRow(label);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "prop-input-text";
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    row.appendChild(input);
    this.root.appendChild(row);
    return input;
  }

  private _addColorRow(label: string, value: string, onChange: (v: string) => void): HTMLInputElement {
    const row = this._createRow(label);
    const input = document.createElement("input");
    input.type = "color";
    input.className = "prop-input-color";
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    row.appendChild(input);
    this.root.appendChild(row);
    return input;
  }

  private _addToggleButton(text: string, isOn: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `prop-btn-toggle ${isOn ? "on" : "off"}`;
    btn.textContent = isOn ? `Collision ${text}` : `Collision ${text}`;
    btn.addEventListener("click", onClick);
    this.root.appendChild(btn);
    return btn;
  }

  private _addActionButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "prop-btn-action";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    this.root.appendChild(btn);
    return btn;
  }

  private _addSeparator(): void {
    const sep = document.createElement("div");
    sep.className = "prop-separator";
    this.root.appendChild(sep);
  }

  private _addSection(text: string): void {
    const sec = document.createElement("div");
    sec.className = "prop-section";
    sec.textContent = text;
    this.root.appendChild(sec);
  }
}
