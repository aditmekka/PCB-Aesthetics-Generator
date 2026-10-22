import type { Config } from './types';

/**
 * Browser port of the img2mod approach: turn a 1-bit silkscreen bitmap into a
 * KiCad footprint (.kicad_mod) made of filled `fp_poly` rectangles.
 *
 * The original img2mod (Matthew Beckler / Wayne and Layne, GPLv2) emits one
 * 4-point polygon per black pixel. This port merges horizontal/vertical pixel
 * runs into rectangles first, which covers exactly the same area but keeps
 * text-sized artwork from producing hundreds of thousands of polygons.
 */

export type FootprintSide = 'front' | 'back';

export interface FootprintOptions {
  /** Physical size of one bitmap pixel, in millimetres. */
  pixelSizeMm: number;
  /** Which side the silkscreen polygons are placed on. */
  side: FootprintSide;
  /** Put the graphic's centre at the footprint origin. */
  center: boolean;
  /** Footprint name (sanitised further below). */
  name: string;
  /** Safety limit; throws `FootprintError` above it. */
  maxPolygons?: number;
}

export interface FootprintResult {
  /** Sanitised footprint name (also used for the file name). */
  name: string;
  /** Full .kicad_mod text. */
  text: string;
  polygonCount: number;
  widthMm: number;
  heightMm: number;
  inkPixels: number;
  /** UTF-8 byte length of `text` (ASCII in practice). */
  bytes: number;
}

export class FootprintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootprintError';
  }
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Convert a packed 1-bit ink mask (`width * height`, row-major, 1 = ink) into a
 * KiCad 6+ footprint. Pure: no canvas or DOM access, so it can be unit tested.
 */
export function binaryMaskToFootprint(
  mask: Uint8Array,
  width: number,
  height: number,
  options: FootprintOptions
): FootprintResult {
  if (!Number.isFinite(options.pixelSizeMm) || options.pixelSizeMm <= 0) {
    throw new FootprintError('Pixel size must be greater than zero.');
  }
  if (width <= 0 || height <= 0) {
    throw new FootprintError('The rendered image is empty.');
  }
  if (mask.length < width * height) {
    throw new FootprintError('The ink mask is smaller than the image dimensions.');
  }

  const maxPolygons = options.maxPolygons ?? 100_000;
  const rects: Rect[] = [];
  let inkPixels = 0;
  let active = new Map<string, Rect>();

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const next = new Map<string, Rect>();

    let x = 0;
    while (x < width) {
      if (!mask[row + x]) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < width && mask[row + x]) x++;
      const x1 = x;
      inkPixels += x1 - x0;

      const key = `${x0}:${x1}`;
      const previous = active.get(key);
      if (previous && previous.y1 === y) {
        // Extend the rectangle from the row above.
        previous.y1 = y + 1;
        next.set(key, previous);
      } else {
        next.set(key, { x0, x1, y0: y, y1: y + 1 });
      }
    }

    // Rectangles that do not continue into this row are complete.
    for (const [key, rect] of active) {
      if (!next.has(key)) rects.push(rect);
    }
    active = next;

    if (rects.length + active.size > maxPolygons) {
      throw new FootprintError(
        `This pixel size would create more than ${maxPolygons.toLocaleString()} polygons. Increase the pixel size.`
      );
    }
  }
  for (const rect of active.values()) rects.push(rect);

  rects.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  const pixelSize = options.pixelSizeMm;
  const widthMm = width * pixelSize;
  const heightMm = height * pixelSize;
  const offsetX = options.center ? widthMm / 2 : 0;
  const offsetY = options.center ? heightMm / 2 : 0;
  const name = sanitizeName(options.name);
  const cupLayer = options.side === 'front' ? 'F.Cu' : 'B.Cu';
  const silkLayer = options.side === 'front' ? 'F.SilkS' : 'B.SilkS';
  const fabLayer = options.side === 'front' ? 'F.Fab' : 'B.Fab';

  const description = `Silkscreen artwork from PCB Knockout Generator - ${widthMm.toFixed(
    2
  )} x ${heightMm.toFixed(2)} mm - ${pixelSize.toFixed(4)} mm per pixel`.replace(
    /["\\]/g,
    ' '
  );

  const header =
    `(footprint "${name}"\n` +
    `  (version 20211014)\n` +
    `  (generator pcb-silkscreen-knockout-generator)\n` +
    `  (layer "${cupLayer}")\n` +
    `  (at 0 0)\n` +
    `  (descr "${description}")\n` +
    `  (fp_text reference "REF**" (at 0 0) (layer "${silkLayer}") hide\n` +
    `    (effects (font (size 1 1) (thickness 0.15)))\n` +
    `  )\n` +
    `  (fp_text value "${name}" (at 0 0) (layer "${fabLayer}") hide\n` +
    `    (effects (font (size 1 1) (thickness 0.15)))\n` +
    `  )\n`;

  const parts: string[] = [header];
  for (const rect of rects) {
    const x0 = formatCoord(rect.x0 * pixelSize - offsetX);
    const y0 = formatCoord(rect.y0 * pixelSize - offsetY);
    const x1 = formatCoord(rect.x1 * pixelSize - offsetX);
    const y1 = formatCoord(rect.y1 * pixelSize - offsetY);
    parts.push(
      `  (fp_poly\n` +
        `    (pts\n` +
        `      (xy ${x0} ${y0})\n` +
        `      (xy ${x1} ${y0})\n` +
        `      (xy ${x1} ${y1})\n` +
        `      (xy ${x0} ${y1})\n` +
        `    )\n` +
        `    (stroke (width 0.01) (type solid))\n` +
        `    (fill solid)\n` +
        `    (layer "${silkLayer}")\n` +
        `  )\n`
    );
  }
  parts.push(')\n');

  const text = parts.join('');
  return {
    name,
    text,
    polygonCount: rects.length,
    widthMm,
    heightMm,
    inkPixels,
    bytes: text.length,
  };
}

/** Number formatting with 0.0001 mm precision, without trailing zeroes. */
function formatCoord(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded === 0 ? '0' : String(rounded);
}

/** KiCad-safe footprint name. */
export function sanitizeName(raw: string): string {
  const name = raw
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '')
    .slice(0, 120);
  return name || 'silkscreen_knockout';
}

/**
 * File/footprint name for the current design. Mirrors the PNG export naming:
 * the enabled labels (or the single captured label) joined by underscores.
 */
export function footprintBaseName(config: Config): string {
  const labels =
    config.export.capture === 'single'
      ? [config.labels[config.export.singleIndex]]
      : config.labels.filter((label) => label.enabled);
  const token = (text: string): string =>
    text
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const parts = labels
    .filter((label): label is NonNullable<typeof label> => Boolean(label))
    .map((label) => token(label.text))
    .filter(Boolean);
  return (parts.join('_') || 'silkscreen_knockout').slice(0, 120);
}
