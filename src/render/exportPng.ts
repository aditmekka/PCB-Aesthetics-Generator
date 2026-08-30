import type { Config } from '../model/types';
import { createScene } from './renderer';

/** Turn arbitrary text into a filename-safe token (spaces/symbols → underscores). */
function sanitizeToken(text: string): string {
  return text.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Build a download filename from the enabled labels' text. */
export function makeFilename(config: Config): string {
  const parts = config.labels
    .filter((l) => l.enabled)
    .map((l) => sanitizeToken(l.text))
    .filter(Boolean);
  let name = parts.join('_') || 'silkscreen_knockout';
  // Keep names reasonable for filesystems (Windows limit ~255 chars).
  if (name.length > 120) name = name.slice(0, 120);
  return `${name}.png`;
}

/**
 * Render the configured labels to a high-DPI PNG and trigger a download.
 * - `style: 'knockout'` exports a black shape on transparent/white for KiCad's
 *   Image Converter (bitmap2component).
 * - `style: 'colorized'` exports the full RGBA scene using the configured
 *   box/board/text colors and alpha.
 * The filename is derived from the enabled labels' text.
 */
export function exportPng(config: Config): void {
  const cfg: Config = { ...config, labels: config.labels.map((l) => ({ ...l })) };

  if (config.export.capture === 'single') {
    const idx = config.export.singleIndex;
    cfg.labels = config.labels.map((l, i) => ({ ...l, enabled: i === idx }));
  }

  const scene = createScene(cfg, config.export.dpi, config.export.style);
  const url = scene.canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = makeFilename(cfg);
  a.click();
}
