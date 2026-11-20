import { DETAIL_PREFIX, edgeId, flattenCatalogNodes, includedTypes, INLINE_SEP, INNER_SEP, matchesRelationPattern, UniqueIds } from './model';
import type {
  ActionTemplate,
  CatalogEntry,
  CatalogModel,
  CatalogRelation,
  DiagramGroup,
  IncludeRule,
  LayoutAlgorithm,
  DiagramEdge,
  DiagramModel,
  DiagramNode,
  ExpandMode,
  Position,
  RelationRule,
} from './model';

/* ============================================================================
 * Modelo resuelto: lo que se pinta, una vez aplicadas las referencias al
 * catálogo. Los tipos de la paleta trabajan siempre sobre él.
 * ==========================================================================*/

/** De dónde sale un nodo pintado */
export type NodeOrigin =
  | { kind: 'node' }
  | { kind: 'diagram' }
  /** `imported`: lo ha añadido la expansión de otra referencia, no está en el diagrama */
  | { kind: 'ref'; catalogId: string; imported: boolean };

export type ViewNode = {
  id: string;
  /** Tipo de la paleta */
  type: string;
  name?: string;
  description?: string;
  props: Record<string, any>;
  position?: Position;
  errors?: string[];
  warns?: string[];
  width?: number;
  height?: number;
  origin: NodeOrigin;
  /** Subdiagrama que abre al pulsarlo (ruta relativa al diagrama actual, p. ej. `::@0:mfe-login`) */
  subdiagram?: string;
  /** Tiene nodos internos: su ficha ofrece «Ver detalle», que abre esta ruta (`::#pagos`) */
  detail?: string;
};

export type ViewEdge = DiagramEdge & {
  /** Tramo de una relación que pasa por un nodo intermedio (`through`) */
  via?: string;
  /** Calculado: from:{origen}-to:{destino} (con #n si el par se repite) */
  id: string;
  /** Relación del catálogo de la que procede, si no está en el diagrama */
  relationId?: string;
  /**
   * La relación es de un nodo interno (o llega al nodo entero en su detalle) y se pinta desde/hacia
   * el nodo que lo representa aquí. Si se repite con otra entre los mismos nodos, se queda la otra.
   */
  lifted?: boolean;
};

/**
 * Relación completa que pasa por un intermedio (`through`). En el lienzo sólo están sus tramos,
 * que además se fusionan con otros iguales; esto conserva origen, intermedio y destino.
 */
export type ViewRoute = {
  relationId: string;
  source: string;
  via: string;
  target: string;
  /** Nombre del nodo interno que interviene, si el extremo se pinta sobre su contenedor */
  innerSource?: string;
  innerTarget?: string;
  label?: string;
  technology?: string;
  type?: string;
  uses?: boolean;
};

export type ViewModel = {
  title?: string;
  description?: string;
  direction: 'LR' | 'TB';
  layout?: LayoutAlgorithm;
  nodes: ViewNode[];
  edges: ViewEdge[];
  /** Relaciones `through` pintadas como tramos (ids de la vista) */
  routes: ViewRoute[];
  /** Cajas que agrupan nodos */
  groups: ViewGroup[];
  warnings: string[];
};

export type ViewGroup = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  layout?: 'box';
  explicit?: boolean;
  nodeIds: string[];
};

/** Tipo de paleta interno para los nodos kind=diagram */
export const SUBDIAGRAM_TYPE = 'subdiagram';
/** Tipo para referencias que no se pueden resolver */
export const MISSING_TYPE = 'missing-ref';

const PRESETS: Record<ExpandMode, { outgoing: RelationRule[]; incoming: RelationRule[] }> = {
  node: { outgoing: [], incoming: [] },
  config: { outgoing: [{ type: 'config', import: true }], incoming: [] },
  all: { outgoing: [{ import: true }], incoming: [{ import: true }] },
};

const matches = (rule: RelationRule, rel: CatalogRelation) => {
  if (rule.type == null || rule.type === '*') return true;
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  return rel.type != null && types.includes(rel.type);
};

export const importedId = (catalogId: string) => `cat:${catalogId}`;

/** Índice del catálogo para búsquedas rápidas */
export class CatalogIndex {
  /** Todos los nodos, internos incluidos, por id completo (`pagos/cobrar`) */
  readonly nodes: Map<string, CatalogEntry>;
  /** Nodos internos de cada nodo */
  readonly children = new Map<string, CatalogEntry[]>();
  readonly outgoing = new Map<string, CatalogRelation[]>();
  readonly incoming = new Map<string, CatalogRelation[]>();
  /** Plantillas de acción, por nombre */
  readonly actionTemplates: ReadonlyMap<string, ActionTemplate>;

  constructor(readonly model: CatalogModel) {
    this.actionTemplates = new Map((model.actionTemplates ?? []).map((t) => [t.name, t]));
    const all = flattenCatalogNodes(model.nodes);
    this.nodes = new Map(all.map((n) => [n.id, n]));
    for (const n of all) if (n.parent) (this.children.get(n.parent) ?? this.children.set(n.parent, []).get(n.parent)!).push(n);
    for (const r of model.relations) {
      (this.outgoing.get(r.source) ?? this.outgoing.set(r.source, []).get(r.source)!).push(r);
      (this.incoming.get(r.target) ?? this.incoming.set(r.target, []).get(r.target)!).push(r);
    }
  }

  parentOf(id: string): string | undefined {
    return this.nodes.get(id)?.parent;
  }

  /** ¿`id` es `ancestor` o está dentro de él? */
  contains(ancestor: string, id: string): boolean {
    return id === ancestor || id.startsWith(ancestor + INNER_SEP);
  }

  hasInner(id: string): boolean {
    return !!this.children.get(id)?.length;
  }

  /** Relaciones que salen de `id` o de sus nodos internos hacia fuera de él */
  outgoingDeep(id: string): CatalogRelation[] {
    if (!this.hasInner(id)) return this.outgoing.get(id) ?? [];
    return this.model.relations.filter((r) => this.contains(id, r.source) && !this.contains(id, r.target));
  }

  /** Relaciones que llegan a `id` o a sus nodos internos desde fuera de él */
  incomingDeep(id: string): CatalogRelation[] {
    if (!this.hasInner(id)) return this.incoming.get(id) ?? [];
    return this.model.relations.filter((r) => this.contains(id, r.target) && !this.contains(id, r.source));
  }
}

/** Ruta (relativa al diagrama actual) del detalle interno de un nodo del catálogo */
export const detailPath = (catalogId: string) => `${INLINE_SEP}${DETAIL_PREFIX}${catalogId}`;

/** ¿El diagrama usa el catálogo? (para cargarlo sólo si hace falta) */
export function usesCatalog(model: DiagramModel): boolean {
  return !!model.include?.length || includedTypes(model).length > 0 || model.nodes.some((n) => n.kind === 'ref');
}

/**
 * Aplica el catálogo a un diagrama:
 * - `node` y `diagram` pasan tal cual (con `type` efectivo);
 * - `ref` toma tipo y datos del catálogo (el diagrama puede sobrescribirlos);
 * - las reglas de cada referencia añaden relaciones del catálogo y, si
 *   `import` es true, los nodos del otro extremo que falten.
 */
export function resolveDiagram(model: DiagramModel, catalog: CatalogIndex | null): ViewModel {
  const warnings: string[] = [];
  const includeTypes = includedTypes(model);
  const nodes: ViewNode[] = model.nodes.map((n) => resolveNode(n, catalog, warnings));

  // Nodo del diagrama que representa a cada nodo del catálogo (el primero que lo referencia)
  const byCatalogId = new Map<string, ViewNode>();
  for (const v of nodes) if (v.origin.kind === 'ref' && !byCatalogId.has(v.origin.catalogId)) byCatalogId.set(v.origin.catalogId, v);

  const ids = new UniqueIds();
  const edges: ViewEdge[] = model.edges.map((e) => ({ ...e, id: ids.next(e.source, e.target) }));
  const routes: ViewRoute[] = [];
  /** Pares origen→destino que el diagrama dibuja explícitamente */
  const drawn = new Set(edges.map((e) => edgeId(e.source, e.target)));
  if (catalog) {
    const included = new Set<string>();
    const imported: ViewNode[] = [];
    /** Nodo cuyo detalle interno muestra el diagrama: sus internos se ven, él no */
    const scope = model.include?.find((r) => r.detail)?.detail;

    /**
     * Nodo del catálogo que representa a `catalogId` en esta vista: él mismo o el contenedor más
     * cercano que ya esté pintado; si no, el que queda al nivel de la vista (en una vista normal,
     * el de primer nivel; en el detalle de X, el interno de X que lo contiene, o el de fuera de X).
     * undefined: es X o uno de sus contenedores (no se pinta).
     */
    const levelOf = (catalogId: string): string | undefined => {
      for (let a: string | undefined = catalogId; a; a = catalog.parentOf(a)) if (byCatalogId.has(a)) return a;
      let a = catalogId;
      for (let p = catalog.parentOf(a); p && !(scope && catalog.contains(p, scope)); p = catalog.parentOf(a)) a = p;
      return scope && catalog.contains(a, scope) ? undefined : a;
    };

    /** Nodo que hace de extremo `catalogId`, importándolo si la regla lo pide */
    const endpoint = (catalogId: string, doImport: boolean): ViewNode | undefined => {
      const at = levelOf(catalogId);
      if (!at) return undefined;
      catalogId = at;
      const existing = byCatalogId.get(catalogId);
      if (existing || !doImport) return existing;
      const c = catalog.nodes.get(catalogId);
      if (!c) {
        warnings.push(`Relación del catálogo hacia «${catalogId}», que no existe en el catálogo`);
        return undefined;
      }
      const v: ViewNode = {
        id: importedId(catalogId),
        type: c.type,
        name: c.name,
        description: c.description,
        props: { ...(c.props ?? {}) },
        origin: { kind: 'ref', catalogId, imported: true },
      };
      byCatalogId.set(catalogId, v);
      imported.push(v);
      return v;
    };

    const catalogIdOf = (v: ViewNode) => (v.origin.kind === 'ref' ? v.origin.catalogId : undefined);
    /**
     * Añade una relación del catálogo. Si un extremo es interno de otro nodo, se pinta desde/hacia
     * el que lo representa en esta vista (`lifted`): así un contenedor tiene, sin declararlas, las
     * dependencias y las entrantes de sus internos.
     */
    const addRelation = (rel: CatalogRelation, rule: RelationRule): ViewNode[] => {
      if (included.has(rel.id)) return [];
      const src = endpoint(rel.source, !!rule.import);
      const dst = src && endpoint(rel.target, !!rule.import);
      if (!src || !dst) return [];
      included.add(rel.id);
      pushRelation(rel, src, dst, catalogIdOf(src) !== rel.source || catalogIdOf(dst) !== rel.target);
      return [src, dst];
    };

    const pushRelation = (rel: CatalogRelation, src: ViewNode, dst: ViewNode, lifted: boolean) => {
      // Entre dos internos del mismo nodo, vistos desde fuera: no se pinta
      if (src === dst) return;
      const lift = lifted ? { lifted: true } : {};
      // Por un intermedio: dos tramos (origen → intermedio → destino), nunca la flecha directa
      if (rel.through) {
        if (!catalog.nodes.has(rel.through)) {
          warnings.push(`Relación ${rel.id}: el intermedio «${rel.through}» no existe en el catálogo`);
          return;
        }
        const via = endpoint(rel.through, true);
        if (!via) return;
        if (via.origin.kind === 'ref' && via.origin.imported) via.origin = { ...via.origin, imported: false };
        const leg = (from: ViewNode, to: ViewNode, first: boolean): ViewEdge => ({
          id: ids.next(from.id, to.id),
          relationId: rel.id,
          ...lift,
          via: via.id,
          source: from.id,
          target: to.id,
          kind: rel.kind,
          uses: rel.uses,
          type: rel.type,
          label: first ? rel.label : undefined,
          description: rel.description,
          technology: first ? rel.technology : undefined,
          props: rel.props,
        });
        if (src !== via && via !== dst) {
          const inner = (v: ViewNode, cid: string) => {
            if (catalogIdOf(v) === cid) return undefined;
            return catalog.nodes.get(cid)?.name ?? cid.split('/').pop();
          };
          routes.push({
            relationId: rel.id,
            source: src.id,
            via: via.id,
            target: dst.id,
            innerSource: inner(src, rel.source),
            innerTarget: inner(dst, rel.target),
            label: rel.label,
            technology: rel.technology,
            type: rel.type,
            uses: rel.uses,
          });
        }
        if (src !== via && !drawn.has(edgeId(src.id, via.id))) edges.push(leg(src, via, true));
        if (via !== dst && !drawn.has(edgeId(via.id, dst.id))) edges.push(leg(via, dst, false));
        return;
      }
      // Si el diagrama ya dibuja una arista entre esos dos nodos, prevalece la del diagrama
      if (drawn.has(edgeId(src.id, dst.id))) return;
      edges.push({
        id: ids.next(src.id, dst.id),
        relationId: rel.id,
        ...lift,
        source: src.id,
        target: dst.id,
        kind: rel.kind,
        uses: rel.uses,
        type: rel.type,
        label: rel.label,
        description: rel.description,
        technology: rel.technology,
        props: rel.props,
      });
    };

    model.nodes.forEach((n, i) => {
      const v = nodes[i];
      if (v.origin.kind !== 'ref' || v.type === MISSING_TYPE) return;
      const preset = PRESETS[n.expand ?? 'node'];
      const outRules = [...preset.outgoing, ...(n.outgoing ?? [])];
      const inRules = [...preset.incoming, ...(n.incoming ?? [])];
      const id = v.origin.catalogId;
      // Con nodos internos, también las de sus internos (pintadas desde/hacia él)
      for (const rel of catalog.outgoingDeep(id)) {
        // Con varias reglas aplicables gana la que importa
        const rule = pick(outRules, rel);
        if (rule) addRelation(rel, rule);
      }
      for (const rel of catalog.incomingDeep(id)) {
        const rule = pick(inRules, rel);
        if (rule) addRelation(rel, rule);
      }
    });
    // include: por tipo (todos los nodos de ese tipo) o por ref (un nodo y las relaciones que
    // encajen con sus patrones). Lo que incluye forma parte de la vista: se pinta como propio.
    const rules: { rule: IncludeRule; index: number }[] = [
      ...(model.include ?? []).map((rule, index) => ({ rule, index })),
      ...(model.types ?? []).map((type) => ({ rule: { type }, index: -1 })),
    ];
    const own = (v: ViewNode | undefined) => {
      if (v?.origin.kind === 'ref' && v.origin.imported) v.origin = { ...v.origin, imported: false };
      return v;
    };
    // Con plantilla, cada nodo incluido abre su propio subdiagrama: `::@<regla>:<id del catálogo>`
    const withTemplate = (v: ViewNode | undefined, rule: IncludeRule, index: number) => {
      if (v && rule.diagram && index >= 0 && !v.subdiagram && v.origin.kind === 'ref') {
        v.subdiagram = `${INLINE_SEP}@${index}:${v.origin.catalogId}`;
      }
    };
    /**
     * Detalle interno de `id`: sus nodos internos y solo las relaciones en las que participa alguno
     * de ellos (entre sí, hacia fuera o desde fuera; las de fuera se pintan desde el nodo de fuera
     * o su contenedor). Las relaciones del propio `id` no entran: no dicen a qué interno van.
     */
    const addDetail = (id: string) => {
      const inner = catalog.children.get(id) ?? [];
      if (!catalog.nodes.has(id)) return void warnings.push(`detail: «${id}» no existe en el catálogo`);
      if (!inner.length) return void warnings.push(`detail: «${id}» no tiene nodos internos ("nodes")`);
      for (const c of inner) own(endpoint(c.id, true));
      const inside = (cid: string) => cid !== id && catalog.contains(id, cid);
      for (const rel of catalog.model.relations) if (inside(rel.source) || inside(rel.target)) addRelation(rel, { import: true });
    };

    // El tipo que cuenta es el del nodo que se pinta (el contenedor, si el extremo es interno)
    const shownType = (cid: string) => catalog.nodes.get(levelOf(cid) ?? cid)?.type;
    /** Relaciones de `id` que encajan con los patrones `dependencies`/`uses`/`incoming` de la regla */
    const follow = (id: string, rule: IncludeRule) => {
      if (!rule.dependencies && !rule.uses && !rule.incoming) return;
      for (const rel of catalog.outgoingDeep(id)) {
        const type = shownType(rel.target);
        if (!type || !matchesRelationPattern(rel.uses ? rule.uses : rule.dependencies, rel.type, type)) continue;
        own(addRelation(rel, { import: true }).at(-1) ?? endpoint(rel.target, false));
      }
      // Entrantes: quién depende de este nodo o lo usa
      for (const rel of catalog.incomingDeep(id)) {
        const type = shownType(rel.source);
        if (!type || !matchesRelationPattern(rule.incoming, rel.type, type)) continue;
        own(addRelation(rel, { import: true })[0] ?? endpoint(rel.source, false));
      }
    };

    for (const { rule, index } of rules) {
      if (rule.type) {
        // Cada nodo del tipo, como si la regla lo incluyera por `ref` (con sus patrones)
        for (const c of catalog.model.nodes) {
          if (c.type !== rule.type) continue;
          withTemplate(own(endpoint(c.id, true)), rule, index);
          follow(c.id, rule);
        }
      }
      if (rule.ref) {
        if (!catalog.nodes.has(rule.ref)) {
          warnings.push(`include: «${rule.ref}» no existe en el catálogo`);
          continue;
        }
        withTemplate(own(endpoint(rule.ref, true)), rule, index);
        follow(rule.ref, rule);
      }
      if (rule.detail) addDetail(rule.detail);
    }
    // Vistas por tipo: también todas las relaciones del catálogo entre los nodos pintados
    if (rules.some(({ rule }) => rule.type)) for (const rel of catalog.model.relations) addRelation(rel, { import: false });
    nodes.push(...imported);
  }

  if ((includeTypes.length || model.include?.length) && !catalog) warnings.push('"include" necesita el catálogo de la carpeta para saber qué nodos pintar');

  // Relaciones elevadas (de nodos internos) que repiten otra entre los mismos nodos: se queda la
  // otra; entre elevadas iguales (mismo par, tipo y bloque), sólo la primera
  {
    const pair = (e: ViewEdge) => `${edgeId(e.source, e.target)}|${e.uses ? 'u' : 'd'}`;
    const direct = new Set(edges.filter((e) => !e.lifted).map(pair));
    const seen = new Set<string>();
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (!e.lifted) continue;
      const key = `${pair(e)}|${e.type ?? ''}`;
      if (direct.has(pair(e)) || seen.has(key)) edges.splice(i--, 1);
      else seen.add(key);
    }
  }
  // Tramos por un intermedio que repiten otra arista entre los mismos nodos: se queda la otra
  // (p. ej. la ruta gateway → bff ya existe); entre tramos iguales, sólo el primero
  {
    const pair = (e: ViewEdge) => edgeId(e.source, e.target);
    const direct = new Set(edges.filter((e) => !e.via).map(pair));
    const seen = new Set<string>();
    for (let i = edges.length - 1; i >= 0; i--) if (edges[i].via && direct.has(pair(edges[i]))) edges.splice(i, 1);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (!e.via) continue;
      if (seen.has(pair(e))) edges.splice(i--, 1);
      else seen.add(pair(e));
    }
  }
  // Ids definitivos (sin huecos por los tramos descartados): from:origen-to:destino[#n]
  {
    const finalIds = new UniqueIds();
    for (const e of edges) e.id = finalIds.next(e.source, e.target);
  }

  // Tipos incluidos: filtra los nodos importados (los declarados se pintan siempre) y sus aristas
  let keep = nodes;
  let keepEdges = edges;
  let keepRoutes = routes;
  if (includeTypes.length) {
    const types = new Set(includeTypes);
    keep = nodes.filter((n) => !(n.origin.kind === 'ref' && n.origin.imported) || types.has(n.type));
    const ids = new Set(keep.map((n) => n.id));
    keepEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    keepRoutes = routes.filter((r) => ids.has(r.source) && ids.has(r.via) && ids.has(r.target));
  }

  // Sin título: el nombre del nodo de la primera regla `ref` (p. ej. una plantilla instanciada)
  const refRule = model.include?.find((r) => r.ref || r.detail);
  const refId = refRule?.ref ?? refRule?.detail;
  const title = model.title ?? (refId ? (catalog?.nodes.get(refId)?.name ?? refId) : undefined);

  // Nodos del catálogo con nodos internos: su ficha ofrece ver el detalle
  if (catalog) for (const v of keep) if (v.origin.kind === 'ref' && catalog.hasInner(v.origin.catalogId)) v.detail = detailPath(v.origin.catalogId);

  return {
    title,
    description: model.description,
    direction: model.direction ?? 'LR',
    layout: model.layout,
    nodes: keep,
    edges: keepEdges,
    routes: keepRoutes,
    groups: resolveGroups(model.groups ?? [], keep),
    warnings,
  };
}

/** Reparte los nodos en grupos por tipo (un nodo va al primer grupo que lo acepte). Los grupos vacíos no se pintan. */
function resolveGroups(groups: DiagramGroup[], nodes: ViewNode[]): ViewGroup[] {
  const taken = new Set<string>();
  return groups.flatMap((g, i) => {
    const types = new Set(g.types);
    const nodeIds = nodes.filter((n) => !taken.has(n.id) && types.has(n.type)).map((n) => n.id);
    nodeIds.forEach((id) => taken.add(id));
    return nodeIds.length ? [{ id: `group:${i}`, name: g.name, color: g.color, description: g.description, layout: g.layout, explicit: g.explicit, nodeIds }] : [];
  });
}

function pick(rules: RelationRule[], rel: CatalogRelation): RelationRule | undefined {
  const applicable = rules.filter((r) => matches(r, rel));
  return applicable.find((r) => r.import) ?? applicable[0];
}

function resolveNode(n: DiagramNode, catalog: CatalogIndex | null, warnings: string[]): ViewNode {
  const base = {
    id: n.id,
    name: n.name,
    description: n.description,
    position: n.position,
    errors: n.errors,
    warns: n.warns,
    width: n.width,
    height: n.height,
  };
  // Compatibilidad: el antiguo `kind: "subdiagram"` con props.file
  if (n.kind === 'diagram' || n.kind === 'subdiagram') {
    // Definido aquí mismo: se abre como `<este diagrama>::<id del nodo>`
    const file = n.diagram ? `${INLINE_SEP}${n.id}` : (n.file ?? n.props?.file);
    return {
      ...base,
      type: SUBDIAGRAM_TYPE,
      props: { ...(n.props ?? {}), file },
      errors: file ? n.errors : [...(n.errors ?? []), 'Falta "file" (ruta del diagrama) o "diagram" (su definición)'],
      origin: { kind: 'diagram' },
    };
  }
  if (n.kind === 'ref') {
    const c = n.ref ? catalog?.nodes.get(n.ref) : undefined;
    if (!c) {
      const reason = !n.ref
        ? 'Falta "ref" con el id del nodo del catálogo'
        : catalog
          ? `«${n.ref}» no existe en el catálogo`
          : 'No se ha podido cargar el catálogo';
      warnings.push(`Nodo ${n.id}: ${reason}`);
      return {
        ...base,
        type: n.type ?? MISSING_TYPE,
        name: n.name ?? n.ref ?? n.id,
        props: n.props ?? {},
        errors: [...(n.errors ?? []), reason],
        origin: { kind: 'ref', catalogId: n.ref ?? n.id, imported: false },
      };
    }
    return {
      ...base,
      type: n.type ?? c.type,
      name: n.name ?? c.name,
      description: n.description ?? c.description,
      props: { ...(c.props ?? {}), ...(n.props ?? {}) },
      origin: { kind: 'ref', catalogId: c.id, imported: false },
    };
  }
  // kind=node, o formato antiguo donde kind era el tipo
  const type = n.kind === 'node' ? n.type : n.kind;
  return {
    ...base,
    type: type ?? MISSING_TYPE,
    props: n.props ?? {},
    errors: type ? n.errors : [...(n.errors ?? []), 'Falta "type"'],
    origin: { kind: 'node' },
  };
}
