import type { Arrangement } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelDims {
  textWidthPx: number;
  textHeightPx: number;
  boxWidthPx: number;
  boxHeightPx: number;
}

/** Approximate ratio of a font's cap height to its font-size. */
export const CAP_HEIGHT_RATIO = 0.72;

export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

export function pxToMm(px: number, pxPerMm: number): number {
  return px / pxPerMm;
}

export function pxPerMmFromDpi(dpi: number): number {
  return dpi / 25.4;
}

/**
 * Font-size (px) needed so the actual cap height equals `heightMm`.
 *
 * `capHeightRatio` is cap-height / font-size for the selected font. It is
 * measured from the real font at runtime (see `getCapHeightRatio`), because it
 * varies a lot: ~0.65 for Courier-metric monospace, ~0.72 for Arial. Assuming
 * 0.72 for every font makes "1 mm" text up to 10% too small, which would
 * silently violate JLCPCB's 1 mm minimum.
 */
export function fontSizeFromHeight(
  heightMm: number,
  pxPerMm: number,
  capHeightRatio: number = CAP_HEIGHT_RATIO
): number {
  const ratio = capHeightRatio > 0 ? capHeightRatio : CAP_HEIGHT_RATIO;
  return mmToPx(heightMm, pxPerMm) / ratio;
}

/** Horizontal glyph scale applied to match KiCad's width/height sizing. */
export function horizontalScale(widthMm: number, heightMm: number): number {
  if (heightMm <= 0) return 1;
  return widthMm / heightMm;
}

/** Compute a label's box dimensions (px) from text dimensions + padding. */
export function computeLabelDims(
  textWidthPx: number,
  textHeightPx: number,
  padXPx: number,
  padYPx: number
): LabelDims {
  return {
    textWidthPx,
    textHeightPx,
    boxWidthPx: textWidthPx + 2 * padXPx,
    boxHeightPx: textHeightPx + 2 * padYPx,
  };
}

/**
 * Center position of the i-th enabled label (mm from the origin),
 * once the strip is laid out along `arrangement` at `pitch`.
 */
export function labelCenter(
  i: number,
  pitchMm: number,
  arrangement: Arrangement
): { x: number; y: number } {
  if (arrangement === 'row') return { x: i * pitchMm, y: 0 };
  return { x: 0, y: i * pitchMm };
}
