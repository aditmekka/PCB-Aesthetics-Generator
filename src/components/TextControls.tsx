import { useRef, useState } from 'react';
import type { Config } from '../model/types';
import type { FontEntry } from '../fonts';
import { NumberField, Section, SelectField } from './Fields';

const FONTS = [
  { label: 'Monospace (KiCad-like)', value: 'monospace' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const WEIGHTS = [
  { label: 'Regular (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Bold (700)', value: '700' },
  { label: 'Black (900)', value: '900' },
];

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  customFonts: FontEntry[];
  onUploadFont: (file: File) => Promise<void>;
}

export function TextControls({ config, setConfig, customFonts, onUploadFont }: Props) {
  const t = config.text;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const set = (patch: Partial<Config['text']>) =>
    setConfig((c) => ({ ...c, text: { ...c.text, ...patch } }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      await onUploadFont(file);
    } catch {
      setError('Could not load that font file.');
    }
  };

  const fontOptions = [
    ...FONTS,
    ...customFonts.map((f) => ({ label: f.label, value: f.family })),
  ];

  return (
    <Section title="Text">
      <NumberField
        label="Height"
        suffix="mm"
        step={0.1}
        min={0.1}
        value={t.height}
        onChange={(v) => set({ height: v })}
      />
      <NumberField
        label="Width"
        suffix="mm"
        step={0.1}
        min={0.1}
        value={t.width}
        onChange={(v) => set({ width: v })}
      />
      <NumberField
        label="Thickness"
        suffix="mm"
        step={0.05}
        min={0.05}
        value={t.thickness}
        onChange={(v) => set({ thickness: v })}
      />
      <SelectField label="Font" value={t.font} onChange={(v) => set({ font: v })} options={fontOptions} />
      <SelectField
        label="Weight"
        value={String(t.weight)}
        onChange={(v) => set({ weight: Number(v) })}
        options={WEIGHTS}
      />
      <SelectField
        label="H. align"
        value={t.hAlign}
        onChange={(v) => set({ hAlign: v as Config['text']['hAlign'] })}
        options={[
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ]}
      />
      <SelectField
        label="V. align"
        value={t.vAlign}
        onChange={(v) => set({ vAlign: v as Config['text']['vAlign'] })}
        options={[
          { label: 'Top', value: 'top' },
          { label: 'Middle', value: 'middle' },
          { label: 'Bottom', value: 'bottom' },
        ]}
      />
      <div className="font-upload">
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ Upload .ttf / .otf
        </button>
        {customFonts.length > 0 && (
          <span className="font-count">{customFonts.length} custom</span>
        )}
      </div>
      {error && <p className="hint error">{error}</p>}
    </Section>
  );
}
