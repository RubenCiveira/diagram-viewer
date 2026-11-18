import { normPath } from '../diagram/paths';

/**
 * Estado del visor reflejado en el hash de la URL, para poder recargar,
 * volver atrás o compartir un enlace y recuperar exactamente la misma vista:
 *
 *   #file=public/e-commerce&d=pedidos/index.json&d=pedidos/inventario.json&sel=svc&vp=120,-40,0.85
 *
 * - `file`: diagrama seleccionado en el árbol (carpeta con index.json o fichero .json). Siempre primero.
 * - `d`: subdiagramas abiertos, en orden, relativos a la carpeta del diagrama raíz.
 * - `sel`: id del nodo o arista con la ficha abierta.
 * - `vp`: desplazamiento x, y y zoom del lienzo.
 */
export type Viewport = { x: number; y: number; zoom: number };

export type UrlState = {
  file?: string;
  diagrams: string[];
  sel?: string;
  vp?: Viewport;
};

const enc = (s: string) => encodeURIComponent(s).replace(/%2F/gi, '/').replace(/%3A/gi, ':');

export function readUrl(): UrlState {
  const params = new URLSearchParams(location.hash.slice(1));
  const clean = (p: string | null) => {
    if (!p) return undefined;
    try {
      return normPath(p) || undefined;
    } catch {
      return undefined;
    }
  };
  const vp = params.get('vp')?.split(',').map(Number);
  return {
    file: clean(params.get('file')),
    // Se validan al resolverlas contra el diagrama raíz (pueden empezar por '/' si salen de su carpeta)
    diagrams: params.getAll('d').filter(Boolean),
    sel: params.get('sel') || undefined,
    vp: vp && vp.length === 3 && vp.every(Number.isFinite) && vp[2] > 0 ? { x: vp[0], y: vp[1], zoom: vp[2] } : undefined,
  };
}

function serialize(s: UrlState): string {
  const parts: string[] = [];
  if (s.file) {
    parts.push(`file=${enc(s.file)}`);
    for (const d of s.diagrams) parts.push(`d=${enc(d)}`);
    if (s.sel) parts.push(`sel=${enc(s.sel)}`);
    if (s.vp) parts.push(`vp=${Math.round(s.vp.x)},${Math.round(s.vp.y)},${+s.vp.zoom.toFixed(3)}`);
  }
  return parts.length ? `#${parts.join('&')}` : location.pathname + location.search;
}

/**
 * Escribe el estado completo. `push` crea una entrada de historial (cambio de
 * diagrama); `replace` la sustituye (selección, desplazamiento, zoom).
 */
export function writeUrl(s: UrlState, mode: 'push' | 'replace') {
  const url = serialize(s);
  const current = location.hash ? location.hash : location.pathname + location.search;
  if (url === current) return;
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

/** Cambia sólo algunos campos, conservando el resto de la URL actual. */
export function patchUrl(patch: Partial<UrlState>, mode: 'push' | 'replace' = 'replace') {
  writeUrl({ ...readUrl(), ...patch }, mode);
}
