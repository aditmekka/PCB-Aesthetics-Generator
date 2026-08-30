import type { Config } from '../model/types';
import { NumberField, Section, SelectField } from './Fields';

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function LayoutControls({ config, setConfig }: Props) {
  const l = config.layout;
  const set = (patch: Partial<Config['layout']>) =>
    setConfig((c) => ({ ...c, layout: { ...c.layout, ...patch } }));

  return (
    <Section title="Layout">
      <NumberField
        label="Pitch"
        suffix="mm"
        step={0.01}
        min={0}
        value={l.pitch}
        onChange={(v) => set({ pitch: v })}
      />
      <SelectField
        label="Arrangement"
        value={l.arrangement}
        onChange={(v) => set({ arrangement: v as Config['layout']['arrangement'] })}
        options={[
          { label: 'Row (horizontal)', value: 'row' },
          { label: 'Column (vertical)', value: 'column' },
        ]}
      />
      <SelectField
        label="Orientation"
        value={String(l.orientation)}
        onChange={(v) => set({ orientation: Number(v) })}
        options={[
          { label: '0°', value: '0' },
          { label: '90°', value: '90' },
          { label: '180°', value: '180' },
          { label: '270°', value: '270' },
        ]}
      />
      <NumberField
        label="Origin X"
        suffix="mm"
        step={0.1}
        value={l.originX}
        onChange={(v) => set({ originX: v })}
      />
      <NumberField
        label="Origin Y"
        suffix="mm"
        step={0.1}
        value={l.originY}
        onChange={(v) => set({ originY: v })}
      />
    </Section>
  );
}
