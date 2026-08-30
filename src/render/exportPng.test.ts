import { describe, expect, it } from 'vitest';
import { makeFilename } from './exportPng';
import { DEFAULT_CONFIG } from '../model/defaults';

describe('makeFilename', () => {
  it('joins enabled labels with underscores', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      labels: [
        { id: '1', text: 'VBUS', enabled: true, showBox: true },
        { id: '2', text: 'GND', enabled: true, showBox: true },
      ],
    };
    expect(makeFilename(cfg)).toBe('VBUS_GND.png');
  });

  it('skips disabled and empty labels', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      labels: [
        { id: '1', text: 'CHARGING', enabled: true, showBox: true },
        { id: '2', text: '', enabled: true, showBox: true },
        { id: '3', text: 'STANDBY', enabled: false, showBox: true },
      ],
    };
    expect(makeFilename(cfg)).toBe('CHARGING.png');
  });

  it('sanitizes special characters', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      labels: [{ id: '1', text: 'V+ V-', enabled: true, showBox: true }],
    };
    expect(makeFilename(cfg)).toBe('V_V.png');
  });

  it('falls back when there is no enabled text', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      labels: [{ id: '1', text: '', enabled: true, showBox: true }],
    };
    expect(makeFilename(cfg)).toBe('silkscreen_knockout.png');
  });

  it('truncates very long names', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      labels: [{ id: '1', text: 'A'.repeat(200), enabled: true, showBox: true }],
    };
    expect(makeFilename(cfg)).toBe('A'.repeat(120) + '.png');
  });
});
