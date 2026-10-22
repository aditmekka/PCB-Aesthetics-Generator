import { useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from './model/types';
import { DEFAULT_CONFIG } from './model/defaults';
import { createScene } from './render/renderer';
import { evaluateJlcpcbDesign } from './render/specMeasure';
import { getStoredFonts, loadFontFromBase64, loadFontFromFile, saveFonts } from './fonts';
import type { FontEntry } from './fonts';
import { LabelList } from './components/LabelList';
import { TextControls } from './components/TextControls';
import { BoxControls } from './components/BoxControls';
import { PlateControls } from './components/PlateControls';
import { LayoutControls } from './components/LayoutControls';
import { PreviewControls } from './components/PreviewControls';
import { ExportControls } from './components/ExportControls';
import { FootprintControls } from './components/FootprintControls';
import { SpecBadge, SpecControls } from './components/SpecControls';

const PREVIEW_DPI = 600;

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [customFonts, setCustomFonts] = useState<FontEntry[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const report = useMemo(() => evaluateJlcpcbDesign(config), [config]);

  // Restore any custom fonts stored from a previous session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: FontEntry[] = [];
      for (const stored of getStoredFonts()) {
        const ok = await loadFontFromBase64(stored.base64, stored.family);
        if (ok) loaded.push(stored);
      }
      if (!cancelled) setCustomFonts(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUploadFont = async (file: File) => {
    const entry = await loadFontFromFile(file);
    setCustomFonts((prev) => {
      const next = [...prev, entry];
      saveFonts(next);
      return next;
    });
    // Auto-select the newly uploaded font.
    setConfig((c) => ({ ...c, text: { ...c.text, font: entry.family } }));
  };

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    container.innerHTML = '';
    const scene = createScene(config, PREVIEW_DPI, 'colorized');
    scene.canvas.className = 'preview-canvas';
    container.appendChild(scene.canvas);
  }, [config]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PCB Silkscreen Knockout Generator</h1>
        <p>
          Boxed, knocked-out labels for KiCad silkscreen — checked against JLCPCB’s character
          rules, with PNG and .kicad_mod export.
        </p>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <LabelList config={config} setConfig={setConfig} />
          <TextControls
            config={config}
            setConfig={setConfig}
            customFonts={customFonts}
            onUploadFont={handleUploadFont}
          />
          <BoxControls config={config} setConfig={setConfig} />
          <PlateControls config={config} setConfig={setConfig} />
          <LayoutControls config={config} setConfig={setConfig} />
          <SpecControls config={config} setConfig={setConfig} report={report} />
          <PreviewControls config={config} setConfig={setConfig} />
          <ExportControls config={config} setConfig={setConfig} report={report} />
          <FootprintControls config={config} report={report} />
        </aside>
        <main className="preview">
          <div className="preview-title">
            <span>Preview</span>
            <SpecBadge report={report} />
          </div>
          <div ref={previewRef} className="preview-canvas-wrap" />
        </main>
      </div>
    </div>
  );
}
