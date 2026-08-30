import type { Config } from '../model/types';
import { CheckboxField, NumberField, Section } from './Fields';

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function PlateControls({ config, setConfig }: Props) {
  const p = config.plate;
  const set = (patch: Partial<Config['plate']>) =>
    setConfig((c) => ({ ...c, plate: { ...c.plate, ...patch } }));

  return (
    <Section title="Plate">
      <CheckboxField
        label="Show plate (one big box)"
        value={p.showPlate}
        onChange={(v) => set({ showPlate: v })}
      />
      <CheckboxField
        label="Single box (hide per-label boxes)"
        value={p.disableBoxes}
        onChange={(v) => set({ disableBoxes: v })}
      />
      <NumberField
        label="Width"
        suffix="mm"
        step={0.5}
        min={0}
        value={p.widthMm}
        onChange={(v) => set({ widthMm: v })}
      />
      <NumberField
        label="Height"
        suffix="mm"
        step={0.5}
        min={0}
        value={p.heightMm}
        onChange={(v) => set({ heightMm: v })}
      />
      <NumberField
        label="Margin"
        suffix="mm"
        step={0.1}
        min={0}
        value={p.marginMm}
        onChange={(v) => set({ marginMm: v })}
      />
      <NumberField
        label="Corner radius"
        suffix="mm"
        step={0.1}
        min={0}
        value={p.cornerRadiusMm}
        onChange={(v) => set({ cornerRadiusMm: v })}
      />
      <div className="corner-grid">
        <CheckboxField label="Round top-left" value={p.roundTL} onChange={(v) => set({ roundTL: v })} />
        <CheckboxField label="Round top-right" value={p.roundTR} onChange={(v) => set({ roundTR: v })} />
        <CheckboxField label="Round bottom-left" value={p.roundBL} onChange={(v) => set({ roundBL: v })} />
        <CheckboxField label="Round bottom-right" value={p.roundBR} onChange={(v) => set({ roundBR: v })} />
      </div>
      <p className="hint">
        Use <strong>Single box</strong> to hide every per-label box so you get one clean plate
        (no wider boxes for longer labels). Set Width/Height to 0 to auto-fit the plate around the
        text.
      </p>
    </Section>
  );
}
