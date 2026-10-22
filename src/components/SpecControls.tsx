import type { Config } from '../model/types';
import type { JlcReport, SpecStatus } from '../model/jlcpcb';
import {
  JLC_THRESHOLDS,
  JLCPCB_SPEC_URL,
  applyJlcpcbRecommendations,
  formatMm,
} from '../model/jlcpcb';
import { CheckboxField, Section, SelectField } from './Fields';

const ICONS: Record<SpecStatus, string> = {
  pass: '✓',
  warn: '!',
  fail: '✕',
  note: 'i',
  na: '–',
};

const STATUS_TEXT: Record<JlcReport['status'], string> = {
  pass: 'Compliant',
  warn: 'Meets minimums',
  fail: 'Not compliant',
};

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  report: JlcReport;
}

export function SpecControls({ config, setConfig, report }: Props) {
  const set = (patch: Partial<Config['spec']>) =>
    setConfig((c) => ({ ...c, spec: { ...c.spec, ...patch } }));
  const thresholds = JLC_THRESHOLDS[config.spec.profile];

  return (
    <Section title="JLCPCB spec">
      <div className={`spec-summary is-${report.status}`}>
        <span className={`spec-pill is-${report.status}`}>{STATUS_TEXT[report.status]}</span>
        <span className="spec-summary-text">{report.summary}</span>
      </div>

      <SelectField
        label="Process"
        value={config.spec.profile}
        onChange={(v) => set({ profile: v as Config['spec']['profile'] })}
        options={[
          { label: 'Standard', value: 'standard' },
          { label: 'High-precision', value: 'highPrecision' },
        ]}
      />
      <p className="hint">
        {thresholds.label}: height ≥ {formatMm(thresholds.minHeight)}, stroke ≥{' '}
        {formatMm(thresholds.minStroke)}. Gaps ≥ {formatMm(thresholds.minGap)} (
        {formatMm(thresholds.recGap)} recommended). Pick the process you will order —
        high-precision is a separate JLCPCB option. These are silkscreen rules only.
      </p>

      <ul className="spec-list">
        {report.findings.map((finding) => (
          <li key={finding.id} className={`spec-item is-${finding.status}`}>
            <span className="spec-icon" aria-hidden="true">
              {ICONS[finding.status]}
            </span>
            <span className="spec-body">
              <span className="spec-line">
                <span className="spec-title">{finding.title}</span>
                {finding.valueText && (
                  <span className="spec-value">{finding.valueText}</span>
                )}
              </span>
              {finding.limitText && (
                <span className="spec-limit">Limit {finding.limitText}</span>
              )}
              <span className="spec-detail">{finding.detail}</span>
              {finding.fix && finding.status !== 'pass' && finding.status !== 'na' && (
                <span className="spec-fix">→ {finding.fix}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <button
        className="btn spec-apply"
        onClick={() => setConfig((c) => applyJlcpcbRecommendations(c, c.spec.profile))}
      >
        Apply recommended values
      </button>
      <CheckboxField
        label="Warn before exporting a failing design"
        value={config.spec.guardExport}
        onChange={(v) => set({ guardExport: v })}
      />
      <p className="hint">
        Checked live against the{' '}
        <a href={JLCPCB_SPEC_URL} target="_blank" rel="noreferrer">
          JLCPCB character design specifications
        </a>
        . Pad and exposed-copper clearance depends on your board — verify it with
        KiCad’s DRC before ordering.
      </p>
    </Section>
  );
}

/** Compact status pill used in the preview header. */
export function SpecBadge({ report }: { report: JlcReport }) {
  return (
    <span className={`spec-pill is-${report.status}`} title={report.summary}>
      {STATUS_TEXT[report.status]}
    </span>
  );
}
