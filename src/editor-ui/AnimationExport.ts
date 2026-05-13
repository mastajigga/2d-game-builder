// src/editor-ui/AnimationExport.ts
// Export current animation as animated GIF or APNG

// Minimal GIF encoder (LZW, 256-color palette, no dither)
// Based on the GIF89a spec

function encodeGIF(
  frames: ImageData[],
  delayMs: number
): Uint8Array {
  const w = frames[0].width;
  const h = frames[0].height;

  // ── Extract global palette from first frame ──
  const colorMap = new Map<string, number>();
  const palette: [number, number, number][] = [];
  const pixels: number[][] = [];

  for (const frame of frames) {
    const data = frame.data;
    const indices: number[] = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      const r = data[off];
      const g = data[off + 1];
      const b = data[off + 2];
      const a = data[off + 3];
      const key = a < 128 ? "T" : `${r},${g},${b}`;
      let idx = colorMap.get(key);
      if (idx === undefined) {
        idx = palette.length;
        colorMap.set(key, idx);
        palette.push([r, g, b]);
      }
      indices[i] = idx;
    }
    pixels.push(indices);
  }

  // Pad palette to 256
  while (palette.length < 256) {
    palette.push([0, 0, 0]);
  }

  const bitsPerColor = palette.length <= 2 ? 1 : palette.length <= 4 ? 2 : palette.length <= 8 ? 3 :
    palette.length <= 16 ? 4 : palette.length <= 32 ? 5 : palette.length <= 64 ? 6 :
    palette.length <= 128 ? 7 : 8;

  // ── LZW encoder ──
  function lzwEncode(indices: number[], minCodeSize: number): number[] {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let maxCode = (1 << codeSize) - 1;
    let nextCode = eoiCode + 1;

    const dict = new Map<string, number>();
    for (let i = 0; i < clearCode; i++) {
      dict.set(String.fromCharCode(i), i);
    }

    const out: number[] = [];
    let bits = 0;
    let bitCount = 0;

    function writeCode(code: number): void {
      bits |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        out.push(bits & 0xff);
        bits >>= 8;
        bitCount -= 8;
      }
    }

    writeCode(clearCode);

    let w = String.fromCharCode(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = String.fromCharCode(indices[i]);
      const wk = w + k;
      if (dict.has(wk)) {
        w = wk;
      } else {
        writeCode(dict.get(w)!);
        dict.set(wk, nextCode++);
        w = k;
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode = (1 << codeSize) - 1;
        }
        if (nextCode >= 4096) {
          writeCode(clearCode);
          dict.clear();
          for (let j = 0; j < clearCode; j++) dict.set(String.fromCharCode(j), j);
          nextCode = eoiCode + 1;
          codeSize = minCodeSize + 1;
          maxCode = (1 << codeSize) - 1;
        }
      }
    }
    writeCode(dict.get(w)!);
    writeCode(eoiCode);

    // Flush remaining bits
    if (bitCount > 0) out.push(bits & 0xff);
    return out;
  }

  // ── Build GIF ──
  const parts: number[][] = [];

  // Header
  parts.push([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a

  // Logical Screen Descriptor
  const lsd: number[] = [];
  lsd.push(w & 0xff, (w >> 8) & 0xff);
  lsd.push(h & 0xff, (h >> 8) & 0xff);
  lsd.push(0xf0 | (bitsPerColor - 1)); // global color table flag + size
  lsd.push(0); // bg color index
  lsd.push(0); // pixel aspect ratio
  parts.push(lsd);

  // Global Color Table
  for (const [r, g, b] of palette) {
    parts.push([r, g, b]);
  }

  // Application Extension (Netscape 2.0 for looping)
  parts.push([0x21, 0xff, 0x0b]);
  const appExt: number[] = [];
  for (let i = 0; i < 11; i++) appExt.push("NETSCAPE2.0".charCodeAt(i));
  appExt.push(3, 1, 0, 0, 0); // loop forever
  parts.push(appExt);

  // Graphic Control Extension + Image Descriptor per frame
  const delayHundredths = Math.round(delayMs / 10);
  const delayLo = delayHundredths & 0xff;
  const delayHi = (delayHundredths >> 8) & 0xff;

  for (let f = 0; f < pixels.length; f++) {
    // Graphic Control Extension
    parts.push([0x21, 0xf9, 0x04, 0x04, delayLo, delayHi, 0, 0]);

    // Image Descriptor
    const id: number[] = [0x2c];
    id.push(0, 0, 0, 0); // left, top
    id.push(w & 0xff, (w >> 8) & 0xff);
    id.push(h & 0xff, (h >> 8) & 0xff);
    id.push(0); // no local color table
    parts.push(id);

    // LZW encode
    const minCode = Math.max(2, bitsPerColor);
    const lzwData = lzwEncode(pixels[f], minCode);
    const lzwSize = lzwData.length;

    // Write as sub-blocks
    parts.push([minCode]);
    let pos = 0;
    while (pos < lzwSize) {
      const blockSize = Math.min(255, lzwSize - pos);
      parts.push([blockSize]);
      parts.push(lzwData.slice(pos, pos + blockSize));
      pos += blockSize;
    }
    parts.push([0]); // block terminator
  }

  // Trailer
  parts.push([0x3b]);

  // Flatten
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }

  return result;
}

// ── Export API ────────────────────────────────────────────────

export interface ExportFrames {
  frames: ImageData[];    // raw RGBA per frame
  delayMs: number;        // delay between frames
}

export function exportGIF(frames: ExportFrames): Blob {
  const gifBytes = encodeGIF(frames.frames, frames.delayMs);
  return new Blob([gifBytes], { type: "image/gif" });
}

export function exportAPNG(frames: ExportFrames): Blob {
  // APNG encoding — builds on PNG + fcTL/fdAT chunks
  const w = frames.frames[0].width;
  const h = frames.frames[0].height;

  const parts: Uint8Array[] = [];

  // ── Helpers ──
  function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      c ^= data[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, data: Uint8Array): Uint8Array {
    const len = data.length;
    const total = 12 + len;
    const c = new Uint8Array(total);
    const view = new DataView(c.buffer);
    view.setUint32(0, len);
    for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(data, 8);
    const crcVal = crc32(c.subarray(4, 8 + len));
    view.setUint32(8 + len, crcVal);
    return c;
  }

  function pngIHDR(): Uint8Array {
    const d = new Uint8Array(13);
    const v = new DataView(d.buffer);
    v.setUint32(0, w); v.setUint32(4, h);
    d[8] = 8; d[9] = 6; // bit depth 8, RGBA
    d[10] = 0; d[11] = 0; d[12] = 0;
    return chunk("IHDR", d);
  }

  function acTL(numFrames: number, numPlays: number): Uint8Array {
    const d = new Uint8Array(8);
    const v = new DataView(d.buffer);
    v.setUint32(0, numFrames);
    v.setUint32(4, numPlays);
    return chunk("acTL", d);
  }

  function fcTL(seqNum: number, delayNum: number, delayDen: number, disposeOp: number, blendOp: number): Uint8Array {
    const d = new Uint8Array(26);
    const v = new DataView(d.buffer);
    v.setUint32(0, seqNum);
    v.setUint32(4, w); v.setUint32(8, h);
    v.setUint32(12, 0); v.setUint32(16, 0); // offset
    v.setUint16(20, delayNum);
    v.setUint16(22, delayDen);
    d[24] = disposeOp;
    d[25] = blendOp;
    return chunk("fcTL", d);
  }

  function encodeFrame(frame: ImageData): Uint8Array {
    // PNG filter: None (0) per row, RGBA
    const rawSize = h * (1 + w * 4);
    const raw = new Uint8Array(rawSize);
    for (let y = 0; y < h; y++) {
      const rowOff = y * (1 + w * 4);
      raw[rowOff] = 0; // filter None
      for (let x = 0; x < w; x++) {
        const srcOff = (y * w + x) * 4;
        const dstOff = rowOff + 1 + x * 4;
        raw[dstOff] = frame.data[srcOff];
        raw[dstOff + 1] = frame.data[srcOff + 1];
        raw[dstOff + 2] = frame.data[srcOff + 2];
        raw[dstOff + 3] = frame.data[srcOff + 3];
      }
    }

    // Deflate (use built-in CompressionStream if available, else simple store)
    // We'll use a simple zlib wrapper with uncompressed blocks
    const rawLen = raw.length;
    const deflated: number[] = [];
    // CMF: deflate, window size 32K
    deflated.push(0x78, 0x01);
    // Raw deflate blocks (non-compressed)
    let pos = 0;
    while (pos < rawLen) {
      const blockSize = Math.min(65535, rawLen - pos);
      const isFinal = pos + blockSize >= rawLen ? 1 : 0;
      deflated.push(isFinal);
      deflated.push(blockSize & 0xff, (blockSize >> 8) & 0xff);
      deflated.push((~blockSize) & 0xff, ((~blockSize) >> 8) & 0xff);
      for (let i = 0; i < blockSize; i++) deflated.push(raw[pos + i]);
      pos += blockSize;
    }
    // Adler32 checksum
    let s1 = 1, s2 = 0;
    for (let i = 0; i < rawLen; i++) {
      s1 = (s1 + raw[i]) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    deflated.push((s2 >> 8) & 0xff, s2 & 0xff, (s1 >> 8) & 0xff, s1 & 0xff);

    return new Uint8Array(deflated);
  }

  // Build APNG
  // PNG signature
  parts.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  parts.push(pngIHDR());
  parts.push(acTL(frames.frames.length, 0)); // 0 = infinite loop

  // First frame: IDAT (normal PNG)
  parts.push(fcTL(0, Math.round(frames.delayMs * 1000), 100000, 0, 0));
  parts.push(chunk("IDAT", encodeFrame(frames.frames[0])));

  // Subsequent frames: fdAT
  for (let i = 1; i < frames.frames.length; i++) {
    parts.push(fcTL(i, Math.round(frames.delayMs * 1000), 100000, 1, 0));
    const fdData = encodeFrame(frames.frames[i]);
    const seqData = new Uint8Array(4 + fdData.length);
    new DataView(seqData.buffer).setUint32(0, i);
    seqData.set(fdData, 4);
    parts.push(chunk("fdAT", seqData));
  }

  // IEND
  parts.push(chunk("IEND", new Uint8Array(0)));

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const apng = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) { apng.set(p, off); off += p.length; }

  return new Blob([apng], { type: "image/apng" });
}

export function captureFramesFromSheet(
  sheetImg: HTMLImageElement,
  frameW: number,
  frameH: number,
  framesPerRow: number,
  frameStart: number,
  frameEnd: number,
): ImageData[] {
  const frames: ImageData[] = [];
  const tmp = document.createElement("canvas");
  tmp.width = sheetImg.naturalWidth;
  tmp.height = sheetImg.naturalHeight;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(sheetImg, 0, 0);

  for (let i = frameStart; i <= frameEnd; i++) {
    const sx = (i % framesPerRow) * frameW;
    const sy = Math.floor(i / framesPerRow) * frameH;
    frames.push(tctx.getImageData(sx, sy, frameW, frameH));
  }
  return frames;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
