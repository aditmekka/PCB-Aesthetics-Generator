import type { Config, LabelConfig } from '../model/types';

let nextId = 1;
function makeId(): string {
  return `label-${Date.now()}-${nextId++}`;
}

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function LabelList({ config, setConfig }: Props) {
  const labels = config.labels;

  const updateLabel = (id: string, patch: Partial<LabelConfig>) => {
    setConfig((c) => ({
      ...c,
      labels: c.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const removeLabel = (id: string) => {
    setConfig((c) => ({ ...c, labels: c.labels.filter((l) => l.id !== id) }));
  };

  const moveLabel = (index: number, dir: -1 | 1) => {
    setConfig((c) => {
      const next = [...c.labels];
      const target = index + dir;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...c, labels: next };
    });
  };

  const addLabel = () => {
    setConfig((c) => ({
      ...c,
      labels: [...c.labels, { id: makeId(), text: '', enabled: true, showBox: true }],
    }));
  };

  return (
    <div className="label-list">
      {labels.map((l, idx) => (
        <div key={l.id} className="label-row">
          <input
            type="checkbox"
            checked={l.enabled}
            onChange={(e) => updateLabel(l.id, { enabled: e.target.checked })}
            title="Enable"
          />
          <input
            type="checkbox"
            checked={l.showBox}
            onChange={(e) => updateLabel(l.id, { showBox: e.target.checked })}
            title="Individual box"
          />
          <input
            className="label-text"
            type="text"
            value={l.text}
            placeholder="Label"
            onChange={(e) => updateLabel(l.id, { text: e.target.value })}
          />
          <button
            className="icon-btn"
            onClick={() => moveLabel(idx, -1)}
            disabled={idx === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="icon-btn"
            onClick={() => moveLabel(idx, 1)}
            disabled={idx === labels.length - 1}
            title="Move down"
          >
            ↓
          </button>
          <button className="icon-btn danger" onClick={() => removeLabel(l.id)} title="Remove">
            ×
          </button>
        </div>
      ))}
      <button className="btn add-btn" onClick={addLabel}>
        + Add label
      </button>
    </div>
  );
}
