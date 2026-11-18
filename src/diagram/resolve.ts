import { edgeId, includedTypes, INLINE_SEP, matchesRelationPattern, UniqueIds } from './model';
import type {
  CatalogModel,
  CatalogNode,
  CatalogRelation,
  DiagramGroup,
  IncludeRule,
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
};

export type ViewEdge = DiagramEdge & {
  /** Tramo de una relación que pasa por un nodo intermedio (`through`) */
  via?: string;
  /** Calculado: from:{origen}-to:{destino} (con #n si el par se repite) */
  id: string;
  /** Relación del catálogo de la que procede, si no está en el diagrama */
  relationId?: string;
};

export type ViewModel = {
  title?: string;
  description?: string;
  direction: 'LR' | 'TB';
  nodes: ViewNode[];
  edges: ViewEdge[];
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
  readonly nodes: Map<string, CatalogNode>;
  readonly outgoing = new Map<string, CatalogRelation[]>();
  readonly incoming = new Map<string, CatalogRelation[]>();

  constructor(readonly model: CatalogModel) {
    this.nodes = new Map(model.nodes.map((n) => [n.id, n]));
    for (const r of model.relations) {
      (this.outgoing.get(r.source) ?? this.outgoing.set(r.source, []).get(r.source)!).push(r);
      (this.incoming.get(r.target) ?? this.incoming.set(r.target, []).get(r.target)!).push(r);
    }
  }
}

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
  /** Pares origen→destino que el diagrama dibuja explícitamente */
  const drawn = new Set(edges.map((e) => edgeId(e.source, e.target)));
  if (catalog) {
    const included = new Set<string>();
    const imported: ViewNode[] = [];

    /** Nodo que hace de extremo `catalogId`, importándolo si la regla lo pide */
    const endpoint = (catalogId: string, doImport: boolean): ViewNode | undefined => {
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

    const addRelation = (rel: CatalogRelation, rule: RelationRule) => {
      if (included.has(rel.id)) return;
      const src = endpoint(rel.source, !!rule.import);
      const dst = endpoint(rel.target, !!rule.import);
      if (!src || !dst) return;
      included.add(rel.id);
      // Por un intermedio: dos tramos (origen → intermedio → destino), nunca la flecha directa
      if (rel.through) {
        if (!catalog.nodes.has(rel.through)) {
          warnings.push(`Relación ${rel.id}: el intermedio «${rel.through}» no existe en el catálogo`);
          return;
        }
        const via = endpoint(rel.through, true)!;
        if (via.origin.kind === 'ref' && via.origin.imported) via.origin = { ...via.origin, imported: false };
        const leg = (from: ViewNode, to: ViewNode, first: boolean): ViewEdge => ({
          id: ids.next(from.id, to.id),
          relationId: rel.id,
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
        if (!drawn.has(edgeId(src.id, via.id))) edges.push(leg(src, via, true));
        if (!drawn.has(edgeId(via.id, dst.id))) edges.push(leg(via, dst, false));
        return;
      }
      // Si el diagrama ya dibuja una arista entre esos dos nodos, prevalece la del diagrama
      if (drawn.has(edgeId(src.id, dst.id))) return;
      edges.push({
        id: ids.next(src.id, dst.id),
        relationId: rel.id,
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
      for (const rel of catalog.outgoing.get(id) ?? []) {
        // Con varias reglas aplicables gana la que importa
        const rule = pick(outRules, rel);
        if (rule) addRelation(rel, rule);
      }
      for (const rel of catalog.incoming.get(id) ?? []) {
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
    for (const { rule, index } of rules) {
      if (rule.type) {
        for (const c of catalog.model.nodes) if (c.type === rule.type) withTemplate(own(endpoint(c.id, true)), rule, index);
      }
      if (rule.ref) {
        if (!catalog.nodes.has(rule.ref)) {
          warnings.push(`include: «${rule.ref}» no existe en el catálogo`);
          continue;
        }
        withTemplate(own(endpoint(rule.ref, true)), rule, index);
        for (const rel of catalog.outgoing.get(rule.ref) ?? []) {
          const target = catalog.nodes.get(rel.target);
          if (!target || !matchesRelationPattern(rel.uses ? rule.uses : rule.dependencies, rel.type, target.type)) continue;
          addRelation(rel, { import: true });
          own(byCatalogId.get(rel.target));
        }
        // Entrantes: quién depende de este nodo o lo usa
        for (const rel of catalog.incoming.get(rule.ref) ?? []) {
          const source = catalog.nodes.get(rel.source);
          if (!source || !matchesRelationPattern(rule.incoming, rel.type, source.type)) continue;
          addRelation(rel, { import: true });
          own(byCatalogId.get(rel.source));
        }
      }
    }
    // Vistas por tipo: también todas las relaciones del catálogo entre los nodos pintados
    if (rules.some(({ rule }) => rule.type)) for (const rel of catalog.model.relations) addRelation(rel, { import: false });
    nodes.push(...imported);
  }

  if ((includeTypes.length || model.include?.length) && !catalog) warnings.push('"include" necesita el catálogo de la carpeta para saber qué nodos pintar');

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
  if (includeTypes.length) {
    const types = new Set(includeTypes);
    keep = nodes.filter((n) => !(n.origin.kind === 'ref' && n.origin.imported) || types.has(n.type));
    const ids = new Set(keep.map((n) => n.id));
    keepEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }

  // Sin título: el nombre del nodo de la primera regla `ref` (p. ej. una plantilla instanciada)
  const refRule = model.include?.find((r) => r.ref);
  const title = model.title ?? (refRule?.ref ? (catalog?.nodes.get(refRule.ref)?.name ?? refRule.ref) : undefined);

  return {
    title,
    description: model.description,
    direction: model.direction ?? 'LR',
    nodes: keep,
    edges: keepEdges,
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
