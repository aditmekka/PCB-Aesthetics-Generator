import { useEffect, useRef, useState } from 'react';
import type { Config } from '../model/types';
import type { JlcReport } from '../model/jlcpcb';
import type { FootprintResult, FootprintSide } from '../model/footprint';
import { FootprintError } from '../model/footprint';
import { buildFootprint, downloadFootprint } from '../render/footprint';
import { copyTextToClipboard } from '../render/clipboard';
import { CheckboxField, NumberField, Section, SelectField } from './Fields';

interface Props {
  config: Config;
  report: JlcReport;
}

type Status = { tone: 'ok' | 'error'; text: string };

export function FootprintControls({ config, report }: Props) {
  const [pixelSize, setPixelSize] = useState(0.025);
  const [side, setSide] = useState<FootprintSide>('front');
  const [center, setCenter] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const cache = useRef<{ key: string; result: FootprintResult } | null>(null);

  // Any change invalidates the cached footprint (and its stats).
  useEffect(() => {
    setStatus(null);
    cache.current = null;
  }, [config, pixelSize, side, center]);

  const getResult = (): FootprintResult => {
    const key = JSON.stringify([config, pixelSize, side, center]);
    if (cache.current?.key === key) return cache.current.result;
    const result = buildFootprint(config, {
      pixelSizeMm: pixelSize,
      side,
      center,
    });
    cache.current = { key, result };
    return result;
  };

  const handleDownload = () => {
    try {
      const result = getResult();
      downloadFootprint(result);
      setStatus({
        tone: 'ok',
        text: `Downloaded ${result.name}.kicad_mod — ${stats(result)}.`,
      });
    } catch (error) {
      setStatus({ tone: 'error', text: errorMessage(error) });
    }
  };

  const handleCopy = async () => {
    try {
      const result = getResult();
      const copied = await copyTextToClipboard(result.text);
      setStatus(
        copied
          ? { tone: 'ok', text: `Copied ${stats(result)} to the clipboard.` }
          : {
              tone: 'error',
              text: 'Clipboard access was blocked by the browser. Use Download instead.',
            }
      );
    } catch (error) {
      setStatus({ tone: 'error', text: errorMessage(error) });
    }
  };

  const dpi = Math.round(25.4 / pixelSize);

  return (
    <Section title="KiCad footprint">
      <p className="hint">
        Generates a <code>.kicad_mod</code> directly — no Image Converter step. This is a browser
        port of the local <code>img2mod</code> approach: each ink pixel becomes a filled
        silkscreen polygon, with adjacent runs merged to keep the file small.
      </p>
      {report.status === 'fail' && (
        <p className="hint error">
          {report.errorCount} hard JLCPCB limit{report.errorCount === 1 ? '' : 's'} exceeded. The
          footprint uses the same artwork — fix {report.errorCount === 1 ? 'it' : 'them'} before
          ordering.
        </p>
      )}
      <NumberField
        label="Pixel size"
        suffix="mm"
        step={0.005}
        min={0.005}
        max={0.2}
        value={pixelSize}
        onChange={setPixelSize}
      />
      <SelectField
        label="Side"
        value={side}
        onChange={(value) => setSide(value as FootprintSide)}
        options={[
          { label: 'Front (F.SilkS)', value: 'front' },
          { label: 'Back (B.SilkS)', value: 'back' },
        ]}
      />
      <CheckboxField
        label="Center at footprint origin"
        value={center}
        onChange={setCenter}
      />
      <div className="footprint-actions">
        <button className="btn" onClick={handleDownload} title="Download .kicad_mod">
          ⬇ Download
        </button>
        <button className="btn" onClick={handleCopy} title="Copy .kicad_mod text">
          Copy
        </button>
      </div>
      {status && (
        <p className={`hint ${status.tone === 'error' ? 'error' : 'ok'}`}>{status.text}</p>
      )}
      <p className="hint">
        {pixelSize.toFixed(3)} mm/px ≈ {dpi} DPI. Smaller pixels give smoother edges but more
        polygons; larger pixels give a lighter file. The footprint is tightly cropped (the PNG
        margin is ignored). KiCad 6+ format, placed on{' '}
        {side === 'front' ? 'F.SilkS' : 'B.SilkS'}.
      </p>
    </Section>
  );
}

function stats(result: FootprintResult): string {
  return `${result.polygonCount.toLocaleString()} polygons · ${result.widthMm.toFixed(
    2
  )} × ${result.heightMm.toFixed(2)} mm · ${formatBytes(result.bytes)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function errorMessage(error: unknown): string {
  if (error instanceof FootprintError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Could not generate the footprint.';
}
