// ══════════════════════════════════════════════════════════════════════════════
// SpriteEditorTools — Outils de dessin pour l'éditeur de sprites
// ══════════════════════════════════════════════════════════════════════════════

export type ToolKind = "brush" | "eraser" | "fill" | "eyedropper" | "rect" | "circle" | "line" | "select";

export interface PixelRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Récupère l'ImageData complet du canvas. */
export function getImageData(cvs: HTMLCanvasElement): ImageData {
  const ctx = cvs.getContext("2d")!;
  return ctx.getImageData(0, 0, cvs.width, cvs.height);
}

/** Restaure l'ImageData sur le canvas. */
export function putImageData(cvs: HTMLCanvasElement, data: ImageData): void {
  const ctx = cvs.getContext("2d")!;
  ctx.putImageData(data, 0, 0);
}

/** Lit un pixel dans l'ImageData. */
export function getPixel(data: ImageData, x: number, y: number): PixelRGBA {
  const i = (y * data.width + x) * 4;
  return { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2], a: data.data[i + 3] };
}

/** Écrit un pixel dans l'ImageData. */
export function setPixel(data: ImageData, x: number, y: number, color: PixelRGBA): void {
  const i = (y * data.width + x) * 4;
  data.data[i] = color.r;
  data.data[i + 1] = color.g;
  data.data[i + 2] = color.b;
  data.data[i + 3] = color.a;
}

/** Compare deux couleurs RGBA. */
export function colorsEqual(a: PixelRGBA, b: PixelRGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/** Applique un carré de pinceau centré sur (cx, cy). */
export function brushStroke(
  data: ImageData,
  cx: number, cy: number,
  size: number,
  color: PixelRGBA,
): void {
  const w = data.width, h = data.height;
  const half = Math.floor(size / 2);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < w && y >= 0 && y < h) {
        setPixel(data, x, y, color);
      }
    }
  }
}

/** Flood-fill (remplissage) non-récursif. */
export function floodFill(
  data: ImageData,
  x: number, y: number,
  targetColor: PixelRGBA,
  fillColor: PixelRGBA,
): void {
  const w = data.width, h = data.height;
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const start = getPixel(data, x, y);
  if (colorsEqual(start, fillColor)) return;

  const stack: [number, number][] = [[x, y]];
  const visited = new Uint8Array(w * h);
  visited[y * w + x] = 1;

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    setPixel(data, cx, cy, fillColor);

    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny * w + nx]) {
        if (colorsEqual(getPixel(data, nx, ny), start)) {
          visited[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
    }
  }
}

/** Dessine un rectangle (outline ou fill) sur l'ImageData. */
export function drawRect(
  data: ImageData,
  x1: number, y1: number, x2: number, y2: number,
  color: PixelRGBA,
  filled: boolean,
): void {
  const w = data.width, h = data.height;
  const xMin = Math.max(0, Math.min(x1, x2));
  const xMax = Math.min(w - 1, Math.max(x1, x2));
  const yMin = Math.max(0, Math.min(y1, y2));
  const yMax = Math.min(h - 1, Math.max(y1, y2));

  if (filled) {
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        setPixel(data, x, y, color);
      }
    }
  } else {
    for (let x = xMin; x <= xMax; x++) {
      setPixel(data, x, yMin, color);
      setPixel(data, x, yMax, color);
    }
    for (let y = yMin + 1; y < yMax; y++) {
      setPixel(data, xMin, y, color);
      setPixel(data, xMax, y, color);
    }
  }
}

/** Dessine un cercle (outline ou fill) via l'algo Midpoint. */
export function drawCircle(
  data: ImageData,
  cx: number, cy: number, radius: number,
  color: PixelRGBA,
  filled: boolean,
): void {
  const w = data.width, h = data.height;

  if (filled) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            setPixel(data, px, py, color);
          }
        }
      }
    }
  } else {
    // Midpoint circle algorithm
    let x = radius, y = 0;
    let p = 1 - radius;
    while (x >= y) {
      _plotCirclePoints(data, cx, cy, x, y, color);
      y++;
      if (p <= 0) {
        p += 2 * y + 1;
      } else {
        x--;
        p += 2 * (y - x) + 1;
      }
    }
  }
}

function _plotCirclePoints(data: ImageData, cx: number, cy: number, x: number, y: number, color: PixelRGBA): void {
  const w = data.width, h = data.height;
  const pts: [number, number][] = [
    [cx + x, cy + y], [cx - x, cy + y], [cx + x, cy - y], [cx - x, cy - y],
    [cx + y, cy + x], [cx - y, cy + x], [cx + y, cy - x], [cx - y, cy - x],
  ];
  for (const [px, py] of pts) {
    if (px >= 0 && px < w && py >= 0 && py < h) setPixel(data, px, py, color);
  }
}

/** Dessine une ligne via l'algo de Bresenham. Si snap=true, angle multiple de 45°. */
export function drawLine(
  data: ImageData,
  x1: number, y1: number, x2: number, y2: number,
  color: PixelRGBA,
  snap: boolean,
): void {
  const w = data.width, h = data.height;
  let dx = x2 - x1, dy = y2 - y1;

  if (snap) {
    // Snap to nearest 45° multiple
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.sqrt(dx * dx + dy * dy);
    dx = Math.round(Math.cos(snapped) * len);
    dy = Math.round(Math.sin(snapped) * len);
  }

  // Bresenham
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const sx = dx >= 0 ? 1 : -1, sy = dy >= 0 ? 1 : -1;
  let x = x1, y = y1;

  if (adx > ady) {
    let err = adx / 2;
    for (let i = 0; i <= adx; i++) {
      if (x >= 0 && x < w && y >= 0 && y < h) setPixel(data, x, y, color);
      x += sx;
      err -= ady;
      if (err < 0) { y += sy; err += adx; }
    }
  } else {
    let err = ady / 2;
    for (let i = 0; i <= ady; i++) {
      if (x >= 0 && x < w && y >= 0 && y < h) setPixel(data, x, y, color);
      y += sy;
      err -= adx;
      if (err < 0) { x += sx; err += ady; }
    }
  }
}

/** Copie une région rectangulaire de l'ImageData. */
export function copyRegion(
  data: ImageData,
  x: number, y: number, rw: number, rh: number,
): ImageData {
  const result = new ImageData(rw, rh);
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const p = getPixel(data, x + dx, y + dy);
      setPixel(result, dx, dy, p);
    }
  }
  return result;
}

/** Colle une région ImageData à la position donnée. */
export function pasteRegion(
  dest: ImageData,
  src: ImageData,
  destX: number, destY: number,
): void {
  const dw = dest.width, dh = dest.height;
  for (let dy = 0; dy < src.height; dy++) {
    for (let dx = 0; dx < src.width; dx++) {
      const px = destX + dx, py = destY + dy;
      if (px >= 0 && px < dw && py >= 0 && py < dh) {
        const p = getPixel(src, dx, dy);
        if (p.a > 0) setPixel(dest, px, py, p);
      }
    }
  }
}
