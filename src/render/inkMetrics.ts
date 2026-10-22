/**
 * Pure raster analysis used by the JLCPCB compliance checks.
 *
 * Everything here works on a boolean ink mask (1 = ink) so it can be unit
 * tested without a canvas.
 */

export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface InkAnalysis {
  /** Bounding box of all inked pixels, or null for an empty mask. */
  bounds: InkBounds | null;
  /**
   * Dominant stroke width in pixels. This is the most common of
   * `min(horizontal run, vertical run)` over the glyph, which converges on the
   * stem width for normal outline fonts. Null when the mask is empty.
   */
  strokePx: number | null;
  /**
   * Narrowest empty column run between two inked columns, in pixels. This is
   * the ink gap between adjacent characters. Null for single-character text or
   * when no internal gap exists.
   */
  letterGapPx: number | null;
}

/**
 * Analyse a packed ink mask (`width * height` bytes, row major).
 *
 * The stroke estimate intentionally ignores runs shorter than 2 px: those are
 * antialiasing fringe / pointed terminal tips rather than real stems.
 */
export function analyzeInkMask(mask: Uint8Array, width: number, height: number): InkAnalysis {
  if (width <= 0 || height <= 0 || mask.length < width * height) {
    return { bounds: null, strokePx: null, letterGapPx: null };
  }

  const n = width * height;
  const hRun = new Int32Array(n);
  const colInk = new Uint8Array(width);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // Horizontal runs, plus ink bounds / occupied columns in the same pass.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        run++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        colInk[x] = 1;
      } else if (run > 0) {
        for (let k = x - run; k < x; k++) hRun[row + k] = run;
        run = 0;
      }
    }
    if (run > 0) {
      for (let k = width - run; k < width; k++) hRun[row + k] = run;
    }
  }

  if (maxX < minX || maxY < minY) {
    return { bounds: null, strokePx: null, letterGapPx: null };
  }

  // Vertical runs; combine with the horizontal run to estimate local thickness.
  const histogram = new Map<number, number>();
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) {
        run++;
      } else if (run > 0) {
        for (let k = y - run; k < y; k++) {
          const v = Math.min(hRun[k * width + x], run);
          if (v >= 2) histogram.set(v, (histogram.get(v) ?? 0) + 1);
        }
        run = 0;
      }
    }
    if (run > 0) {
      for (let k = height - run; k < height; k++) {
        const v = Math.min(hRun[k * width + x], run);
        if (v >= 2) histogram.set(v, (histogram.get(v) ?? 0) + 1);
      }
    }
  }

  // Dominant run width: average the pixels around the histogram peak. Using a
  // small plateau instead of the exact mode keeps the estimate stable across
  // hinting/antialiasing, where a stem can alternate between 9 and 10 px.
  let peak = 0;
  for (const count of histogram.values()) if (count > peak) peak = count;
  let strokePx: number | null = null;
  if (peak > 0) {
    let weighted = 0;
    let pixels = 0;
    for (const [value, count] of histogram) {
      if (count >= peak * 0.92) {
        weighted += value * count;
        pixels += count;
      }
    }
    strokePx = pixels > 0 ? weighted / pixels : null;
  }

  // Internal empty column runs = inter-character gaps.
  let letterGapPx: number | null = null;
  let emptyRun = 0;
  for (let x = minX; x <= maxX; x++) {
    if (colInk[x]) {
      if (emptyRun > 0 && (letterGapPx === null || emptyRun < letterGapPx)) {
        letterGapPx = emptyRun;
      }
      emptyRun = 0;
    } else {
      emptyRun++;
    }
  }

  return {
    bounds: { minX, minY, maxX, maxY },
    strokePx,
    letterGapPx,
  };
}
