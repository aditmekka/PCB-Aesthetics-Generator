import type { Config } from '../model/types';
import { evaluateJlcpcb } from '../model/jlcpcb';
import type { JlcReport } from '../model/jlcpcb';
import { measureSpecGeometry } from './renderer';

/**
 * Measured, not exported at DPI: every value is converted back to millimetres,
 * so the report is stable while the user drags the DPI preset.
 */
const SPEC_MEASURE_DPI = 600;

/** Measure the current design and run the JLCPCB rule engine. */
export function evaluateJlcpcbDesign(config: Config): JlcReport {
  return evaluateJlcpcb(
    measureSpecGeometry(config, SPEC_MEASURE_DPI),
    config.spec.profile,
    config.export.dpi
  );
}
