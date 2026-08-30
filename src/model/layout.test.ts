import { describe, expect, it } from 'vitest';
import {
  computeLabelDims,
  fontSizeFromHeight,
  mmToPx,
  pxPerMmFromDpi,
  pxToMm,
} from './layout';

const DPI = 600;
const pxPerMm = pxPerMmFromDpi(DPI);

describe('layout math', () => {
  it('converts mm to px at the given DPI', () => {
    // 2.54 mm at 600 DPI = 2.54 * 600 / 25.4 = 60 px
    expect(mmToPx(2.54, pxPerMm)).toBeCloseTo(60, 1);
  });

  it('converts px back to mm', () => {
    expect(pxToMm(60, pxPerMm)).toBeCloseTo(2.54, 2);
  });

  it('computes box dimensions from text + padding', () => {
    const dims = computeLabelDims(50, 20, 10, 5);
    expect(dims.boxWidthPx).toBe(70);
    expect(dims.boxHeightPx).toBe(30);
  });

  it('derives font-size so cap height matches the requested mm height', () => {
    const fs = fontSizeFromHeight(1, 100);
    expect(fs).toBeCloseTo(100 / 0.72, 1);
  });

  it('maps 2.54mm to exactly 60px at 600 DPI', () => {
    expect(pxPerMm).toBeCloseTo(600 / 25.4, 5);
  });
});
