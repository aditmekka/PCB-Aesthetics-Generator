import { describe, expect, it } from 'vitest';
import type { Config } from './types';
import {
  JLC_THRESHOLDS,
  applyJlcpcbRecommendations,
  evaluateJlcpcb,
  formatMm,
} from './jlcpcb';
import type { SpecGeometry, SpecLabelGeometry } from './jlcpcb';
import { DEFAULT_CONFIG } from './defaults';

function makeLabel(patch: Partial<SpecLabelGeometry> = {}): SpecLabelGeometry {
  return {
    id: 'gnd',
    text: 'GND',
    heightMm: 1.2,
    targetStrokeMm: 0.2,
    strokeMm: 0.22,
    solid: false,
    inkWidthMm: 2.4,
    inkHeightMm: 1.2,
    wallMm: 0.4,
    letterGapMm: 0.21,
    gapToNextMm: 0.55,
    ...patch,
  };
}

function makeGeometry(
  labels: SpecLabelGeometry[] = [makeLabel()],
  patch: Partial<SpecGeometry> = {}
): SpecGeometry {
  return {
    labels,
    plateClearanceMm: null,
    plateClipped: false,
    plateShown: false,
    ...patch,
  };
}

function find(report: ReturnType<typeof evaluateJlcpcb>, id: string) {
  const finding = report.findings.find((f) => f.id === id);
  if (!finding) throw new Error(`missing finding ${id}`);
  return finding;
}

describe('evaluateJlcpcb', () => {
  it('passes a compliant design', () => {
    const report = evaluateJlcpcb(makeGeometry(), 'standard', 2400);
    expect(report.status).toBe('pass');
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.summary).toMatch(/meets standard silkscreen limits/i);
    expect(find(report, 'height').status).toBe('pass');
    expect(find(report, 'stroke').status).toBe('pass');
    expect(find(report, 'letter-gap').status).toBe('pass');
    expect(find(report, 'label-gap').status).toBe('pass');
    expect(find(report, 'wall').status).toBe('pass');
    expect(find(report, 'dpi').status).toBe('pass');
    expect(find(report, 'pads').status).toBe('note');
  });

  it('fails a height below the standard minimum', () => {
    const report = evaluateJlcpcb(makeGeometry([makeLabel({ heightMm: 0.8 })]), 'standard', 2400);
    expect(report.status).toBe('fail');
    expect(find(report, 'height').status).toBe('fail');
    expect(report.summary).toMatch(/1 JLCPCB limit/);
  });

  it('accepts 0.8 mm height at high precision but still recommends 1.0 mm', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel({ heightMm: 0.8 })]),
      'highPrecision',
      2400
    );
    expect(report.status).toBe('warn');
    expect(find(report, 'height').status).toBe('warn');
    expect(report.thresholds).toBe(JLC_THRESHOLDS.highPrecision);
  });

  it('fails a solid stroke below the limit', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel({ solid: true, strokeMm: 0.12 })]),
      'standard',
      2400
    );
    expect(find(report, 'stroke').status).toBe('fail');
    expect(find(report, 'stroke').detail).toMatch(/rendered glyphs/i);
  });

  it('warns when the stroke is above the minimum but below the recommendation', () => {
    const report = evaluateJlcpcb(makeGeometry([makeLabel({ strokeMm: 0.18 })]), 'standard', 2400);
    expect(find(report, 'stroke').status).toBe('warn');
    expect(report.status).toBe('warn');
  });

  it('uses the absolute minimum for high-precision stroke', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel({ strokeMm: 0.12 })]),
      'highPrecision',
      2400
    );
    expect(find(report, 'stroke').status).toBe('warn');
  });

  it('fails and reports offenders when characters are too close', () => {
    const report = evaluateJlcpcb(
      makeGeometry([
        makeLabel({ text: 'GND' }),
        makeLabel({ id: 'rx', text: 'RX', letterGapMm: 0.05, gapToNextMm: null }),
      ]),
      'standard',
      2400
    );
    const finding = find(report, 'letter-gap');
    expect(finding.status).toBe('fail');
    expect(finding.detail).toMatch(/RX/);
  });

  it('warns when the letter gap only misses the recommendation', () => {
    const report = evaluateJlcpcb(makeGeometry([makeLabel({ letterGapMm: 0.16 })]), 'standard', 2400);
    expect(find(report, 'letter-gap').status).toBe('warn');
    expect(find(report, 'letter-gap').detail).toMatch(/recommended gap/i);
  });

  it('flags overlapping labels', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel({ gapToNextMm: -0.2 })]),
      'standard',
      2400
    );
    const finding = find(report, 'label-gap');
    expect(finding.status).toBe('fail');
    expect(finding.detail).toMatch(/overlap/i);
  });

  it('checks the knockout ink wall', () => {
    const report = evaluateJlcpcb(makeGeometry([makeLabel({ wallMm: 0.1 })]), 'standard', 2400);
    expect(find(report, 'wall').status).toBe('fail');
  });

  it('reports the plate and its clearance', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel()], { plateShown: true, plateClearanceMm: 1.4 }),
      'standard',
      2400
    );
    const finding = find(report, 'plate');
    expect(finding.status).toBe('pass');
    expect(finding.valueText).toBe('1.40 mm');
  });

  it('fails a cropped plate', () => {
    const report = evaluateJlcpcb(
      makeGeometry([makeLabel()], { plateShown: true, plateClipped: true }),
      'standard',
      2400
    );
    expect(find(report, 'plate').status).toBe('fail');
    expect(report.status).toBe('fail');
  });

  it('checks the export resolution against the narrowest feature', () => {
    const report = evaluateJlcpcb(makeGeometry(), 'standard', 200);
    expect(find(report, 'dpi').status).toBe('fail');

    const warn = evaluateJlcpcb(makeGeometry(), 'standard', 400);
    expect(find(warn, 'dpi').status).toBe('warn');

    const pass = evaluateJlcpcb(makeGeometry(), 'standard', 1200);
    expect(find(pass, 'dpi').status).toBe('pass');
  });

  it('handles an empty label list', () => {
    const report = evaluateJlcpcb(makeGeometry([]), 'standard', 2400);
    expect(report.status).toBe('pass');
    expect(report.summary).toBe('No enabled labels');
    expect(find(report, 'labels').status).toBe('note');
  });

  it('formats millimetres consistently', () => {
    expect(formatMm(0.2)).toBe('0.20 mm');
    expect(formatMm(0.05)).toBe('0.050 mm');
    expect(formatMm(-0.2)).toBe('-0.20 mm');
  });
});

describe('applyJlcpcbRecommendations', () => {
  function makeConfig(): Config {
    return structuredClone(DEFAULT_CONFIG);
  }

  it('clamps all values up to the recommended minimums', () => {
    const config = makeConfig();
    config.text.height = 0.8;
    config.text.thickness = 0.1;
    config.text.letterSpacing = 0;
    config.box.padX = 0.1;
    config.box.padY = 0.1;
    config.plate.marginMm = 0;
    config.export.dpi = 600;
    config.spec.profile = 'highPrecision';

    const next = applyJlcpcbRecommendations(config, 'standard');
    expect(next.text.height).toBe(1.0);
    expect(next.text.thickness).toBe(0.2);
    expect(next.text.letterSpacing).toBe(0);
    expect(next.box.padX).toBe(0.2);
    expect(next.box.padY).toBe(0.2);
    expect(next.plate.marginMm).toBe(0.2);
    expect(next.export.dpi).toBe(1200);
    expect(next.spec.profile).toBe('standard');
  });

  it('never shrinks values that are already larger', () => {
    const config = makeConfig();
    config.text.height = 2;
    config.text.thickness = 0.5;
    config.box.padX = 1;
    config.export.dpi = 6000;
    const next = applyJlcpcbRecommendations(config, 'standard');
    expect(next.text.height).toBe(2);
    expect(next.text.thickness).toBe(0.5);
    expect(next.box.padX).toBe(1);
    expect(next.export.dpi).toBe(6000);
  });

  it('clamps per-label overrides but leaves unset overrides unset', () => {
    const config = makeConfig();
    config.labels = [
      { id: 'a', text: 'A', enabled: true, showBox: true, style: { height: 0.5, thickness: 0.05 } },
      { id: 'b', text: 'B', enabled: true, showBox: true, style: { font: 'Arial' } },
      { id: 'c', text: 'C', enabled: true, showBox: true },
    ];
    const next = applyJlcpcbRecommendations(config, 'standard');
    expect(next.labels[0].style?.height).toBe(1.0);
    expect(next.labels[0].style?.thickness).toBe(0.2);
    expect(next.labels[1].style?.height).toBeUndefined();
    expect(next.labels[1].style?.thickness).toBeUndefined();
    expect(next.labels[2].style).toBeUndefined();
  });
});
