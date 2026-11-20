import { CircleAlert, X } from 'lucide-react';

/**
 * Aviso de carga. Con `progress` (ficheros leídos / total conocido) muestra además una barra;
 * el total puede crecer mientras se descubren includes.
 */
export function LoadingOverlay({
  show,
  label,
  progress,
}: {
  show: boolean;
  label?: string;
  progress?: { done: number; total: number } | null;
}) {
  if (!show) return null;
  const withBar = progress != null && progress.total > 1;
  const pct = withBar ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="dv-loading" role="status">
      <span className="dv-spinner" />
      <span>{label ?? 'Cargando…'}</span>
      {withBar && (
        <>
          <span
            className="dv-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <span className="dv-progress-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="dv-progress-count">
            {progress.done}/{progress.total}
          </span>
        </>
      )}
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
