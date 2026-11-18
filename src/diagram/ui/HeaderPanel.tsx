import { ChevronLeft, ChevronRight, House } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export type Crumb = { path: string; label: string };

type Props = {
  title: string;
  description?: string;
  /** Diagramas anteriores en la ruta de navegación (sin el actual) */
  crumbs: Crumb[];
  onNavigate: (index: number) => void;
  /** Vuelve al árbol de diagramas */
  onHome: () => void;
  /** Retroceder un nivel (al padre o al árbol) */
  onBack: () => void;
};

/** Título del diagrama actual con las migas de pan de los diagramas padre. */
export default function HeaderPanel({ title, description, crumbs, onNavigate, onHome, onBack }: Props) {
  return (
    <div className="dv-panel dv-header">
      <nav className="dv-crumbs" aria-label="Ruta">
        <button className="dv-icon-btn dv-back" onClick={onBack} title="Volver (Retroceso)">
          <ChevronLeft size={16} />
        </button>
        <span className="dv-crumb">
          <button onClick={onHome} title="Árbol de diagramas" className="dv-crumb-home">
            <House size={13} />
          </button>
          <ChevronRight size={12} className="dv-crumb-sep" />
        </span>
        {crumbs.map((c, i) => (
          <span key={c.path + i} className="dv-crumb">
            <button onClick={() => onNavigate(i)}>{c.label}</button>
            <ChevronRight size={12} className="dv-crumb-sep" />
          </span>
        ))}
      </nav>
      <h1>{title}</h1>
      {description && (
        <div className="dv-header-desc dv-md">
          <ReactMarkdown>{description}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
