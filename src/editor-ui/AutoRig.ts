// src/editor-ui/AutoRig.ts
// Auto-rig / bone suggestions for modular pixel art
// Detects connection points between body parts (head, torso, legs)
// and suggests pivot positions for Phaser sprites.

export interface PivotSuggestion {
  label: string;
  x: number;
  y: number;
  confidence: number; // 0..1
}

export interface RigPart {
  label: string;
  image: HTMLImageElement;
  pivotX: number; // suggested pivot (0..1 normalized)
  pivotY: number;
}

// ── Analyze a single body part image ─────────────────────────

export function analyzePart(img: HTMLImageElement, label: string): PivotSuggestion[] {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;

  // Find non-transparent pixel bounds
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const off = (y * w + x) * 4;
      if (data.data[off + 3] > 32) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        count++;
      }
    }
  }

  if (count === 0) return [{
    label: `${label} center`,
    x: Math.floor(w / 2),
    y: Math.floor(h / 2),
    confidence: 0,
  }];

  const partH = maxY - minY + 1;
  const partW = maxX - minX + 1;
  const centerX = Math.floor((minX + maxX) / 2);
  const suggestions: PivotSuggestion[] = [];

  // ── Heuristic: scan horizontal slices to find "neck" or "waist" ──
  // Look for the narrowest horizontal slice (connection point)
  const sliceWidths: number[] = [];
  for (let y = 0; y < h; y++) {
    let rowMin = w, rowMax = 0;
    for (let x = 0; x < w; x++) {
      const off = (y * w + x) * 4;
      if (data.data[off + 3] > 32) {
        rowMin = Math.min(rowMin, x);
        rowMax = Math.max(rowMax, x);
      }
    }
    sliceWidths.push(rowMax >= rowMin ? rowMax - rowMin + 1 : 0);
  }

  // Find narrowest slice in the upper third (neck candidate)
  const upperThird = Math.floor(h / 3);
  let neckY = Math.floor(h * 0.15);
  let neckWidth = w;
  for (let y = Math.floor(h * 0.05); y < upperThird; y++) {
    if (sliceWidths[y] > 0 && sliceWidths[y] < neckWidth) {
      neckWidth = sliceWidths[y];
      neckY = y;
    }
  }

  // Find narrowest slice in lower 2/3 (waist candidate)
  let waistY = Math.floor(h * 0.55);
  let waistWidth = w;
  for (let y = upperThird; y < Math.floor(h * 0.85); y++) {
    if (sliceWidths[y] > 0 && sliceWidths[y] < waistWidth) {
      waistWidth = sliceWidths[y];
      waistY = y;
    }
  }

  const headKeywords = ["head", "tête", "tete", "helmet", "casque", "skull", "crane"];
  const legKeywords = ["leg", "jambe", "foot", "pied", "boot", "botte", "lower"];
  const torsoKeywords = ["torso", "torse", "body", "corps", "chest", "armor", "chest", "abdomen"];

  const labelLC = label.toLowerCase();

  // Bottom-center (feet pivot) — for all parts
  suggestions.push({
    label: `${label} bottom-center`,
    x: centerX - minX,
    y: maxY - minY,
    confidence: 0.85,
  });

  // Center
  suggestions.push({
    label: `${label} center`,
    x: centerX - minX,
    y: Math.floor((minY + maxY) / 2) - minY,
    confidence: 0.7,
  });

  // Top-center (head attachment)
  if (headKeywords.some(k => labelLC.includes(k))) {
    // Head: pivot at bottom-center (neck attachment)
    suggestions.unshift({
      label: "Head → Neck joint",
      x: centerX - minX,
      y: maxY - minY,
      confidence: 0.95,
    });
  }

  if (torsoKeywords.some(k => labelLC.includes(k))) {
    // Torso: pivot at top-center (neck) and bottom-center (waist)
    suggestions.unshift({
      label: "Torso → Neck joint",
      x: centerX - minX,
      y: neckY - minY,
      confidence: 0.92,
    });
    suggestions.unshift({
      label: "Torso → Waist joint",
      x: centerX - minX,
      y: waistY - minY,
      confidence: 0.90,
    });
  }

  if (legKeywords.some(k => labelLC.includes(k))) {
    // Legs: pivot at top-center (waist attachment)
    suggestions.unshift({
      label: "Legs → Waist joint",
      x: centerX - minX,
      y: 0,
      confidence: 0.95,
    });
  }

  return suggestions;
}

// ── Analyze multiple parts and suggest connections ────────────

export interface RigConnection {
  partA: string; // label of first part
  partB: string; // label of second part
  pivotA: { x: number; y: number }; // pixel coords relative to part A
  pivotB: { x: number; y: number }; // pixel coords relative to part B
  confidence: number;
}

export function suggestConnections(parts: RigPart[]): RigConnection[] {
  const connections: RigConnection[] = [];

  const findPart = (keyword: string) => parts.find(p => p.label.toLowerCase().includes(keyword));

  const head = findPart("head") || findPart("tête") || findPart("tete");
  const torso = findPart("torso") || findPart("torse") || findPart("body") || findPart("corps");
  const legs = findPart("leg") || findPart("jambe") || findPart("foot") || findPart("pied") || findPart("lower");

  if (head && torso) {
    const headPivot = analyzePart(head.image, "head").find(s => s.label.includes("Neck"));
    const torsoPivot = analyzePart(torso.image, "torso").find(s => s.label.includes("Neck"));
    if (headPivot && torsoPivot) {
      connections.push({
        partA: "head",
        partB: "torso",
        pivotA: { x: headPivot.x, y: headPivot.y },
        pivotB: { x: torsoPivot.x, y: torsoPivot.y },
        confidence: 0.9,
      });
    }
  }

  if (torso && legs) {
    const waistPivot = analyzePart(torso.image, "torso").find(s => s.label.includes("Waist"));
    const legsPivot = analyzePart(legs.image, "legs").find(s => s.label.includes("Waist"));
    if (waistPivot && legsPivot) {
      connections.push({
        partA: "torso",
        partB: "legs",
        pivotA: { x: waistPivot.x, y: waistPivot.y },
        pivotB: { x: legsPivot.x, y: legsPivot.y },
        confidence: 0.9,
      });
    }
  }

  return connections;
}
