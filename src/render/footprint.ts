import type { Config } from '../model/types';
import type { FootprintLayer, FootprintResult } from '../model/footprint';
import { FootprintError, binaryMaskToFootprint, footprintBaseName } from '../model/footprint';
import { createScene, measureContent } from './renderer';

/**
 * Turn the current knockout scene into a .kicad_mod footprint.
 *
 * The scene is rasterised at `1 / pixelSizeMm` pixels per mm, then the alpha
 * channel becomes the ink mask. This is the same artwork as the knockout PNG,
 * so no KiCad Image Converter step is needed.
 */

const MAX_RASTER_PIXELS = 4_000_000;
const MAX_POLYGONS = 100_000;

export interface FootprintSettings {
  pixelSizeMm: number;
  layer: FootprintLayer;
  center: boolean;
}

export function buildFootprint(config: Config, settings: FootprintSettings): FootprintResult {
  const { pixelSizeMm } = settings;
  if (!Number.isFinite(pixelSizeMm) || pixelSizeMm <= 0) {
    throw new FootprintError('Pixel size must be greater than zero.');
  }

  const cfg: Config = {
    ...config,
    // A tight, transparent knockout render is the cleanest source for a
    // footprint; the PNG margin is only useful for the Image Converter flow.
    export: {
      ...config.export,
      background: 'transparent',
      style: 'knockout',
      margin: 0,
    },
    labels: config.labels.map((label) => ({ ...label })),
  };
  if (config.export.capture === 'single') {
    const index = config.export.singleIndex;
    cfg.labels = config.labels.map((label, i) => ({ ...label, enabled: i === index }));
  }
  if (!cfg.labels.some((label) => label.enabled)) {
    throw new FootprintError('Add at least one enabled label first.');
  }

  const dpi = 25.4 / pixelSizeMm;
  const estimated = measureContent(cfg, dpi);
  if (estimated.widthPx * estimated.heightPx > MAX_RASTER_PIXELS) {
    throw new FootprintError(
      `That pixel size needs a ${estimated.widthPx} × ${estimated.heightPx} px image. ` +
        'Increase the pixel size or export a single label.'
    );
  }

  const scene = createScene(cfg, dpi, 'knockout');
  const pixels = scene.ctx.getImageData(0, 0, scene.widthPx, scene.heightPx).data;
  const mask = new Uint8Array(scene.widthPx * scene.heightPx);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = pixels[i * 4 + 3] >= 128 ? 1 : 0;
  }

  return binaryMaskToFootprint(mask, scene.widthPx, scene.heightPx, {
    pixelSizeMm,
    layer: settings.layer,
    center: settings.center,
    name: footprintBaseName(config),
    maxPolygons: MAX_POLYGONS,
  });
}

/** Save the generated footprint text as `NAME.kicad_mod`. */
export function downloadFootprint(result: FootprintResult): void {
  const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${result.name}.kicad_mod`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
