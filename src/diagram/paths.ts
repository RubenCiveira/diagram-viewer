/** Rutas lógicas dentro de la carpeta de diagramas: siempre relativas a la raíz, separadas por '/'. */

export function normPath(p: string): string {
  const out: string[] = [];
  for (const seg of String(p).replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!out.length) throw new Error(`La ruta «${p}» sale de la carpeta de diagramas`);
      out.pop();
    } else out.push(seg);
  }
  return out.join('/');
}

/** Resuelve `rel` respecto al fichero `base` (no a su carpeta). Una ruta con '/' inicial parte de la raíz. */
export function resolvePath(base: string, rel: string): string {
  if (rel.startsWith('/')) return normPath(rel);
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  return normPath(dir + rel);
}

export function baseName(p: string): string {
  return p.split('/').pop() ?? p;
}

export function stripExt(p: string): string {
  return p.replace(/\.[^.\/]+$/, '');
}
