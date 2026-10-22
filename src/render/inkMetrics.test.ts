import { describe, expect, it } from 'vitest';
import { analyzeInkMask } from './inkMetrics';

function makeMask(width: number, height: number, rects: [number, number, number, number][]) {
  const mask = new Uint8Array(width * height);
  for (const [x0, y0, w, h] of rects) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

describe('analyzeInkMask', () => {
  it('returns nulls for an empty mask', () => {
    expect(analyzeInkMask(new Uint8Array(100), 10, 10)).toEqual({
      bounds: null,
      strokePx: null,
      letterGapPx: null,
    });
  });

  it('measures a solid rectangle as one stroke width', () => {
    const mask = makeMask(20, 30, [[5, 5, 10, 20]]);
    const result = analyzeInkMask(mask, 20, 30);
    expect(result.bounds).toEqual({ minX: 5, minY: 5, maxX: 14, maxY: 24 });
    expect(result.strokePx).toBeCloseTo(10, 5);
    expect(result.letterGapPx).toBeNull();
  });

  it('finds the narrowest empty column run between glyphs', () => {
    // Stems at x=2, 20 and 46: gaps of 12 px and 20 px.
    const mask = makeMask(60, 20, [
      [2, 2, 6, 16],
      [20, 2, 6, 16],
      [46, 2, 6, 16],
    ]);
    const result = analyzeInkMask(mask, 60, 20);
    expect(result.strokePx).toBeCloseTo(6, 5);
    expect(result.letterGapPx).toBe(12);
  });

  it('measures a thin horizontal bar by its vertical run', () => {
    const mask = makeMask(40, 20, [[2, 8, 30, 3]]);
    const result = analyzeInkMask(mask, 40, 20);
    expect(result.strokePx).toBeCloseTo(3, 5);
  });

  it('ignores single-pixel antialiasing fringe', () => {
    const mask = new Uint8Array(25);
    mask[12] = 1;
    const result = analyzeInkMask(mask, 5, 5);
    expect(result.bounds).not.toBeNull();
    expect(result.strokePx).toBeNull();
  });

  it('rejects a mask shorter than width * height', () => {
    expect(analyzeInkMask(new Uint8Array(3), 10, 10).bounds).toBeNull();
  });
});
