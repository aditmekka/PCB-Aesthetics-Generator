import { CAP_HEIGHT_RATIO } from '../model/layout';
import { analyzeInkMask } from './inkMetrics';

/**
 * Raster text metrics measured from the browser's real font rendering.
 *
 * The canvas only gives us advance/ink extents, not the stroke thickness. We
 * therefore render the glyphs into a small offscreen bitmap and measure:
 *  - the dominant stroke width (stem width), and
 *  - the narrowest gap between adjacent characters.
 *
 * Those are the two JLCPCB character rules that cannot be derived from config
 * values alone. A fixed measurement scale is used (80 px/mm) so the result is
 * independent of the export DPI.
 */

const MEASURE_PPM = 80;
const MAX_CANVAS_SIDE = 8192;
const CACHE_LIMIT = 600;

const capRatioCache = new Map<string, number>();
const metricsCache = new Map<string, RenderTextMetrics>();

let scratch: CanvasRenderingContext2D | null | undefined;

function getScratchContext(): CanvasRenderingContext2D | null {
  if (scratch !== undefined) return scratch;
  if (typeof document === 'undefined') {
    scratch = null;
    return scratch;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  scratch = canvas.getContext('2d');
  return scratch;
}

/**
 * Cap-height / font-size ratio for a font, measured from the actual 'H' glyph.
 * Falls back to the classic 0.72 if the font cannot be measured.
 */
export function getCapHeightRatio(family: string, weight: number): number {
  const key = `${weight}\u0000${family}`;
  const cached = capRatioCache.get(key);
  if (cached !== undefined) return cached;

  let ratio = CAP_HEIGHT_RATIO;
  const ctx = getScratchContext();
  if (ctx) {
    ctx.font = fontSpec(weight, 100, family);
    ctx.letterSpacing = '0px';
    const m = ctx.measureText('H');
    const measured = m.actualBoundingBoxAscent / 100;
    if (Number.isFinite(measured) && measured >= 0.4 && measured <= 0.95) {
      ratio = measured;
    }
  }
  capRatioCache.set(key, ratio);
  return ratio;
}

export interface RenderTextMetrics {
  /**
   * Extra outward stroke (mm) applied to reach the requested stroke target.
   * Zero when the font's natural stroke is already at least as wide.
   */
  boostMm: number;
  /** Measured effective stroke width (mm), or null when unmeasurable. */
  strokeMm: number | null;
  /** Narrowest ink gap between characters (mm), or null when not applicable. */
  letterGapMm: number | null;
}

const EMPTY_METRICS: RenderTextMetrics = {
  boostMm: 0,
  strokeMm: null,
  letterGapMm: null,
};

/**
 * Measure how a label will actually render, including a stroke boost when the
 * requested minimum stroke is wider than the font's natural stroke.
 */
export function measureTextRendering(args: {
  text: string;
  family: string;
  weight: number;
  /** Font size in px at the caller's `pxPerMm`. */
  fontPx: number;
  pxPerMm: number;
  hscale: number;
  /** Extra letter spacing in px at the caller's `pxPerMm`. */
  letterSpacingPx: number;
  targetStrokeMm: number;
}): RenderTextMetrics {
  const { text, family, weight, fontPx, pxPerMm, hscale, letterSpacingPx, targetStrokeMm } =
    args;
  if (!text || pxPerMm <= 0 || fontPx <= 0) return EMPTY_METRICS;

  const key = [
    text,
    family,
    String(weight),
    fontPx.toFixed(3),
    pxPerMm.toFixed(4),
    hscale.toFixed(4),
    letterSpacingPx.toFixed(4),
    Math.max(0, targetStrokeMm).toFixed(4),
  ].join('\u0000');

  const cached = metricsCache.get(key);
  if (cached) return cached;

  const result = measureUncached({
    text,
    family,
    weight,
    fontPx,
    pxPerMm,
    hscale,
    letterSpacingPx,
    targetStrokeMm,
  });
  if (metricsCache.size >= CACHE_LIMIT) {
    const oldest = metricsCache.keys().next().value;
    if (oldest !== undefined) metricsCache.delete(oldest);
  }
  metricsCache.set(key, result);
  return result;
}

interface MeasureArgs {
  text: string;
  family: string;
  weight: number;
  fontPx: number;
  pxPerMm: number;
  hscale: number;
  letterSpacingPx: number;
  targetStrokeMm: number;
}

function measureUncached(args: MeasureArgs): RenderTextMetrics {
  const { text, family, weight, fontPx, pxPerMm, hscale, letterSpacingPx, targetStrokeMm } = args;
  const target = Math.max(0, targetStrokeMm);

  let boostPx = 0;
  let draw = drawTextMask(
    text,
    family,
    weight,
    fontPx,
    pxPerMm,
    hscale,
    letterSpacingPx,
    boostPx
  );
  if (!draw) return EMPTY_METRICS;

  let strokePx = draw.analysis.strokePx !== null ? draw.analysis.strokePx + 0.5 : null;

  // Two correction passes are enough in practice; the first gets within a
  // pixel, the second removes the residual under-shoot.
  for (let pass = 0; pass < 2; pass++) {
    if (strokePx === null || target <= 0) break;
    const deficitMm = target - strokePx / draw.ppm;
    if (deficitMm <= 0.002) break;
    const addPx = (deficitMm * draw.ppm) / Math.min(1, Math.max(0.2, hscale));
    if (addPx < 0.15) break;
    boostPx += addPx;
    const next = drawTextMask(
      text,
      family,
      weight,
      fontPx,
      pxPerMm,
      hscale,
      letterSpacingPx,
      boostPx
    );
    if (!next) break;
    draw = next;
    strokePx = next.analysis.strokePx !== null ? next.analysis.strokePx + 0.5 : null;
  }

  return {
    boostMm: boostPx / draw.ppm,
    strokeMm: strokePx !== null ? strokePx / draw.ppm : null,
    letterGapMm:
      draw.analysis.letterGapPx !== null ? draw.analysis.letterGapPx / draw.ppm : null,
  };
}

interface MaskDraw {
  analysis: ReturnType<typeof analyzeInkMask>;
  /** Pixels per mm used for this bitmap (reduced for very long text). */
  ppm: number;
}

function drawTextMask(
  text: string,
  family: string,
  weight: number,
  fontPx: number,
  pxPerMm: number,
  hscale: number,
  letterSpacingPx: number,
  boostPx: number
): MaskDraw | null {
  const scratchCtx = getScratchContext();
  if (!scratchCtx) return null;

  const baseSize = (fontPx / pxPerMm) * MEASURE_PPM;
  if (!Number.isFinite(baseSize) || baseSize <= 0) return null;
  const baseSpacing = (letterSpacingPx / pxPerMm) * MEASURE_PPM;

  // Measure at the nominal scale first, then shrink if the label is so long
  // that the bitmap would exceed canvas limits.
  scratchCtx.font = fontSpec(weight, baseSize, family);
  scratchCtx.letterSpacing = `${baseSpacing}px`;
  const m = scratchCtx.measureText(text);
  const xMin = -m.actualBoundingBoxLeft;
  const xMax = m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent || baseSize * 0.72;
  const descent = m.actualBoundingBoxDescent || 0;
  const inkW = Math.max(0, (xMax - xMin) * hscale);
  const inkH = Math.max(0, ascent + descent);
  if (inkW <= 0 || inkH <= 0) return null;

  const padAtScale = (boostPx * Math.max(1, hscale)) / 2 + 4;
  let scale = 1;
  const maxSide = MAX_CANVAS_SIDE - 32;
  const wEstimate = inkW + padAtScale * 2;
  const hEstimate = inkH + padAtScale * 2;
  if (wEstimate > maxSide) scale = Math.min(scale, maxSide / wEstimate);
  if (hEstimate > maxSide) scale = Math.min(scale, maxSide / hEstimate);
  scale = Math.max(0.05, scale);

  const ppm = MEASURE_PPM * scale;
  // Below ~20 px/mm a 0.15 mm gap is under 3 px and the stroke/gap estimates
  // become meaningless; report "unmeasured" rather than a false failure.
  if (ppm < 20) return null;
  const size = baseSize * scale;
  const spacing = baseSpacing * scale;
  const boost = boostPx * scale;
  const hScale = hscale;
  const pad = (boost * Math.max(1, hScale)) / 2 + 4;

  const width = Math.max(1, Math.ceil(inkW * scale + pad * 2));
  const height = Math.max(1, Math.ceil(inkH * scale + pad * 2));
  if (width * height > 40_000_000) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const font = fontSpec(weight, size, family);
  ctx.font = font;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.save();
  ctx.translate(pad - xMin * hScale * scale, pad + ascent * scale);
  ctx.scale(hScale, 1);
  ctx.font = font;
  if (boost > 0.05) {
    ctx.lineWidth = boost;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;

  return { analysis: analyzeInkMask(mask, width, height), ppm };
}

function fontSpec(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}
