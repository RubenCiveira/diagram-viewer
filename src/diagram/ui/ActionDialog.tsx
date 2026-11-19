import React from 'react';
import { ExternalLink, Hash, X } from 'lucide-react';
import { fillUrl, type PreparedAction } from '../actions';

type Props = {
  action: PreparedAction;
  /** Nombre del nodo, para el subtítulo */
  nodeName: string;
  onRun: (chosen: Record<string, string>) => void;
  onClose: () => void;
};

/** Con más valores que estos, el campo es un desplegable en vez de botones */
const MAX_RADIOS = 5;

/** Clave con la que se recuerda lo último elegido en cada variable (por plantilla o acción) */
const memoryKey = (a: PreparedAction, field: string) => `dv-action:${a.template ?? a.label}:${field}`;

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** Diálogo que pide las variables `opts` de una acción antes de lanzarla. */
export default function ActionDialog({ action, nodeName, onRun, onClose }: Props) {
  const [chosen, setChosen] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      action.fields.map((f) => {
        const last = recall(memoryKey(action, f.name));
        return [f.name, f.options.some((o) => o.value === last) ? last! : f.options[0].value];
      }),
    ),
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    // En captura: que Escape cierre el diálogo y no también la ficha
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const preview = fillUrl(action.url, { ...action.values, ...chosen }).href;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of action.fields) remember(memoryKey(action, f.name), chosen[f.name]);
    onRun(chosen);
  };
  const set = (name: string, value: string) => setChosen((c) => ({ ...c, [name]: value }));

  return (
    <div className="dv-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dv-modal" role="dialog" aria-modal="true" aria-labelledby="dv-action-title" onSubmit={submit}>
        <header className="dv-modal-head">
          <div>
            <h2 id="dv-action-title">{action.label}</h2>
            <div className="dv-muted">{nodeName}</div>
          </div>
          <button type="button" className="dv-icon-btn" onClick={onClose} title="Cerrar (Esc)">
            <X size={16} />
          </button>
        </header>
        {action.description && <p className="dv-action-desc">{action.description}</p>}
        {action.fields.map((f) =>
          f.options.length > MAX_RADIOS ? (
            <label key={f.name} className="dv-action-select">
              <span>{f.label}</span>
              <select value={chosen[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label ?? o.value}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <fieldset key={f.name} className="dv-choice dv-choice-row">
              <legend>{f.label}</legend>
              {f.options.map((o) => (
                <label key={o.value}>
                  <input type="radio" name={f.name} checked={chosen[f.name] === o.value} onChange={() => set(f.name, o.value)} />
                  <span>
                    {o.label ?? o.value}
                    {o.label && o.label !== o.value && <small>{o.value}</small>}
                  </span>
                </label>
              ))}
            </fieldset>
          ),
        )}
        <code className="dv-action-preview" title={preview}>
          {preview}
        </code>
        <footer className="dv-modal-foot">
          <button type="button" className="dv-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="dv-btn dv-btn-primary" autoFocus>
            {action.kind === 'hash' ? <Hash size={15} /> : <ExternalLink size={15} />}
            {action.kind === 'hash' ? 'Ejecutar' : 'Abrir'}
          </button>
        </footer>
      </form>
    </div>
  );
}
