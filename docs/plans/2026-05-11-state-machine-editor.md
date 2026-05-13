# B2 — State Machine Editor (Visual Graph)

> **For Hermes:** Implement this plan directly, task by task.
> **Goal:** Replace the text-based state list in the Animation Lab with an interactive visual graph where states are draggable nodes and transitions are editable edges.
> **Architecture:** HTML5 Canvas-based graph component, DOM-native, using the existing `AnimState` data model. Integrated as a tab inside the Animation Lab.
> **Tech Stack:** TypeScript, HTML5 Canvas, CSS Grid/Flexbox, DOM Events

---

## Current State

- `AnimationPageUI.ts` (974 lines) — Full spritesheet preview, onion skin, filmstrip, frame editing
- Sidebar shows `AnimState[]` as a clickable text list with transitions as `<li>→ {to} [{condition}]</li>`
- `AnimState` interface already has `transitions: Array<{ to: string; condition: string }>`
- `DEFAULT_STATES` has pre-populated transitions
- **Missing**: visual graph, node dragging, edge creation, edge editing

## Target Design

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🎨 Animation Lab                                    [✕ Fermer]     │
├─────────── selector ─────── [▶ Play] [◀] [▶] [Vitesse] [Zoom] ... │
├────────────────────────────┬─────────────────────────────────────────┤
│                            │  [Graph] [List]                          │
│    PREVIEW CANVAS          │  ┌────────────────────────────────────┐ │
│    (spritesheet frame)     │  │   ┌──────┐    velocityX != 0   ┌──┐│ │
│                            │  │   │ Idle │────────────────────>│Run││ │
│    Onion skin layer        │  │   └──────┘                    └──┘│ │
│                            │  │      │                    velocityY│ │
│    Filmstrip               │  │      │ !onGround            > 0   │ │
│                            │  │      ▼                         ▼   │ │
│    Frame info              │  │   ┌──────┐    velocityY > 0 ┌────┐│ │
│                            │  │   │ Jump │─────────────────>│Fall││ │
│                            │  │   └──────┘                  └───┘│ │
│                            │  │                                      │ │
│                            │  │  [+ Add State]  [Auto Layout]       │ │
│                            │  └────────────────────────────────────┘ │
│                            │  Edge: velocityX != 0            [Edit] │
│                            │  Delete edge      From: Idle → Run     │
├────────────────────────────┴─────────────────────────────────────────┤
│ Timeline                                                             │
└────────────────────────────────────────────────────────────────────────┘
```

## Tasks

### Task 1: Create StateMachineEditor.ts — Canvas graph component

**Objective:** Build the standalone visual graph editor using HTML5 Canvas

**Files:**
- Create: `src/editor-ui/StateMachineEditor.ts`

**Implementation:**

```typescript
// src/editor-ui/StateMachineEditor.ts
// Visual state machine graph — draggable nodes + editable edges on Canvas

interface GraphNode {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface GraphEdge {
  fromKey: string;
  toKey: string;
  condition: string;
}

export class StateMachineEditor {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private states: AnimState[];
  private selectedEdge: GraphEdge | null = null;
  private dragState: { nodeKey: string; startX: number; startY: number } | null = null;
  private edgeDrawState: { fromKey: string; toX: number; toY: number } | null = null;
  private hoveredNodeKey: string | null = null;
  private onChange: (states: AnimState[]) => void;

  constructor(
    parent: HTMLElement,
    states: AnimState[],
    onChange: (states: AnimState[]) => void
  ) {
    this.states = states;
    this.onChange = onChange;
    this.container = parent;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this._setupCanvas();
    this._syncNodes();
    this._bindEvents();
    this._draw();
  }

  // ── Public API ──────────────────────────────────────────────

  sync(states: AnimState[]): void {
    this.states = states;
    this.edges = [];
    for (const s of states) {
      for (const t of s.transitions) {
        this.edges.push({ fromKey: s.key, toKey: t.to, condition: t.condition });
      }
    }
    this._syncNodes();
    this._draw();
  }

  destroy(): void {
    this.canvas.remove();
  }

  // ── Internal ────────────────────────────────────────────────

  private _setupCanvas(): void {
    this.canvas.className = "sm-graph-canvas";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.container.appendChild(this.canvas);
    this._resize();
    new ResizeObserver(() => this._resize()).observe(this.container);
  }

  private _resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    this._draw();
  }

  private _syncNodes(): void {
    // Keep existing node positions when possible, add new nodes
    const oldNodes = new Map(this.nodes.map(n => [n.key, n]));
    const NODE_W = 140;
    const NODE_H = 50;
    const colors = ["#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8", "#cba6f7", "#94e2d5"];
    this.nodes = this.states.map((s, i) => {
      const old = oldNodes.get(s.key);
      return {
        key: s.key,
        label: s.label,
        x: old?.x ?? 60 + (i % 3) * 200,
        y: old?.y ?? 60 + Math.floor(i / 3) * 100,
        w: NODE_W,
        h: NODE_H,
        color: colors[i % colors.length],
      };
    });
  }

  private _bindEvents(): void {
    this.canvas.addEventListener("mousedown", (e) => this._onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this._onMouseUp(e));
    this.canvas.addEventListener("click", (e) => this._onClick(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private _getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private _findNode(px: number, py: number): GraphNode | null {
    return this.nodes.find(n =>
      px >= n.x && px <= n.x + n.w && py >= n.y && py <= n.y + n.h
    ) ?? null;
  }

  private _findEdgeClick(px: number, py: number): GraphEdge | null {
    for (const edge of this.edges) {
      const from = this.nodes.find(n => n.key === edge.fromKey);
      const to = this.nodes.find(n => n.key === edge.toKey);
      if (!from || !to) continue;
      const fromCx = from.x + from.w;
      const fromCy = from.y + from.h / 2;
      const toCx = to.x;
      const toCy = to.y + to.h / 2;
      // Check distance from click to line segment
      const dist = this._pointToLineDist(px, py, fromCx, fromCy, toCx, toCy);
      if (dist < 8) return edge;
    }
    return null;
  }

  private _pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    param = Math.max(0, Math.min(1, param));
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
  }

  private _onMouseDown(e: MouseEvent): void {
    const { x, y } = this._getMousePos(e);
    const node = this._findNode(x, y);
    if (node) {
      // Start dragging node
      this.dragState = { nodeKey: node.key, startX: x - node.x, startY: y - node.y };
      // If right side of node, start edge-draw
      const onRightSide = x > node.x + node.w - 20;
      if (onRightSide) {
        this.edgeDrawState = { fromKey: node.key, toX: x, toY: y };
        this.dragState = null; // edge draw takes priority
      }
    }
  }

  private _onMouseMove(e: MouseEvent): void {
    const { x, y } = this._getMousePos(e);
    let needsDraw = false;

    // Node dragging
    if (this.dragState) {
      const node = this.nodes.find(n => n.key === this.dragState!.nodeKey);
      if (node) {
        node.x = x - this.dragState.startX;
        node.y = y - this.dragState.startY;
        node.x = Math.max(0, Math.min(node.x, this.canvas.width / (window.devicePixelRatio || 1) - node.w));
        node.y = Math.max(0, node.y);
        needsDraw = true;
      }
    }

    // Edge drawing
    if (this.edgeDrawState) {
      this.edgeDrawState.toX = x;
      this.edgeDrawState.toY = y;
      needsDraw = true;
    }

    // Hover tracking
    const hovered = this._findNode(x, y);
    if (hovered?.key !== this.hoveredNodeKey) {
      this.hoveredNodeKey = hovered?.key ?? null;
      needsDraw = true;
    }

    if (needsDraw) this._draw();
  }

  private _onMouseUp(e: MouseEvent): void {
    // Check if edge-draw lands on a node
    if (this.edgeDrawState) {
      const { x, y } = this._getMousePos(e);
      const targetNode = this._findNode(x, y);
      if (targetNode && targetNode.key !== this.edgeDrawState.fromKey) {
        // Create transition — prompt for condition
        this._promptNewTransition(this.edgeDrawState.fromKey, targetNode.key);
      }
      this.edgeDrawState = null;
      this._draw();
    }
    this.dragState = null;
  }

  private _onClick(e: MouseEvent): void {
    const { x, y } = this._getMousePos(e);
    const edge = this._findEdgeClick(x, y);
    if (edge) {
      this.selectedEdge = edge;
      this._draw();
      this._showEdgeEditor(edge);
    } else {
      this.selectedEdge = null;
      this._draw();
    }
  }

  private _draw(): void {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#1e1e2e";
    ctx.fillRect(0, 0, w, h);

    // Grid dots
    ctx.fillStyle = "#2a2a3c";
    for (let gx = 0; gx < w; gx += 30) {
      for (let gy = 0; gy < h; gy += 30) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // Draw edges
    for (const edge of this.edges) {
      const from = this.nodes.find(n => n.key === edge.fromKey);
      const to = this.nodes.find(n => n.key === edge.toKey);
      if (!from || !to) continue;
      const fromX = from.x + from.w;
      const fromY = from.y + from.h / 2;
      const toX = to.x;
      const toY = to.y + to.h / 2;
      const isSelected = this.selectedEdge === edge;

      ctx.strokeStyle = isSelected ? "#f9e2af" : "#45475a";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      // Bezier curve
      const cpOffset = Math.abs(toX - fromX) * 0.5;
      ctx.bezierCurveTo(fromX + cpOffset, fromY, toX - cpOffset, toY, toX, toY);
      ctx.stroke();

      // Arrowhead
      const arrowSize = 8;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.fillStyle = isSelected ? "#f9e2af" : "#a6adc8";
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle - Math.PI / 6),
        toY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle + Math.PI / 6),
        toY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Condition label
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2 - 10;
      ctx.fillStyle = "#a6adc8";
      ctx.font = "11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.condition, midX, midY);
    }

    // Draw edge being created
    if (this.edgeDrawState) {
      const from = this.nodes.find(n => n.key === this.edgeDrawState!.fromKey);
      if (from) {
        const fromX = from.x + from.w;
        const fromY = from.y + from.h / 2;
        ctx.strokeStyle = "#89b4fa";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(this.edgeDrawState!.toX, this.edgeDrawState!.toY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    for (const node of this.nodes) {
      const isHovered = node.key === this.hoveredNodeKey;

      // Shadow
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Node body
      ctx.fillStyle = isHovered ? node.color : this._hexToRgba(node.color, 0.25);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2;
      this._roundRect(ctx, node.x, node.y, node.w, node.h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Label
      ctx.fillStyle = "#cdd6f4";
      ctx.font = "13px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x + node.w / 2, node.y + node.h / 2);

      // Edge connector dot (right side)
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x + node.w, node.y + node.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1e1e2e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private _hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private _promptNewTransition(fromKey: string, toKey: string): void {
    const fromState = this.states.find(s => s.key === fromKey);
    const toState = this.states.find(s => s.key === toKey);
    if (!fromState || !toState) return;

    const condition = prompt(`Condition de transition : ${fromState.label} → ${toState.label}`, "true");
    if (condition === null) return;

    fromState.transitions.push({ to: toKey, condition: condition || "true" });
    this.sync(this.states);
    this.onChange(this.states);
  }

  private _showEdgeEditor(edge: GraphEdge): void {
    const fromState = this.states.find(s => s.key === edge.fromKey);
    const toState = this.states.find(s => s.key === edge.toKey);
    const oldCondition = edge.condition;

    const condition = prompt(
      `Modifier la condition : ${fromState?.label} → ${toState?.label}`,
      oldCondition
    );
    if (condition === null) return;

    // Delete edge
    const idx = fromState?.transitions.findIndex(
      t => t.to === edge.toKey && t.condition === oldCondition
    );
    if (idx !== undefined && idx >= 0 && fromState) {
      if (condition === "") {
        // Delete
        fromState.transitions.splice(idx, 1);
      } else {
        fromState.transitions[idx].condition = condition;
      }
    }
    this.sync(this.states);
    this.onChange(this.states);
  }
}
```

### Task 2: Integrate StateMachineEditor into AnimationPageUI

**Objective:** Replace the text sidebar with the visual graph, add a tab toggle between Graph and List view.

**Files:**
- Modify: `src/editor-ui/AnimationPageUI.ts`

**Changes:**

1. Import `StateMachineEditor` at top
2. Add `private smEditor: StateMachineEditor | null = null` field
3. In `_build()`, replace the sidebar section (lines 233–286) with a tabbed panel:
   - Tab bar: `[Graph] [List]` toggle
   - Graph tab: Canvas container for `StateMachineEditor`
   - List tab: The existing text list (kept for backward compat)
4. Initialize `StateMachineEditor` in the Graph tab container
5. When states change, call `smEditor.sync(states)`

### Task 3: Add CSS styles for state machine editor

**Objective:** Style the graph canvas, tab bar, and sidebar container

**Files:**
- Modify: `src/editor-ui/styles/editor-ui.css`

**New CSS:**

```css
/* ─── State Machine Editor ────────────────────────────────────────── */

.sm-tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sm-tab-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.15s;
}

.sm-tab-btn:hover {
  color: var(--text-primary);
  background: rgba(137, 180, 250, 0.05);
}

.sm-tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.sm-graph-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 200px;
}

.sm-graph-canvas {
  position: absolute;
  inset: 0;
}

.sm-graph-toolbar {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.sm-edge-info {
  padding: 8px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
```

### Task 4: Build and verify

**Commands:**
```bash
cd /mnt/c/Users/Fortuné/Projects/mon-jeux-2D/vibejam-starter-pack/projects/oakwoods
npx tsc --noEmit 2>&1 | head -40
npm.cmd run build
```

**Expected:** Zero TypeScript errors, successful Vite build.
