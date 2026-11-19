import type { ActionOpt, ActionOption, ActionParam, ActionTemplate, CatalogEntry, NodeAction } from './model';

/* ============================================================================
 * Acciones de los nodos del catálogo
 *
 * Una acción es una URL con variables:
 *   - absoluta (`https://…`): se abre en `target` (por defecto, una pestaña nueva);
 *   - hash (`#…`): se asigna al hash de la página y la aplicación que contiene al
 *     visor la ejecuta con sus propios listeners.
 *
 * Variables: `{{var}}` se codifica para URL; `{{{var}}}` va tal cual. Los valores salen,
 * de menos a más prioridad, de: el nodo (`id`, `name`, `type`, `parent`, `props.<clave>`),
 * los `params` de la plantilla, los `params` de la acción del nodo y, por último, lo que se
 * elija en el diálogo para cada variable de `opts` que no tenga ya valor.
 * ==========================================================================*/

export type ActionKind = 'url' | 'hash';

/** Campo del diálogo: una variable de `opts` sin valor */
export type ActionField = { name: string; label: string; options: ActionOption[] };

/** Acción de un nodo lista para mostrarse */
export type PreparedAction = {
  /** Índice de la acción en el nodo (clave estable para React y para recordar lo elegido) */
  key: string;
  label: string;
  description?: string;
  kind: ActionKind;
  /** URL con variables, ya combinada con la plantilla */
  url: string;
  target?: string;
  /** Plantilla en la que se basa */
  template?: string;
  /** Valores conocidos (nodo + params) */
  values: Record<string, string>;
  /** Variables a elegir en el diálogo */
  fields: ActionField[];
  /** No se puede lanzar: plantilla inexistente, sin url, variables sin valor… */
  error?: string;
};

/** Acción ya rellena, lista para ejecutarse */
export type ResolvedAction = {
  kind: ActionKind;
  href: string;
  target?: string;
  label: string;
  template?: string;
  /** Id completo del nodo del catálogo */
  nodeId: string;
  /** Valores con los que se ha rellenado (incluidos los elegidos en el diálogo) */
  values: Record<string, string>;
};

const NOT_ABSOLUTE = 'La url debe ser absoluta (https://…) o un hash (#…)';
const isLaunchable = (href: string) => actionKind(href) === 'hash' || /^\s*[a-z][\w+.-]*:\/\//i.test(href);

const VAR = /\{\{\{\s*([\w.-]+)\s*\}\}\}|\{\{\s*([\w.-]+)\s*\}\}/g;

/** Variables que usa una URL */
export function templateVars(url: string): string[] {
  return [...new Set([...url.matchAll(VAR)].map((m) => m[1] ?? m[2]))];
}

/** Rellena las variables de `url`; devuelve también las que no tienen valor */
export function fillUrl(url: string, values: Record<string, string>): { href: string; missing: string[] } {
  const missing: string[] = [];
  const href = url.replace(VAR, (_m, raw: string | undefined, enc: string | undefined) => {
    const name = (raw ?? enc)!;
    const v = values[name];
    if (v == null) {
      missing.push(name);
      return '';
    }
    return raw ? v : encodeURIComponent(v);
  });
  return { href, missing: [...new Set(missing)] };
}

export const actionKind = (url: string): ActionKind => (url.trimStart().startsWith('#') ? 'hash' : 'url');

const normOption = (o: ActionOption | string): ActionOption => (typeof o === 'string' ? { value: o } : o);

function normField(name: string, opt: ActionOpt): ActionField {
  const list = Array.isArray(opt) ? opt : opt.options;
  return { name, label: (!Array.isArray(opt) && opt.label) || name, options: list.map(normOption) };
}

const str = (v: ActionParam | undefined | null) => (v == null ? undefined : String(v));

/** Variables que da el propio nodo: id, name, type, parent y props.<clave> (solo valores simples) */
export function nodeValues(node: CatalogEntry): Record<string, string> {
  const out: Record<string, string> = { id: node.id, type: node.type };
  if (node.name) out.name = node.name;
  if (node.parent) out.parent = node.parent;
  for (const [k, v] of Object.entries(node.props ?? {})) {
    if (v != null && typeof v !== 'object') out[`props.${k}`] = String(v);
  }
  return out;
}

/** Acciones de un nodo del catálogo, combinadas con sus plantillas */
export function prepareActions(node: CatalogEntry, templates: ReadonlyMap<string, ActionTemplate>): PreparedAction[] {
  const base = nodeValues(node);
  return (node.actions ?? []).map((raw, i) => {
    const own: NodeAction = typeof raw === 'string' ? { template: raw } : raw;
    const tpl = own.template ? templates.get(own.template) : undefined;
    const url = own.url ?? tpl?.url ?? '';
    const values: Record<string, string> = { ...base };
    for (const [k, v] of Object.entries({ ...tpl?.params, ...own.params })) {
      const s = str(v);
      if (s != null) values[k] = s;
    }
    // Las variables con valor no se preguntan
    const opts = { ...tpl?.opts, ...own.opts };
    const fields = Object.entries(opts)
      .filter(([name]) => values[name] == null)
      .map(([name, opt]) => normField(name, opt))
      .filter((f) => f.options.length);
    const prepared: PreparedAction = {
      key: String(i),
      label: own.label ?? tpl?.label ?? own.template ?? url,
      description: own.description ?? tpl?.description,
      kind: actionKind(url),
      url,
      target: own.target ?? tpl?.target,
      template: own.template,
      values,
      fields,
    };
    if (own.template && !tpl) prepared.error = `No existe la plantilla de acción «${own.template}»`;
    else if (!url) prepared.error = 'La acción no tiene url';
    else {
      const asked = new Set(fields.map((f) => f.name));
      const missing = templateVars(url).filter((v) => values[v] == null && !asked.has(v));
      if (missing.length) prepared.error = `Sin valor para ${missing.map((m) => `{{${m}}}`).join(', ')}`;
      // Si empieza por una variable, se comprueba al rellenarla
      else if (!/^\s*\{\{/.test(url) && !isLaunchable(url)) prepared.error = NOT_ABSOLUTE;
    }
    return prepared;
  });
}

/** Rellena una acción con lo elegido en el diálogo */
export function resolveAction(action: PreparedAction, nodeId: string, chosen: Record<string, string> = {}): ResolvedAction {
  const values = { ...action.values, ...chosen };
  const { href, missing } = fillUrl(action.url, values);
  if (missing.length) throw new Error(`Acción «${action.label}»: sin valor para ${missing.map((m) => `{{${m}}}`).join(', ')}`);
  if (!isLaunchable(href)) throw new Error(`Acción «${action.label}»: ${NOT_ABSOLUTE.toLowerCase()} (${href})`);
  return { kind: actionKind(href), href: href.trim(), target: action.target, label: action.label, template: action.template, nodeId, values };
}
