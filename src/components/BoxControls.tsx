import type { Config } from '../model/types';
import { NumberField, Section } from './Fields';

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function BoxControls({ config, setConfig }: Props) {
  const b = config.box;
  const set = (patch: Partial<Config['box']>) =>
    setConfig((c) => ({ ...c, box: { ...c.box, ...patch } }));

  return (
    <Section title="Box">
      <NumberField
        label="Padding X"
        suffix="mm"
        step={0.1}
        min={0}
        value={b.padX}
        onChange={(v) => set({ padX: v })}
      />
      <NumberField
        label="Padding Y"
        suffix="mm"
        step={0.1}
        min={0}
        value={b.padY}
        onChange={(v) => set({ padY: v })}
      />
      <NumberField
        label="Corner radius"
        suffix="mm"
        step={0.1}
        min={0}
        value={b.cornerRadius}
        onChange={(v) => set({ cornerRadius: v })}
      />
    </Section>
  );
}
