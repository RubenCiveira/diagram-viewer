import { CircleAlert, X } from 'lucide-react';

export function LoadingOverlay({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="dv-loading" role="status">
      <span className="dv-spinner" />
      {label ?? 'Cargando…'}
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
