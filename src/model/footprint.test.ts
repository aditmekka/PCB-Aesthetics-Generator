import { describe, expect, it } from 'vitest';
import {
  FootprintError,
  binaryMaskToFootprint,
  footprintBaseName,
  sanitizeName,
} from './footprint';
import { DEFAULT_CONFIG } from './defaults';
import type { Config } from './types';

function makeMask(width: number, height: number, blocks: [number, number, number, number][]) {
  const mask = new Uint8Array(width * height);
  for (const [x0, y0, w, h] of blocks) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

const baseOptions = {
  pixelSizeMm: 0.5,
  side: 'front' as const,
  center: false,
  name: 'GND_3V3',
};

describe('binaryMaskToFootprint', () => {
  it('writes a valid empty KiCad 6 footprint', () => {
    const result = binaryMaskToFootprint(new Uint8Array(4), 2, 2, baseOptions);
    expect(result.polygonCount).toBe(0);
    expect(result.widthMm).toBe(1);
    expect(result.heightMm).toBe(1);
    expect(result.text).toContain('(footprint "GND_3V3"');
    expect(result.text).toContain('(version 20211014)');
    expect(result.text).toContain('(layer "F.Cu")');
    expect(result.text).toContain('(fp_text reference "REF**"');
    expect(result.text.endsWith(')\n')).toBe(true);
    expect(result.bytes).toBe(result.text.length);
  });

  it('merges a horizontal run into one rectangle', () => {
    const mask = makeMask(5, 2, [[1, 0, 3, 1]]);
    const result = binaryMaskToFootprint(mask, 5, 2, baseOptions);
    expect(result.polygonCount).toBe(1);
    expect(result.inkPixels).toBe(3);
    expect(result.text).toContain('(xy 0.5 0)');
    expect(result.text).toContain('(xy 2 0)');
    expect(result.text).toContain('(xy 2 0.5)');
    expect(result.text).toContain('(xy 0.5 0.5)');
  });

  it('merges a vertical run into one rectangle', () => {
    const mask = makeMask(3, 4, [[1, 0, 1, 3]]);
    const result = binaryMaskToFootprint(mask, 3, 4, baseOptions);
    expect(result.polygonCount).toBe(1);
    expect(result.inkPixels).toBe(3);
    expect(result.text).toContain('(xy 0.5 0)');
    expect(result.text).toContain('(xy 1 1.5)');
  });

  it('keeps shifted runs as separate rectangles', () => {
    const mask = new Uint8Array(4 * 2);
    mask[0] = 1; // (0, 0)
    mask[4 + 1] = 1; // (1, 1)
    const result = binaryMaskToFootprint(mask, 4, 2, baseOptions);
    expect(result.polygonCount).toBe(2);
    expect(result.inkPixels).toBe(2);
  });

  it('centers coordinates on the footprint origin', () => {
    const mask = makeMask(4, 2, [[0, 0, 4, 2]]);
    const result = binaryMaskToFootprint(mask, 4, 2, {
      ...baseOptions,
      pixelSizeMm: 0.25,
      center: true,
    });
    expect(result.widthMm).toBe(1);
    expect(result.heightMm).toBe(0.5);
    expect(result.text).toContain('(xy -0.5 -0.25)');
    expect(result.text).toContain('(xy 0.5 0.25)');
  });

  it('uses the requested side for all layers', () => {
    const mask = makeMask(1, 1, [[0, 0, 1, 1]]);
    const result = binaryMaskToFootprint(mask, 1, 1, { ...baseOptions, side: 'back' });
    expect(result.text).toContain('(layer "B.Cu")');
    expect(result.text).toContain('(layer "B.SilkS")');
    expect(result.text).toContain('(layer "B.Fab")');
    expect(result.text).not.toContain('F.SilkS');
  });

  it('emits filled polygons on the silkscreen layer', () => {
    const mask = makeMask(1, 1, [[0, 0, 1, 1]]);
    const result = binaryMaskToFootprint(mask, 1, 1, baseOptions);
    expect(result.text).toContain('(fp_poly');
    expect(result.text).toContain('(stroke (width 0.01) (type solid))');
    expect(result.text).toContain('(fill solid)');
    expect(result.text).toContain('(layer "F.SilkS")');
  });

  it('refuses to emit more than the polygon limit', () => {
    // A checkerboard row has one run per ink pixel, so 8 runs.
    const mask = new Uint8Array(16);
    for (let x = 0; x < 16; x += 2) mask[x] = 1;
    expect(() =>
      binaryMaskToFootprint(mask, 16, 1, { ...baseOptions, maxPolygons: 4 })
    ).toThrow(FootprintError);
  });

  it('rejects invalid dimensions and pixel sizes', () => {
    expect(() => binaryMaskToFootprint(new Uint8Array(1), 0, 1, baseOptions)).toThrow(
      FootprintError
    );
    expect(() =>
      binaryMaskToFootprint(makeMask(1, 1, [[0, 0, 1, 1]]), 1, 1, {
        ...baseOptions,
        pixelSizeMm: 0,
      })
    ).toThrow(FootprintError);
    expect(() => binaryMaskToFootprint(new Uint8Array(1), 2, 2, baseOptions)).toThrow(
      FootprintError
    );
  });

  it('sanitises footprint names', () => {
    expect(sanitizeName('My Logo!')).toBe('My_Logo');
    expect(sanitizeName('###')).toBe('silkscreen_knockout');
    expect(sanitizeName('  A.B-c_1  ')).toBe('A.B-c_1');
  });
});

describe('footprintBaseName', () => {
  it('joins the enabled labels', () => {
    expect(footprintBaseName(DEFAULT_CONFIG)).toBe('GND_3V3_TX_RX_DIO_CLK');
  });

  it('updates when labels are disabled or renamed', () => {
    const config: Config = structuredClone(DEFAULT_CONFIG);
    config.labels[1].enabled = false;
    config.labels[2].text = 'V+ V-';
    expect(footprintBaseName(config)).toBe('GND_V_V_RX_DIO_CLK');
  });

  it('uses the captured single label', () => {
    const config: Config = structuredClone(DEFAULT_CONFIG);
    config.export.capture = 'single';
    config.export.singleIndex = 2;
    expect(footprintBaseName(config)).toBe('TX');
  });

  it('falls back when nothing is enabled', () => {
    const config: Config = structuredClone(DEFAULT_CONFIG);
    config.labels = config.labels.map((label) => ({ ...label, enabled: false }));
    expect(footprintBaseName(config)).toBe('silkscreen_knockout');
  });
});
