import type { Config } from '../model/types';
import { AlphaField, CheckboxField, ColorField, Section } from './Fields';

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function PreviewControls({ config, setConfig }: Props) {
  const p = config.preview;
  const set = (patch: Partial<Config['preview']>) =>
    setConfig((c) => ({ ...c, preview: { ...c.preview, ...patch } }));

  return (
    <Section title="Colors">
      <CheckboxField
        label="Show board background"
        value={p.showPreviewBg}
        onChange={(v) => set({ showPreviewBg: v })}
      />
      <ColorField label="Box color" value={p.boxColor} onChange={(v) => set({ boxColor: v })} />
      <AlphaField label="Box opacity" value={p.boxAlpha} onChange={(v) => set({ boxAlpha: v })} />
      <ColorField
        label="Board color"
        value={p.boardColor}
        onChange={(v) => set({ boardColor: v })}
      />
      <AlphaField
        label="Board opacity"
        value={p.boardAlpha}
        onChange={(v) => set({ boardAlpha: v })}
      />
      <ColorField label="Text color" value={p.textColor} onChange={(v) => set({ textColor: v })} />
      <AlphaField label="Text opacity" value={p.textAlpha} onChange={(v) => set({ textAlpha: v })} />
      <p className="hint">
        Preview uses these colors. Pick <strong>Colorized</strong> in Export to save them (with
        transparency) as a styled PNG; use <strong>KiCad black</strong> to export a black-on-transparent
        bitmap for the Image Converter.
      </p>
    </Section>
  );
}
