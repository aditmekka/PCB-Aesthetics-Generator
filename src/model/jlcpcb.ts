import type { Config, JlcProfile, LabelConfig, TextStyle } from './types';

/**
 * JLCPCB character design rules, taken from
 * https://jlcpcb.com/blog/character-design-specifications
 *
 * Standard silkscreen: height ≥ 1.00 mm, stroke ≥ 0.15 mm.
 * High-precision characters: height ≥ 0.80 mm, stroke ≥ 0.10 mm.
 * Both: character gap > 0.15 mm, no silkscreen on pads / exposed copper, and
 * silkscreen at least 0.15 mm (preferably 0.25 mm) from pads.
 *
 * "Recommended" values come from the same page: height ≥ 1.00 mm, stroke
 * ≥ 0.20 mm, gap ≥ 0.20 mm, stroke:height around 1:5–1:6.
 */
export const JLCPCB_SPEC_URL =
  'https://jlcpcb.com/blog/character-design-specifications';

export interface JlcThresholds {
  label: string;
  /** Hard minimum cap height, mm. */
  minHeight: number;
  /** Hard minimum stroke width, mm. */
  minStroke: number;
  /** Recommended cap height, mm. */
  recHeight: number;
  /** Recommended stroke width, mm. */
  recStroke: number;
  /** Hard minimum gap between characters/ink features, mm. */
  minGap: number;
  /** Recommended gap between characters/ink features, mm. */
  recGap: number;
  /** Recommended bitmap resolution for traced exports, DPI. */
  recDpi: number;
}

export const JLC_THRESHOLDS: Record<JlcProfile, JlcThresholds> = {
  standard: {
    label: 'Standard silkscreen',
    minHeight: 1.0,
    minStroke: 0.15,
    recHeight: 1.0,
    recStroke: 0.2,
    minGap: 0.15,
    recGap: 0.2,
    recDpi: 1200,
  },
  highPrecision: {
    label: 'High-precision characters',
    minHeight: 0.8,
    minStroke: 0.1,
    recHeight: 1.0,
    recStroke: 0.2,
    minGap: 0.15,
    recGap: 0.2,
    recDpi: 1200,
  },
};

export type SpecStatus = 'pass' | 'warn' | 'fail' | 'note' | 'na';

export interface SpecFinding {
  id: string;
  title: string;
  status: SpecStatus;
  /** Measured value, already formatted (e.g. "0.17 mm"). */
  valueText?: string;
  /** The limit this check compares against (e.g. "≥ 0.15 mm"). */
  limitText?: string;
  detail: string;
  fix?: string;
}

export interface SpecLabelGeometry {
  id: string;
  text: string;
  /** Cap-height setting, mm. */
  heightMm: number;
  /** Requested minimum stroke, mm. */
  targetStrokeMm: number;
  /** Measured effective glyph stroke, mm (null when unmeasurable). */
  strokeMm: number | null;
  /** True when the glyphs are solid ink (no box or plate behind them). */
  solid: boolean;
  inkWidthMm: number;
  inkHeightMm: number;
  /** Distance from glyph ink to the nearest knockout ink boundary, mm. */
  wallMm: number | null;
  /** Narrowest gap between characters inside the label, mm. */
  letterGapMm: number | null;
  /** Gap from this label to the next enabled label, mm. */
  gapToNextMm: number | null;
}

export interface SpecGeometry {
  labels: SpecLabelGeometry[];
  /** Plate edge to nearest glyph ink, mm (null without a plate). */
  plateClearanceMm: number | null;
  /** True when a fixed-size plate canvas would cut off labels. */
  plateClipped: boolean;
  plateShown: boolean;
}

export interface JlcReport {
  profile: JlcProfile;
  thresholds: JlcThresholds;
  status: 'pass' | 'warn' | 'fail';
  findings: SpecFinding[];
  errorCount: number;
  warningCount: number;
  passCount: number;
  summary: string;
  minHeightMm: number;
  minGapMm: number | null;
  minStrokeMm: number | null;
}

export function formatMm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs < 0.1 ? 3 : 2;
  return `${value.toFixed(digits)} mm`;
}

function below(value: number, limit: number): boolean {
  return value < limit - 1e-6;
}

function offenderText(
  labels: SpecLabelGeometry[],
  values: (number | null)[],
  limit: number,
  unit: 'mm' | 'raw' = 'mm'
): string {
  const rows: { name: string; value: number }[] = [];
  labels.forEach((label, index) => {
    const value = values[index];
    if (value === null || !below(value, limit)) return;
    rows.push({ name: label.text || '(blank)', value });
  });
  if (rows.length === 0) return '';
  rows.sort((a, b) => a.value - b.value);
  const shown = rows
    .slice(0, 3)
    .map((row) => `${row.name} (${unit === 'mm' ? formatMm(row.value) : row.value.toFixed(1)})`)
    .join(', ');
  const more = rows.length > 3 ? ` and ${rows.length - 3} more` : '';
  return `Affected: ${shown}${more}.`;
}

function minOf(values: (number | null)[]): number | null {
  let min: number | null = null;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    if (min === null || value < min) min = value;
  }
  return min;
}

function gapStatus(value: number, thresholds: JlcThresholds): SpecStatus {
  if (below(value, thresholds.minGap)) return 'fail';
  if (below(value, thresholds.recGap)) return 'warn';
  return 'pass';
}

function gapFix(what: 'characters' | 'labels'): string {
  return what === 'characters'
    ? 'Increase Text → Letter spacing, or use a taller/wider label or a font with looser spacing.'
    : 'Increase Layout → Pitch so the labels have more room.';
}

/**
 * Check a measured design against the selected JLCPCB process.
 * Pure: no canvas / DOM access, so it is easy to unit test.
 */
export function evaluateJlcpcb(
  geometry: SpecGeometry,
  profile: JlcProfile,
  dpi: number
): JlcReport {
  const thresholds = JLC_THRESHOLDS[profile];
  const labels = geometry.labels;
  const findings: SpecFinding[] = [];

  if (labels.length === 0) {
    return {
      profile,
      thresholds,
      status: 'pass',
      findings: [
        {
          id: 'labels',
          title: 'Labels',
          status: 'note',
          detail: 'Add at least one enabled label to check the design.',
        },
      ],
      errorCount: 0,
      warningCount: 0,
      passCount: 0,
      summary: 'No enabled labels',
      minHeightMm: 0,
      minGapMm: null,
      minStrokeMm: null,
    };
  }

  const heights = labels.map((label) => label.heightMm);
  const minHeight = Math.min(...heights);
  findings.push(heightFinding(labels, heights, minHeight, thresholds));

  const strokes = labels.map((label) => label.strokeMm);
  const minStroke = minOf(strokes);
  findings.push(strokeFinding(labels, minStroke, thresholds, geometry.labels.some((l) => l.solid)));

  const letterGaps = labels.map((label) => label.letterGapMm);
  const minLetterGap = minOf(letterGaps);
  findings.push(
    letterGapFinding(labels, letterGaps, minLetterGap, thresholds)
  );

  const labelGaps = labels.map((label) => label.gapToNextMm);
  const minLabelGap = minOf(labelGaps);
  findings.push(labelGapFinding(labels, labelGaps, minLabelGap, thresholds));

  const walls = labels.map((label) => label.wallMm);
  const minWall = minOf(walls);
  if (minWall !== null) {
    findings.push(wallFinding(labels, walls, minWall, thresholds, geometry.plateShown));
  }

  if (geometry.plateShown) {
    findings.push(plateFinding(geometry));
  }

  const features = [minWall, minLetterGap, minLabelGap, minStroke].filter(
    (value): value is number => value !== null && value > 0
  );
  const minFeature = features.length > 0 ? Math.min(...features) : thresholds.minGap;
  findings.push(dpiFinding(minFeature, dpi, thresholds));

  // Board-dependent clearance cannot be inferred from the label geometry.
  findings.push({
    id: 'pads',
    title: 'Pad & exposed-copper clearance',
    status: 'note',
    detail:
      'Not checkable here. Keep silkscreen at least 0.25 mm from pads and off exposed copper — JLCPCB removes characters that overlap copper or sit within 0.15 mm of a pad.',
    fix: 'Run KiCad’s DRC after placing the exported graphic. If a label must overlap a pad, state it in the order remarks.',
  });

  const errorCount = findings.filter((finding) => finding.status === 'fail').length;
  const warningCount = findings.filter((finding) => finding.status === 'warn').length;
  const passCount = findings.filter((finding) => finding.status === 'pass').length;
  const status: JlcReport['status'] =
    errorCount > 0 ? 'fail' : warningCount > 0 ? 'warn' : 'pass';

  const summary =
    status === 'fail'
      ? `${errorCount} JLCPCB limit${errorCount === 1 ? '' : 's'} exceeded`
      : status === 'warn'
        ? `Meets minimums · ${warningCount} recommendation${warningCount === 1 ? '' : 's'}`
        : `Meets ${thresholds.label.toLowerCase()} limits`;

  return {
    profile,
    thresholds,
    status,
    findings,
    errorCount,
    warningCount,
    passCount,
    summary,
    minHeightMm: minHeight,
    minGapMm: minOf([minWall, minLetterGap, minLabelGap]),
    minStrokeMm: minStroke,
  };
}

function heightFinding(
  labels: SpecLabelGeometry[],
  heights: number[],
  minHeight: number,
  thresholds: JlcThresholds
): SpecFinding {
  const status: SpecStatus = below(minHeight, thresholds.minHeight)
    ? 'fail'
    : below(minHeight, thresholds.recHeight)
      ? 'warn'
      : 'pass';
  const offenders = offenderText(labels, heights, thresholds.minHeight);

  if (status === 'fail') {
    return {
      id: 'height',
      title: 'Character height',
      status,
      valueText: formatMm(minHeight),
      limitText: `≥ ${formatMm(thresholds.minHeight)}`,
      detail: `Below the ${thresholds.label.toLowerCase()} minimum. ${offenders}`.trim(),
      fix: `Increase Text → Height (and any per-label overrides) to at least ${formatMm(thresholds.minHeight)}.`,
    };
  }
  if (status === 'warn') {
    return {
      id: 'height',
      title: 'Character height',
      status,
      valueText: formatMm(minHeight),
      limitText: `≥ ${formatMm(thresholds.minHeight)}`,
      detail: `Above the hard minimum, but JLCPCB recommends at least ${formatMm(thresholds.recHeight)} for good readability. ${offenders}`.trim(),
      fix: `Increase Text → Height to at least ${formatMm(thresholds.recHeight)}.`,
    };
  }
  return {
    id: 'height',
    title: 'Character height',
    status,
    valueText: formatMm(minHeight),
    limitText: `≥ ${formatMm(thresholds.minHeight)}`,
    detail: 'Measured from the real font cap height, not an assumed ratio.',
  };
}

function strokeFinding(
  labels: SpecLabelGeometry[],
  minStroke: number | null,
  thresholds: JlcThresholds,
  hasSolid: boolean
): SpecFinding {
  if (minStroke === null) {
    return {
      id: 'stroke',
      title: 'Character stroke',
      status: 'na',
      detail: 'The font’s stroke width could not be measured in this browser.',
      fix: 'Use a standard font, or check the stroke width in KiCad after importing.',
    };
  }

  const status: SpecStatus = below(minStroke, thresholds.minStroke)
    ? 'fail'
    : below(minStroke, thresholds.recStroke)
      ? 'warn'
      : 'pass';

  const ratioLabel = labels.reduce((worst, label) => {
    if (label.strokeMm === null) return worst;
    if (worst === null) return label;
    const worstRatio = worst.strokeMm !== null ? worst.heightMm / worst.strokeMm : Infinity;
    return label.heightMm / label.strokeMm < worstRatio ? label : worst;
  }, null as SpecLabelGeometry | null);
  const ratio =
    ratioLabel && ratioLabel.strokeMm !== null
      ? ratioLabel.heightMm / ratioLabel.strokeMm
      : null;

  const modeNote = hasSolid
    ? 'Measured from the rendered glyphs.'
    : 'Glyphs are negative space in knockout mode, so this is the width of the letter-shaped hole; holes thinner than the limit can fill in.';
  const ratioNote =
    ratio !== null
      ? ` Stroke:height ≈ 1:${ratio.toFixed(1)} (JLCPCB guideline ~1:5–1:6).`
      : '';
  const valueText = formatMm(minStroke);
  const limitText = `≥ ${formatMm(thresholds.minStroke)}`;

  if (status === 'fail') {
    return {
      id: 'stroke',
      title: 'Character stroke',
      status,
      valueText,
      limitText,
      detail: `${modeNote}${ratioNote} Thinner than the ${thresholds.label.toLowerCase()} minimum.`,
      fix: `Use a heavier font weight, or increase Text → Height so the stroke reaches ${formatMm(thresholds.minStroke)}.`,
    };
  }
  if (status === 'warn') {
    return {
      id: 'stroke',
      title: 'Character stroke',
      status,
      valueText,
      limitText,
      detail: `${modeNote}${ratioNote} Above the hard minimum, but ${formatMm(thresholds.recStroke)} is recommended.`,
      fix: `Use a heavier weight to reach ${formatMm(thresholds.recStroke)} if the design allows it.`,
    };
  }
  return {
    id: 'stroke',
    title: 'Character stroke',
    status,
    valueText,
    limitText,
    detail: `${modeNote}${ratioNote}`,
  };
}

function letterGapFinding(
  labels: SpecLabelGeometry[],
  gaps: (number | null)[],
  minGap: number | null,
  thresholds: JlcThresholds
): SpecFinding {
  if (minGap === null) {
    return {
      id: 'letter-gap',
      title: 'Gap between characters',
      status: 'na',
      detail: 'Single-character labels have no internal character gaps.',
    };
  }
  const status = gapStatus(minGap, thresholds);
  const offenders = offenderText(labels, gaps, thresholds.minGap);
  const detail =
    status === 'pass'
      ? 'The gap between adjacent characters is wide enough.'
      : status === 'warn'
        ? `Above the hard minimum, but below the ${formatMm(thresholds.recGap)} recommended gap. ${offenders}`.trim()
        : `Characters are too close to print cleanly. ${offenders}`.trim();
  return {
    id: 'letter-gap',
    title: 'Gap between characters',
    status,
    valueText: formatMm(minGap),
    limitText: `≥ ${formatMm(thresholds.minGap)}`,
    detail,
    fix: status === 'pass' ? undefined : gapFix('characters'),
  };
}

function labelGapFinding(
  labels: SpecLabelGeometry[],
  gaps: (number | null)[],
  minGap: number | null,
  thresholds: JlcThresholds
): SpecFinding {
  if (minGap === null) {
    return {
      id: 'label-gap',
      title: 'Gap between labels',
      status: 'na',
      detail: 'Only one enabled label, so there is no label-to-label gap.',
    };
  }
  const status = gapStatus(minGap, thresholds);
  const offenders = offenderText(labels, gaps, thresholds.minGap);
  const detail =
    status === 'pass'
      ? 'Adjacent labels are separated by enough ink (or clear space).'
      : status === 'warn'
        ? `Above the hard minimum, but below the ${formatMm(thresholds.recGap)} recommended gap. ${offenders}`.trim()
        : minGap < 0
          ? 'Labels overlap. JLCPCB may merge or remove the silkscreen.'
          : `Labels are too close to print cleanly. ${offenders}`.trim();
  return {
    id: 'label-gap',
    title: 'Gap between labels',
    status,
    valueText: formatMm(minGap),
    limitText: `≥ ${formatMm(thresholds.minGap)}`,
    detail,
    fix: status === 'pass' ? undefined : gapFix('labels'),
  };
}

function wallFinding(
  labels: SpecLabelGeometry[],
  walls: (number | null)[],
  minWall: number,
  thresholds: JlcThresholds,
  plateShown: boolean
): SpecFinding {
  const status = gapStatus(minWall, thresholds);
  const offenders = offenderText(labels, walls, thresholds.minGap);
  const where = plateShown
    ? 'Plate edge to glyph ink'
    : 'Box padding around the knocked-out glyphs';
  return {
    id: 'wall',
    title: 'Ink wall around knockout text',
    status,
    valueText: formatMm(minWall),
    limitText: `≥ ${formatMm(thresholds.minGap)}`,
    detail:
      status === 'pass'
        ? `${where} is wide enough to survive silkscreen printing.`
        : status === 'warn'
          ? `Above the hard minimum, but below the ${formatMm(thresholds.recGap)} recommended ink wall. ${offenders}`.trim()
          : `${where} is too thin and may break or fill in. ${offenders}`.trim(),
    fix:
      status === 'pass'
        ? undefined
        : 'Increase Box → Padding X/Y, or Plate → Margin, to at least 0.20 mm.',
  };
}

function plateFinding(geometry: SpecGeometry): SpecFinding {
  if (geometry.plateClipped) {
    return {
      id: 'plate',
      title: 'Plate contains the labels',
      status: 'fail',
      detail:
        'The plate’s fixed Width/Height canvas cuts off part of the labels. The exported PNG would be cropped.',
      fix: 'Increase Plate → Width/Height, or set both to 0 to auto-fit the plate.',
    };
  }
  return {
    id: 'plate',
    title: 'Plate contains the labels',
    status: 'pass',
    valueText:
      geometry.plateClearanceMm !== null ? formatMm(geometry.plateClearanceMm) : undefined,
    detail:
      geometry.plateClearanceMm !== null
        ? `All drawn labels fit inside the plate; the nearest glyph ink is ${formatMm(geometry.plateClearanceMm)} from the plate edge.`
        : 'All drawn labels fit inside the plate, so the exported canvas is not cropped.',
  };
}

function dpiFinding(featureMm: number, dpi: number, thresholds: JlcThresholds): SpecFinding {
  const px = (featureMm * dpi) / 25.4;
  const status: SpecStatus = px < 2 ? 'fail' : px < 4 ? 'warn' : 'pass';
  const valueText = `${px.toFixed(1)} px @ ${dpi} DPI`;
  return {
    id: 'dpi',
    title: 'Export resolution',
    status,
    valueText,
    limitText: '≥ 4 px on the narrowest feature',
    detail: `Narrowest feature ${formatMm(featureMm)} → ${px.toFixed(1)} px when rasterised. Edges get blocky when traced below ~4 px.`,
    fix:
      status === 'pass'
        ? undefined
        : `Raise Export → DPI to at least ${Math.max(thresholds.recDpi, 1200)} (2400+ recommended).`,
  };
}

/**
 * Clamp the design to JLCPCB's recommended values. Never shrinks anything.
 */
export function applyJlcpcbRecommendations(config: Config, profile: JlcProfile): Config {
  const thresholds = JLC_THRESHOLDS[profile];
  const clampStyle = (style: TextStyle): TextStyle => ({
    ...style,
    height: Math.max(style.height, thresholds.recHeight),
    thickness: Math.max(style.thickness, thresholds.recStroke),
  });
  const labels: LabelConfig[] = config.labels.map((label) => {
    if (!label.style) return label;
    const style = { ...label.style };
    if (style.height !== undefined) {
      style.height = Math.max(style.height, thresholds.recHeight);
    }
    if (style.thickness !== undefined) {
      style.thickness = Math.max(style.thickness, thresholds.recStroke);
    }
    return { ...label, style };
  });

  return {
    ...config,
    spec: { ...config.spec, profile },
    text: clampStyle(config.text),
    box: {
      ...config.box,
      padX: Math.max(config.box.padX, thresholds.recGap),
      padY: Math.max(config.box.padY, thresholds.recGap),
    },
    plate: {
      ...config.plate,
      marginMm: Math.max(config.plate.marginMm, thresholds.recGap),
    },
    export: {
      ...config.export,
      dpi: Math.max(config.export.dpi, thresholds.recDpi),
    },
    labels,
  };
}
