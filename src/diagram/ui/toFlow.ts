import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { findEdgeType, findNodeType, type PaletteInterface } from '../../palette';
import type { DiagramEdgeType, DiagramEdgeTypeCtx } from '../../palette/DiagramEdgeType';
import type { DiagramElementType } from '../../palette/DiagramElementType';
import { autoLayout, placeBeside, type LayoutBox } from '../layout';
import type { ViewEdge, ViewGroup, ViewModel, ViewNode } from '../resolve';

export type HandleId = 'in' | 'out' | 'parent' | 'children';

export type FlowNodeData = {
  node: ViewNode;
  type: DiagramElementType;
  label: string;
  /** Tamaño de la forma (sin etiqueta) */
  size: { width: number; height: number };
  /** Handles con alguna arista conectada (el resto no se pinta) */
  handles: HandleId[];
  clickable: boolean;
  /** Dirección del diagrama: decide en qué lado va cada handle */
  direction: 'LR' | 'TB';
};
export type GenericFlowNode = Node<FlowNodeData, 'generic'>;
/** Caja de grupo: nodo padre de React Flow que envuelve a sus miembros */
export type GroupFlowNode = Node<{ group: ViewGroup }, 'dvgroup'>;
export type FlowNode = GenericFlowNode | GroupFlowNode;

export type FlowEdgeData = { edge: ViewEdge; edgeType?: DiagramEdgeType; ctx: DiagramEdgeTypeCtx; clickable: boolean };
export type FlowEdge = Edge<FlowEdgeData>;

const DEFAULT_SIZE = { width: 96, height: 96 };
/** Espacio reservado bajo la forma para la etiqueta (sólo afecta al autolayout) */
const LABEL_W = 140;
const LABEL_H = 44;
/** Margen de las cajas de grupo alrededor de sus nodos (arriba deja sitio al título) */
const GROUP_PAD = 20;
const GROUP_TOP = 40;

/** Los usos (y las aristas padre→hijo) salen por abajo y entran por arriba */
const isVertical = (e: ViewEdge) => e.uses || e.kind === 'parentChild';
function sourceHandle(e: ViewEdge): HandleId {
  if (e.sourceHandle === 'out' || e.sourceHandle === 'children') return e.sourceHandle;
  return isVertical(e) ? 'children' : 'out';
}
function targetHandle(e: ViewEdge): HandleId {
  if (e.targetHandle === 'in' || e.targetHandle === 'parent') return e.targetHandle;
  return isVertical(e) ? 'parent' : 'in';
}

/** Color de los usos: destacan sobre las dependencias */
const USES_COLOR = '#6366f1';

/** Traduce el diagrama resuelto a nodos y aristas de React Flow, calculando posiciones si faltan. */
export function toFlow(model: ViewModel, palette: PaletteInterface): { nodes: FlowNode[]; edges: FlowEdge[]; warnings: string[] } {
  const warnings: string[] = [...model.warnings];
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const validEdges = model.edges.filter((e) => {
    const ok = byId.has(e.source) && byId.has(e.target);
    if (!ok) warnings.push(`Arista ${e.id} (${e.source} → ${e.target}) apunta a un nodo inexistente`);
    return ok;
  });

  const handles = new Map<string, Set<HandleId>>();
  const use = (id: string, h: HandleId) => (handles.get(id) ?? handles.set(id, new Set()).get(id)!).add(h);
  for (const e of validEdges) {
    use(e.source, sourceHandle(e));
    use(e.target, targetHandle(e));
  }

  const groupOf = new Map(model.groups.flatMap((g) => g.nodeIds.map((id) => [id, g.id] as const)));
  const boxes = new Map<string, LayoutBox>();
  const data = model.nodes.map((node) => {
    const type = findNodeType(node.type, palette);
    const props = node.props;
    const base = type.nodeSize?.({ props }) ?? DEFAULT_SIZE;
    const size = { width: node.width ?? base.width, height: node.height ?? base.height };
    const background = type.isBackground?.() ?? false;
    boxes.set(node.id, {
      id: node.id,
      w: background ? size.width : Math.max(size.width, LABEL_W),
      h: background ? size.height : size.height + LABEL_H,
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
      group: groupOf.get(node.id),
    });
    const flowData: FlowNodeData = {
      node,
      type,
      label: type.label({ name: node.name, props }),
      size,
      handles: [...(handles.get(node.id) ?? [])],
      // Todo nodo abre su ficha (o navega); sólo las notas, que ya muestran su contenido, no reaccionan
      clickable: !!type.open || !(type.isBackground?.() ?? false),
      direction: model.direction,
    };
    return flowData;
  });

  const free = model.nodes.filter((n) => !n.position).map((n) => boxes.get(n.id)!);
  if (free.length) {
    const hasLabels = validEdges.some((e) => e.label);
    const layoutEdges = validEdges.map((e) => ({ source: e.source, target: e.target, nested: sourceHandle(e) === 'children' }));
    autoLayout(free, layoutEdges, {
      direction: model.direction,
      rankGap: hasLabels ? 150 : undefined,
      boxGroups: new Set(model.groups.filter((g) => g.layout === 'box').map((g) => g.id)),
    });
    placeBeside(model.nodes.filter((n) => n.position).map((n) => boxes.get(n.id)!), free);
  }

  const generic: GenericFlowNode[] = data.map((d) => {
    const b = boxes.get(d.node.id)!;
    const background = d.type.isBackground?.() ?? false;
    // La caja de layout incluye la etiqueta: se centra la forma dentro de ella.
    const x = background ? b.x : b.x + (b.w - Math.max(d.size.width, LABEL_W)) / 2;
    return {
      id: d.node.id,
      type: 'generic',
      position: { x, y: b.y },
      data: d,
      zIndex: background ? -1 : 0,
      connectable: false,
    };
  });

  // Cajas de grupo: una por cada tramo seguido de miembros dentro de una misma capa, porque las
  // flechas pueden haber repartido el grupo entre varias columnas. Los miembros pasan a ser
  // hijos de su caja (posición relativa a ella).
  const segmentOf = new Map<string, string>();
  const groupNodes: GroupFlowNode[] = model.groups.flatMap((g) => {
    const segments = new Map<string, string[]>();
    const sorted = [...g.nodeIds].sort((a, b) => (boxes.get(a)!.layer ?? -1) - (boxes.get(b)!.layer ?? -1) || (boxes.get(a)!.slot ?? 0) - (boxes.get(b)!.slot ?? 0));
    let prev: LayoutBox | undefined;
    let n = 0;
    for (const id of sorted) {
      const b = boxes.get(id)!;
      // Nuevo tramo si cambia de capa o si hay otro nodo en medio
      if (prev && (prev.layer !== b.layer || (b.slot ?? 0) !== (prev.slot ?? 0) + 1)) n++;
      const key = `${g.id}:${n}`;
      (segments.get(key) ?? segments.set(key, []).get(key)!).push(id);
      segmentOf.set(id, key);
      prev = b;
    }
    // Una caja con un solo nodo no aporta nada: sólo se pinta si el grupo es `explicit`
    return [...segments].filter(([, ids]) => ids.length > 1 || g.explicit).map(([key, ids]) => {
      const bs = ids.map((id) => boxes.get(id)!);
      const x1 = Math.min(...bs.map((b) => b.x)) - GROUP_PAD;
      const y1 = Math.min(...bs.map((b) => b.y)) - GROUP_TOP;
      const x2 = Math.max(...bs.map((b) => b.x + b.w)) + GROUP_PAD;
      const y2 = Math.max(...bs.map((b) => b.y + b.h)) + GROUP_PAD;
      const node: GroupFlowNode = {
        id: key,
        type: 'dvgroup',
        position: { x: x1, y: y1 },
        style: { width: x2 - x1, height: y2 - y1 },
        data: { group: { ...g, nodeIds: ids } },
        zIndex: -2,
        connectable: false,
        selectable: false,
      };
      return node;
    });
  });
  const groupById = new Map(groupNodes.map((g) => [g.id, g]));
  for (const n of generic) {
    const g = groupById.get(segmentOf.get(n.id) ?? '');
    if (!g) continue;
    n.parentId = g.id;
    n.expandParent = true;
    n.position = { x: n.position.x - g.position.x, y: n.position.y - g.position.y };
  }
  // React Flow exige que los padres vayan antes que sus hijos
  const nodes: FlowNode[] = [...groupNodes, ...generic];

  const edges: FlowEdge[] = validEdges.map((edge) => {
    const ctx: DiagramEdgeTypeCtx = { edge, source: byId.get(edge.source)!, target: byId.get(edge.target)! };
    const edgeType = findEdgeType(ctx, palette);
    const style = edgeType?.style?.(ctx) ?? {};
    const color = (edge.props?.color as string | undefined) ?? style.color ?? (edge.uses ? USES_COLOR : undefined);
    // Toda arista abre su ficha, aunque sólo tenga título
    const clickable = true;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceHandle(edge),
      targetHandle: targetHandle(edge),
      label: edge.label ?? edge.technology ?? edgeType?.label?.(ctx),
      animated: (edge.props?.animated as boolean | undefined) ?? style.animated ?? false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, ...(color ? { color } : {}) },
      style: {
        ...(color ? { stroke: color } : {}),
        ...(edge.uses ? { strokeWidth: 2.5 } : {}),
        ...(style.dashed || edge.props?.dashed ? { strokeDasharray: '6 4' } : {}),
      },
      className: ['dv-edge', clickable && 'is-clickable', edge.uses && 'is-uses'].filter(Boolean).join(' '),
      data: { edge, edgeType, ctx, clickable },
    };
  });

  return { nodes, edges, warnings };
}

/** Clave de los tramos de una misma relación que pasa por un intermedio */
const legKey = (e: ViewEdge) => (e.via && e.relationId ? `${e.relationId}@${e.via}` : undefined);

export type EdgeHighlight = {
  /** Aristas del nodo (o la arista elegida) y los demás tramos de sus relaciones `through` */
  direct: Set<string>;
  /** Alcanzables siguiendo las flechas hacia delante (salida) o hacia atrás (entrada) */
  transitive: Set<string>;
};

/**
 * Aristas a resaltar con la selección. Las directas son las que entran y salen del nodo (o la
 * arista elegida) más el resto de tramos de las relaciones `through` en las que participan. Las
 * transitivas son las que se alcanzan siguiendo las flechas en ambos sentidos. Al llegar a un
 * intermedio por un tramo, sólo se continúa por los tramos de esa misma relación: lo que pasa
 * por un gateway no hereda las demás relaciones del gateway.
 */
export function relatedEdges(edges: FlowEdge[], sel: { nodeId?: string; edgeId?: string }): EdgeHighlight {
  const key = (e: FlowEdge) => (e.data ? legKey(e.data.edge) : undefined);
  const via = (e: FlowEdge) => e.data?.edge.via;

  const first = edges.filter((e) => (sel.nodeId ? e.source === sel.nodeId || e.target === sel.nodeId : e.id === sel.edgeId));
  const legs = new Set(first.map(key).filter(Boolean));
  const direct = new Set(first.map((e) => e.id));
  for (const e of edges) if (legs.has(key(e))) direct.add(e.id);

  const reached = new Set<string>();
  type Step = { node: string; leg?: string };
  const walk = (start: Step[], forward: boolean) => {
    const seen = new Set<string>();
    const queue = [...start];
    while (queue.length) {
      const { node, leg } = queue.shift()!;
      const mark = `${node}|${leg ?? ''}`;
      if (seen.has(mark)) continue;
      seen.add(mark);
      for (const e of edges) {
        if ((forward ? e.source : e.target) !== node) continue;
        // Dentro de una relación `through`, sólo sus propios tramos
        if (leg && key(e) !== leg) continue;
        reached.add(e.id);
        const next = forward ? e.target : e.source;
        queue.push({ node: next, leg: key(e) && next === via(e) ? key(e) : undefined });
      }
    }
  };
  const stepFrom = (e: FlowEdge, node: string): Step => ({ node, leg: key(e) && node === via(e) ? key(e) : undefined });
  if (sel.nodeId) {
    walk([{ node: sel.nodeId }], true);
    walk([{ node: sel.nodeId }], false);
  } else {
    walk(first.map((e) => stepFrom(e, e.target)), true);
    walk(first.map((e) => stepFrom(e, e.source)), false);
  }
  const transitive = new Set([...reached].filter((id) => !direct.has(id)));
  return { direct, transitive };
}
