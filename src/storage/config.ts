/**
 * Configuración de despliegue, leída de `window.DIAGRAM_VIEWER_CONFIG` (lo define ./config.js,
 * que el build genera junto al HTML y se puede editar sin recompilar). Así la misma build sirve
 * para abrirla en local o para publicarla en una web estática.
 *
 *   window.DIAGRAM_VIEWER_CONFIG = {
 *     source: "auto",       // "auto" | "local" | "http"
 *     baseUrl: "./",        // sólo "http"/"auto": raíz de los diagramas (relativa a la página o absoluta)
 *     index: "index.json"   // índice de diagramas, relativo a baseUrl (o a la carpeta en local)
 *   };
 *
 * - "auto": por HTTP si hay índice en baseUrl; si no, diagram-data.js; si no, pedir la carpeta.
 * - "local": nunca HTTP; diagram-data.js si existe y, si no, pedir acceso a la carpeta.
 * - "http": siempre por HTTP desde baseUrl (si falla, se muestra el error en vez de pedir carpeta).
 */
export type StorageSource = 'auto' | 'local' | 'http';

export type ViewerConfig = {
  source: StorageSource;
  /** URL absoluta de la raíz de los diagramas, terminada en "/" */
  baseUrl: string;
  /** Ruta del índice relativa a la raíz */
  index: string;
};

declare global {
  interface Window {
    DIAGRAM_VIEWER_CONFIG?: Partial<{ source: string; baseUrl: string; index: string }>;
  }
}

export const DEFAULT_INDEX = 'index.json';

function read(): ViewerConfig {
  const raw = (typeof window !== 'undefined' && window.DIAGRAM_VIEWER_CONFIG) || {};
  const source: StorageSource = raw.source === 'local' || raw.source === 'http' ? raw.source : 'auto';
  if (raw.source !== undefined && raw.source !== source) {
    console.warn(`config.js: source «${raw.source}» no válido; se usa «auto»`);
  }
  let base = typeof raw.baseUrl === 'string' && raw.baseUrl.trim() ? raw.baseUrl.trim() : './';
  if (!base.endsWith('/')) base += '/';
  const index = typeof raw.index === 'string' && raw.index.trim() ? raw.index.trim().replace(/^\/+/, '') : DEFAULT_INDEX;
  return { source, baseUrl: new URL(base, location.href).href, index };
}

export const viewerConfig: ViewerConfig = read();
