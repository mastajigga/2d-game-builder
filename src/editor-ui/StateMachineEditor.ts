// src/editor-ui/StateMachineEditor.ts
// Visual state machine graph — draggable nodes + editable edges on Canvas

interface AnimState {
  key: string;
  label: string;
  frameStart: number;
  frameEnd: number;
  frameRate: number;
  repeat: boolean;
  transitions: Array<{ to: string; condition: string }>;
}

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
  private offRequestAnimationFrame: boolean;

  constructor(
    parent: HTMLElement,
    states: AnimState[],
    onChange: (states: AnimState[]) => void
  ) {
    this.states = states;
    this.onChange = onChange;
    this.container = parent;
    this.offRequestAnimationFrame = false;
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
    this.offRequestAnimationFrame = true;
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
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._draw();
  }

  private _syncNodes(): void {
    const oldNodes = new Map(this.nodes.map((n) => [n.key, n]));
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
    window.addEventListener("mouseup", (e) => this._onMouseUp(e));
    this.canvas.addEventListener("click", (e) => this._onClick(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private _getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private _findNode(px: number, py: number): GraphNode | null {
    for (const n of this.nodes) {
      if (px >= n.x && px <= n.x + n.w && py >= n.y && py <= n.y + n.h) return n;
    }
    return null;
  }

  private _findEdgeClick(px: number, py: number): GraphEdge | null {
    let closest: GraphEdge | null = null;
    let closestDist = 10;
    for (const edge of this.edges) {
      const from = this.nodes.find((n) => n.key === edge.fromKey);
      const to = this.nodes.find((n) => n.key === edge.toKey);
      if (!from || !to) continue;
      const fromCx = from.x + from.w;
      const fromCy = from.y + from.h / 2;
      const toCx = to.x;
      const toCy = to.y + to.h / 2;
      const dist = this._pointToBezierDist(px, py, fromCx, fromCy, toCx, toCy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = edge;
      }
    }
    return closest;
  }

  private _pointToBezierDist(
    px: number, py: number,
    x1: number, y1: number, x2: number, y2: number
  ): number {
    // Sample the bezier curve at 20 points, find min distance
    const cpOff = Math.abs(x2 - x1) * 0.5;
    const cpx1 = x1 + cpOff; const cpy1 = y1;
    const cpx2 = x2 - cpOff; const cpy2 = y2;
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const bx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * cpx1 + 3 * (1 - t) * t ** 2 * cpx2 + t ** 3 * x2;
      const by = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * cpy1 + 3 * (1 - t) * t ** 2 * cpy2 + t ** 3 * y2;
      const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  private _onMouseDown(e: MouseEvent): void {
    const { x, y } = this._getMousePos(e);
    const node = this._findNode(x, y);
    if (node) {
      // Check if clicking on right-side connector dot
      const onConnector = x > node.x + node.w - 20 && x < node.x + node.w + 10
        && y > node.y + node.h / 2 - 10 && y < node.y + node.h / 2 + 10;
      if (onConnector) {
        this.edgeDrawState = { fromKey: node.key, toX: x, toY: y };
      } else {
        this.dragState = { nodeKey: node.key, startX: x - node.x, startY: y - node.y };
      }
    }
  }

  private _onMouseMove(e: MouseEvent): void {
    const { x, y } = this._getMousePos(e);
    let needsDraw = false;

    if (this.dragState) {
      const node = this.nodes.find((n) => n.key === this.dragState!.nodeKey);
      if (node) {
        node.x = x - this.dragState.startX;
        node.y = y - this.dragState.startY;
        const cw = this.canvas.width / (window.devicePixelRatio || 1);
        node.x = Math.max(0, Math.min(node.x, cw - node.w));
        node.y = Math.max(0, node.y);
        needsDraw = true;
      }
    }

    if (this.edgeDrawState) {
      this.edgeDrawState.toX = x;
      this.edgeDrawState.toY = y;
      needsDraw = true;
    }

    const hovered = this._findNode(x, y);
    if (hovered?.key !== this.hoveredNodeKey) {
      this.hoveredNodeKey = hovered?.key ?? null;
      needsDraw = true;
    }

    if (needsDraw) this._draw();
  }

  private _onMouseUp(e: MouseEvent): void {
    if (this.edgeDrawState) {
      const { x, y } = this._getMousePos(e);
      const targetNode = this._findNode(x, y);
      if (targetNode && targetNode.key !== this.edgeDrawState.fromKey) {
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
      if (this.selectedEdge) {
        this.selectedEdge = null;
        this._draw();
      }
    }
  }

  private _draw(): void {
    if (this.offRequestAnimationFrame) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
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
      const from = this.nodes.find((n) => n.key === edge.fromKey);
      const to = this.nodes.find((n) => n.key === edge.toKey);
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
      const cpOffset = Math.abs(toX - fromX) * 0.5;
      ctx.bezierCurveTo(fromX + cpOffset, fromY, toX - cpOffset, toY, toX, toY);
      ctx.stroke();

      // Arrowhead at toNode
      const arrowSize = 8;
      const angle = Math.atan2(toY - (fromY), toX - (fromX));
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
      const from = this.nodes.find((n) => n.key === this.edgeDrawState!.fromKey);
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
      ctx.font = "600 13px 'Segoe UI', sans-serif";
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

  private _roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
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
    const fromState = this.states.find((s) => s.key === fromKey);
    const toState = this.states.find((s) => s.key === toKey);
    if (!fromState || !toState) return;

    const condition = prompt(
      `Condition de transition : ${fromState.label} → ${toState.label}`,
      "true"
    );
    if (condition === null) return;

    fromState.transitions.push({ to: toKey, condition: condition || "true" });
    this.sync(this.states);
    this.onChange(this.states);
  }

  private _showEdgeEditor(edge: GraphEdge): void {
    const fromState = this.states.find((s) => s.key === edge.fromKey);
    const toState = this.states.find((s) => s.key === edge.toKey);
    if (!fromState) return;

    const oldCondition = edge.condition;
    const condition = prompt(
      `Modifier la condition : ${fromState.label} → ${toState?.label ?? edge.toKey}`,
      oldCondition
    );
    if (condition === null) return;

    const idx = fromState.transitions.findIndex(
      (t) => t.to === edge.toKey && t.condition === oldCondition
    );
    if (idx >= 0) {
      if (condition === "") {
        fromState.transitions.splice(idx, 1);
      } else {
        fromState.transitions[idx].condition = condition;
      }
    }
    this.selectedEdge = null;
    this.sync(this.states);
    this.onChange(this.states);
  }
}
