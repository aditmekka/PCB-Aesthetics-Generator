import type { Config } from '../model/types';
import type { JlcReport } from '../model/jlcpcb';
import { NumberField, Section, SelectField } from './Fields';
import { measureContent } from '../render/renderer';
import { exportPng } from '../render/exportPng';

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  report: JlcReport;
}

export function ExportControls({ config, setConfig, report }: Props) {
  const e = config.export;
  const set = (patch: Partial<Config['export']>) =>
    setConfig((c) => ({ ...c, export: { ...c.export, ...patch } }));

  const content = measureContent(config, e.dpi);
  const pxPerMm = e.dpi / 25.4;

  const handleExport = () => {
    if (
      config.spec.guardExport &&
      e.style === 'knockout' &&
      report.status === 'fail'
    ) {
      const details = report.findings
        .filter((finding) => finding.status === 'fail')
        .map((finding) => `• ${finding.title}: ${finding.detail}`)
        .join('\n');
      const proceed = window.confirm(
        `This design exceeds ${report.errorCount} JLCPCB limit${
          report.errorCount === 1 ? '' : 's'
        }:\n\n${details}\n\nJLCPCB may widen or remove silkscreen features. Export anyway?`
      );
      if (!proceed) return;
    }
    exportPng(config);
  };

  return (
    <Section title="Export">
      <NumberField
        label="DPI"
        step={100}
        min={72}
        max={20000}
        value={e.dpi}
        onChange={(v) => set({ dpi: v })}
      />
      <div className="preset-row">
        {[600, 1200, 2400, 6000, 12000].map((d) => (
          <button
            key={d}
            className={`preset-btn ${e.dpi === d ? 'active' : ''}`}
            onClick={() => set({ dpi: d })}
          >
            {d}
          </button>
        ))}
      </div>
      <NumberField
        label="Margin"
        suffix="mm"
        step={0.1}
        min={0}
        value={e.margin}
        onChange={(v) => set({ margin: v })}
      />
      <SelectField
        label="Background"
        value={e.background}
        onChange={(v) => set({ background: v as Config['export']['background'] })}
        options={[
          { label: 'Transparent', value: 'transparent' },
          { label: 'White', value: 'white' },
        ]}
      />
      <SelectField
        label="Capture"
        value={e.capture}
        onChange={(v) => set({ capture: v as Config['export']['capture'] })}
        options={[
          { label: 'Whole strip', value: 'strip' },
          { label: 'Single label', value: 'single' },
        ]}
      />
      {e.capture === 'single' && (
        <NumberField
          label="Label index"
          step={1}
          min={0}
          max={Math.max(0, config.labels.length - 1)}
          value={e.singleIndex}
          onChange={(v) => set({ singleIndex: v })}
        />
      )}
      <SelectField
        label="Export style"
        value={e.style}
        onChange={(v) => set({ style: v as Config['export']['style'] })}
        options={[
          { label: 'KIcad black (converter)', value: 'knockout' },
          { label: 'Colorized (styled PNG)', value: 'colorized' },
        ]}
      />

      <div className={`spec-summary export-spec is-${report.status}`}>
        <span className={`spec-pill is-${report.status}`}>JLCPCB</span>
        <span className="spec-summary-text">{report.summary}</span>
      </div>
      {report.status === 'fail' && e.style === 'knockout' && (
        <p className="hint error">
          This design exceeds a hard JLCPCB limit. Resolve the errors in the JLCPCB spec panel
          before ordering, or JLCPCB may remove the affected characters.
        </p>
      )}

      <button className="btn export-btn" onClick={handleExport}>
        ⬇ Download PNG
      </button>

      <div className="export-info">
        <p>
          Box: <strong>{content.boxWidthMm.toFixed(2)} × {content.boxHeightMm.toFixed(2)} mm</strong>
        </p>
        <p>
          Canvas: {content.widthPx} × {content.heightPx} px @ {e.dpi} DPI
        </p>
        <p>1 mm = {pxPerMm.toFixed(2)} px</p>
        {e.style === 'knockout' ? (
          <p className="hint">
            <strong>Quality:</strong> higher DPI = smoother traced edges. The exported canvas keeps
            the exact mm ratio — you set the real size in KiCad, so <em>only the ratio matters</em>.
            Use ≥2400 for clean small text. In KiCad: <code>Image Converter</code> → the PNG →{' '}
            <code>F.Silkscreen</code> (or <code>F.Mask</code>; its filled areas become mask
            openings) → set the scale so the canvas matches the <strong>Box</strong> size above.
          </p>
        ) : (
          <p className="hint">
            This exports the styled scene as an RGBA PNG using your box/board/text colors and alpha
            — great for a logo or a colored graphic. Use <code>KiCad black</code> instead when you
            need to convert it to real silkscreen.
          </p>
        )}
      </div>
    </Section>
  );
}
