import React from 'react';
import { Check, CircleAlert, X } from 'lucide-react';

/** Si la carga termina antes, no se llega a mostrar el diálogo (evita parpadeos al navegar) */
const SHOW_DELAY_MS = 200;
/** Tiempo que el diálogo sigue visible (al 100 %, sin bloquear) cuando termina una carga */
const LINGER_MS = 350;

type Progress = { done: number; total: number };

/**
 * Diálogo de carga sobre un fondo oscuro que bloquea la pantalla. Con `progress` (ficheros
 * leídos / total conocido, que crece al descubrir includes) muestra una barra. Con `onCancel`
 * ofrece «Cancelar» (también con Esc), lo único que se puede hacer mientras tanto.
 *
 * Aparece si la carga dura más de {@link SHOW_DELAY_MS}; al terminar se queda un momento
 * completo y se desvanece sin bloquear.
 */
export function LoadingOverlay({
  show,
  label,
  progress,
  onCancel,
}: {
  show: boolean;
  label?: string;
  progress?: Progress | null;
  onCancel?: () => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const [linger, setLinger] = React.useState<Progress | null>(null);
  const last = React.useRef<Progress | null>(null);
  const cancelled = React.useRef(false);
  const cancelBtn = React.useRef<HTMLButtonElement>(null);
  if (show && progress) last.current = progress;

  React.useEffect(() => {
    if (show) {
      cancelled.current = false;
      setLinger(null);
      const t = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    const p = last.current;
    last.current = null;
    // Sólo se despide si se llegó a ver y la carga no se canceló
    const wasVisible = visible;
    setVisible(false);
    if (!p || !wasVisible || cancelled.current) return;
    setLinger({ done: p.total, total: p.total });
    const t = window.setTimeout(() => setLinger(null), LINGER_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const open = show && visible;
  React.useEffect(() => {
    if (open) cancelBtn.current?.focus();
  }, [open]);

  if (!open && !linger) return null;
  const current = open ? progress : linger;
  const pct = current && current.total ? Math.round((current.done / current.total) * 100) : 0;
  const cancel = () => {
    cancelled.current = true;
    onCancel?.();
  };
  return (
    <div
      className={`dv-loading-backdrop${open ? '' : ' dv-loading-closing'}`}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          cancel();
        }
        // El foco no sale del diálogo
        if (e.key === 'Tab') e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="dv-loading" role="dialog" aria-modal="true" aria-labelledby="dv-loading-title">
        <div className="dv-loading-head">
          {open ? <span className="dv-spinner" /> : <Check size={20} className="dv-loading-done" />}
          <h2 id="dv-loading-title">{open ? (label ?? 'Cargando…') : 'Cargado'}</h2>
        </div>
        {current && (
          <div className="dv-loading-body">
            <span className="dv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={current.total} aria-valuenow={current.done}>
              <span className="dv-progress-fill" style={{ width: `${pct}%` }} />
            </span>
            <div className="dv-progress-meta">
              <span>
                {current.done} de {current.total} {current.total === 1 ? 'fichero' : 'ficheros'}
              </span>
              <span>{pct}%</span>
            </div>
          </div>
        )}
        {onCancel && (
          <footer className="dv-modal-foot">
            <button ref={cancelBtn} type="button" className="dv-btn" onClick={cancel} disabled={!open}>
              Cancelar
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="dv-banner" role="alert">
      <CircleAlert size={16} />
      <span>{message}</span>
      <button className="dv-icon-btn" onClick={onClose} title="Cerrar">
        <X size={14} />
      </button>
    </div>
  );
}

/** Pantalla completa para errores que impiden mostrar cualquier diagrama. */
export function ErrorScreen({ message, actions }: { message: string; actions: React.ReactNode }) {
  return (
    <div className="dv-gate">
      <div className="dv-gate-card">
        <h1>No se puede mostrar el diagrama</h1>
        <div className="dv-gate-error">{message}</div>
        <div className="dv-gate-buttons">{actions}</div>
      </div>
    </div>
  );
}
