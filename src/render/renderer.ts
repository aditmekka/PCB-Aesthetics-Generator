import type { Config, LabelConfig, TextStyle } from '../model/types';
import {
  fontSizeFromHeight,
  horizontalScale,
  mmToPx,
  pxPerMmFromDpi,
} from '../model/layout';

export interface LabelRender {
  text: string;
  /** Box center X in mm (anchor + alignment offset). */
  centerX: number;
  /** Box center Y in mm (anchor + alignment offset). */
  centerY: number;
  /** Rotation in radians. */
  rotation: number;
  /** Box width in px (hugs the actual glyph ink + padding). */
  boxW: number;
  /** Box height in px (hugs the actual glyph ink + padding). */
  boxH: number;
  /** Corner radius in px. */
  cornerR: number;
  /** Full CSS font string. */
  font: string;
  /** Horizontal glyph scale (width/height). */
  hscale: number;
  /** Text origin offset from the box center (px, in the box frame). */
  textOffsetX: number;
  textOffsetY: number;
  /** Whether to draw an individual box behind this label's text. */
  showBox: boolean;
}

export interface Scene {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pxPerMm: number;
  offsetX: number;
  offsetY: number;
  labels: LabelRender[];
  widthPx: number;
  heightPx: number;
  contentWidthMm: number;
  contentHeightMm: number;
}

export function resolveTextStyle(label: LabelConfig, config: Config): TextStyle {
  return { ...config.text, ...(label.style ?? {}) };
}

interface InkMetrics {
  left: number;
  right: number;
  ascent: number;
  descent: number;
}

/**
 * Measure the actual glyph ink extents relative to a left/alphabetic origin.
 * This is "graphics based": we align on the real drawn pixels rather than the
 * font's advance width, so e.g. right-aligned vertical text has every right
 * edge on the same line.
 */
function measureTextInk(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string
): InkMetrics {
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  return {
    left: m.actualBoundingBoxLeft || 0,
    right: m.actualBoundingBoxRight || 0,
    ascent: m.actualBoundingBoxAscent || 0,
    descent: m.actualBoundingBoxDescent || 0,
  };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

interface CornerFlags {
  tl: boolean;
  tr: boolean;
  bl: boolean;
  br: boolean;
}

function roundedRectPathCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  c: CornerFlags
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + (c.tl ? rr : 0), y);
  ctx.lineTo(x + w - (c.tr ? rr : 0), y);
  if (c.tr) ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - (c.br ? rr : 0));
  if (c.br) ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + (c.bl ? rr : 0), y + h);
  if (c.bl) ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + (c.tl ? rr : 0));
  if (c.tl) ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function rotatedBounds(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const hw = w / 2;
  const hh = h / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of corners) {
    const rx = cx + x * cos - y * sin;
    const ry = cy + x * sin + y * cos;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
  return { minX, minY, maxX, maxY };
}

export function computeLabels(
  ctx: CanvasRenderingContext2D,
  config: Config,
  pxPerMm: number
): LabelRender[] {
  const labels: LabelRender[] = [];
  const { box, layout } = config;
  const padX = mmToPx(box.padX, pxPerMm);
  const padY = mmToPx(box.padY, pxPerMm);
  const cornerR = mmToPx(box.cornerRadius, pxPerMm);
  const rotation = (layout.orientation * Math.PI) / 180;

  let i = 0;
  for (const label of config.labels) {
    if (!label.enabled) continue;
    const t = resolveTextStyle(label, config);
    const fontSize = fontSizeFromHeight(t.height, pxPerMm);
    const hscale = horizontalScale(t.width, t.height);
    const font = `${t.weight} ${fontSize}px ${t.font}`;
    const ink = measureTextInk(ctx, label.text, font);

    // Ink extents (px, after horizontal scale), relative to the text origin.
    const x0 = ink.left * hscale;
    const x1 = ink.right * hscale;
    const y0 = -ink.ascent;
    const y1 = ink.descent;
    const inkCX = (x0 + x1) / 2;
    const inkCY = (y0 + y1) / 2;
    const inkW = x1 - x0;
    const inkH = y1 - y0;

    // Anchor at the pitch position; the box is centred on the ink. Alignment
    // offsets the whole box+text unit so the ink's aligned edge sits on the
    // anchor line (graphics-based, using the real glyph extents).
    const anchorX = layout.originX + (layout.arrangement === 'row' ? i * layout.pitch : 0);
    const anchorY = layout.originY + (layout.arrangement === 'column' ? i * layout.pitch : 0);

    let boxCX: number;
    if (t.hAlign === 'left') boxCX = -x0 + inkCX;
    else if (t.hAlign === 'right') boxCX = -x1 + inkCX;
    else boxCX = 0;

    let boxCY: number;
    if (t.vAlign === 'top') boxCY = -y0 + inkCY;
    else if (t.vAlign === 'bottom') boxCY = -y1 + inkCY;
    else boxCY = 0;

    labels.push({
      text: label.text,
      centerX: anchorX + boxCX / pxPerMm,
      centerY: anchorY + boxCY / pxPerMm,
      rotation,
      boxW: inkW + 2 * padX,
      boxH: inkH + 2 * padY,
      cornerR,
      font,
      hscale,
      textOffsetX: -inkCX,
      textOffsetY: -inkCY,
      showBox: label.showBox !== false,
    });
    i++;
  }
  return labels;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(labels: LabelRender[], pxPerMm: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of labels) {
    const b = rotatedBounds(l.centerX * pxPerMm, l.centerY * pxPerMm, l.boxW, l.boxH, l.rotation);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (labels.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

interface LayoutInfo {
  content: Bounds;
  plate: Bounds;
  widthPx: number;
  heightPx: number;
  offsetX: number;
  offsetY: number;
  /** Size of the visible box (the plate if shown, else the content). */
  boxWidthMm: number;
  boxHeightMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  plateCornerR: number;
  plateCorners: CornerFlags;
}

/** Compute the content and plate bounds, the canvas size, and the draw offset. */
function computeLayout(config: Config, labels: LabelRender[], pxPerMm: number): LayoutInfo {
  const marginPx = mmToPx(config.export.margin, pxPerMm);
  const plate = config.plate;
  const content = computeBounds(labels, pxPerMm);

  let plateBounds: Bounds;
  let explicitCanvas = false;
  if (plate.showPlate) {
    const pm = mmToPx(plate.marginMm, pxPerMm);
    if (plate.widthMm > 0 && plate.heightMm > 0) {
      const pw = mmToPx(plate.widthMm, pxPerMm);
      const ph = mmToPx(plate.heightMm, pxPerMm);
      const ccx = (content.minX + content.maxX) / 2;
      const ccy = (content.minY + content.maxY) / 2;
      plateBounds = {
        minX: ccx - pw / 2,
        minY: ccy - ph / 2,
        maxX: ccx + pw / 2,
        maxY: ccy + ph / 2,
      };
      // An explicit plate size defines the output canvas exactly (no extra
      // margin), so the box you measure in KiCad matches the exported size.
      explicitCanvas = true;
    } else {
      plateBounds = {
        minX: content.minX - pm,
        minY: content.minY - pm,
        maxX: content.maxX + pm,
        maxY: content.maxY + pm,
      };
    }
  } else {
    plateBounds = content;
  }

  let width: number;
  let height: number;
  let offsetX: number;
  let offsetY: number;
  if (explicitCanvas) {
    width = Math.max(1, Math.ceil(plateBounds.maxX - plateBounds.minX));
    height = Math.max(1, Math.ceil(plateBounds.maxY - plateBounds.minY));
    offsetX = -plateBounds.minX;
    offsetY = -plateBounds.minY;
  } else {
    width = Math.max(1, Math.ceil(plateBounds.maxX - plateBounds.minX + 2 * marginPx));
    height = Math.max(1, Math.ceil(plateBounds.maxY - plateBounds.minY + 2 * marginPx));
    offsetX = marginPx - plateBounds.minX;
    offsetY = marginPx - plateBounds.minY;
  }

  return {
    content,
    plate: plateBounds,
    widthPx: width,
    heightPx: height,
    offsetX,
    offsetY,
    boxWidthMm: pxPerMm > 0 ? (plateBounds.maxX - plateBounds.minX) / pxPerMm : 0,
    boxHeightMm: pxPerMm > 0 ? (plateBounds.maxY - plateBounds.minY) / pxPerMm : 0,
    contentWidthMm: pxPerMm > 0 ? (content.maxX - content.minX) / pxPerMm : 0,
    contentHeightMm: pxPerMm > 0 ? (content.maxY - content.minY) / pxPerMm : 0,
    plateCornerR: mmToPx(plate.cornerRadiusMm, pxPerMm),
    plateCorners: { tl: plate.roundTL, tr: plate.roundTR, bl: plate.roundBL, br: plate.roundBR },
  };
}

/**
 * Draw the label's text. The context must already be translated to the label's
 * box center and rotated; the text origin is offset so the ink is centred in
 * the box (box itself is offset from the anchor per alignment).
 */
function drawLabelText(
  ctx: CanvasRenderingContext2D,
  label: LabelRender,
  fillStyle: string
): void {
  const { textOffsetX, textOffsetY, hscale, font, text } = label;
  ctx.translate(textOffsetX, textOffsetY);
  ctx.scale(hscale, 1);
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 0, 0);
}

/**
 * Build a rendered scene into a canvas.
 * - 'knockout': black boxes with transparent text holes, on transparent/white
 *   background — for KiCad's Image Converter.
 * - 'colorized': full RGBA scene using the configured box/board/text colors and
 *   alpha — for a styled PNG image.
 */
export function createScene(
  config: Config,
  dpi: number,
  mode: 'knockout' | 'colorized'
): Scene {
  const pxPerMm = pxPerMmFromDpi(dpi);
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;
  const labels = computeLabels(mctx, config, pxPerMm);
  const layout = computeLayout(config, labels, pxPerMm);
  const { widthPx: width, heightPx: height, offsetX, offsetY, plate, plateCornerR, plateCorners } =
    layout;
  const hasPlate = config.plate.showPlate;
  // When 'single plate' is enabled, per-label boxes are hidden entirely.
  const forceNoBox = config.plate.disableBoxes;
  const drawBox = (l: LabelRender) => l.showBox && !forceNoBox;

  const boxFill = mode === 'colorized'
    ? rgba(config.preview.boxColor, config.preview.boxAlpha)
    : '#000000';
  const textFill = mode === 'colorized'
    ? rgba(config.preview.textColor, config.preview.textAlpha)
    : '#000000';

  // Draw the plate + boxes + text on a layer so the text can be knocked out of
  // the plate/boxes (knockout mode) or drawn on top (colorized mode).
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d')!;
  lctx.fillStyle = boxFill;

  if (hasPlate) {
    const px = offsetX + plate.minX;
    const py = offsetY + plate.minY;
    const pw = plate.maxX - plate.minX;
    const ph = plate.maxY - plate.minY;
    roundedRectPathCorners(lctx, px, py, pw, ph, plateCornerR, plateCorners);
    lctx.fill();
  }

  for (const l of labels) {
    if (!drawBox(l)) continue;
    lctx.save();
    lctx.translate(offsetX + l.centerX * pxPerMm, offsetY + l.centerY * pxPerMm);
    lctx.rotate(l.rotation);
    roundedRectPath(lctx, -l.boxW / 2, -l.boxH / 2, l.boxW, l.boxH, l.cornerR);
    lctx.fill();
    lctx.restore();
  }

  if (mode === 'colorized') {
    // Text drawn on top in the configured text color.
    for (const l of labels) {
      lctx.save();
      lctx.translate(offsetX + l.centerX * pxPerMm, offsetY + l.centerY * pxPerMm);
      lctx.rotate(l.rotation);
      drawLabelText(lctx, l, textFill);
      lctx.restore();
    }
  } else {
    // Knock the text out of the filled plate/box that is behind it.
    lctx.save();
    lctx.globalCompositeOperation = 'destination-out';
    for (const l of labels) {
      if (!drawBox(l) && !hasPlate) continue; // no filled region behind it
      lctx.save();
      lctx.translate(offsetX + l.centerX * pxPerMm, offsetY + l.centerY * pxPerMm);
      lctx.rotate(l.rotation);
      if (drawBox(l)) {
        roundedRectPath(lctx, -l.boxW / 2, -l.boxH / 2, l.boxW, l.boxH, l.cornerR);
        lctx.clip();
      }
      drawLabelText(lctx, l, '#000');
      lctx.restore();
    }
    lctx.restore();

    // Labels with no box and no plate: draw solid so they stay visible.
    for (const l of labels) {
      if (drawBox(l) || hasPlate) continue;
      lctx.save();
      lctx.translate(offsetX + l.centerX * pxPerMm, offsetY + l.centerY * pxPerMm);
      lctx.rotate(l.rotation);
      drawLabelText(lctx, l, '#000');
      lctx.restore();
    }
  }

  // Composite onto the background.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (mode === 'colorized') {
    if (config.preview.showPreviewBg) {
      ctx.fillStyle = rgba(config.preview.boardColor, config.preview.boardAlpha);
      ctx.fillRect(0, 0, width, height);
    }
  } else if (config.export.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(layer, 0, 0);

  return {
    canvas,
    ctx,
    pxPerMm,
    offsetX,
    offsetY,
    labels,
    widthPx: width,
    heightPx: height,
    contentWidthMm: layout.contentWidthMm,
    contentHeightMm: layout.contentHeightMm,
  };
}

/** Convert a `#rgb`/`#rrggbb` hex color plus alpha to an `rgba()` string. */
function rgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ContentMeasure {
  /** Size of the visible box (the plate if shown, else the content). */
  boxWidthMm: number;
  boxHeightMm: number;
  widthPx: number;
  heightPx: number;
}

/** Compute the rendered output size (without allocating a display canvas). */
export function measureContent(config: Config, dpi: number): ContentMeasure {
  const pxPerMm = pxPerMmFromDpi(dpi);
  const c = document.createElement('canvas');
  const mctx = c.getContext('2d')!;
  const labels = computeLabels(mctx, config, pxPerMm);
  const layout = computeLayout(config, labels, pxPerMm);
  return {
    boxWidthMm: layout.boxWidthMm,
    boxHeightMm: layout.boxHeightMm,
    widthPx: layout.widthPx,
    heightPx: layout.heightPx,
  };
}
