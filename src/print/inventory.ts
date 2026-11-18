import type { ViewModel, ViewNode } from '../diagram';
import { findEdgeType, findNodeType, type PaletteInterface } from '../palette';

/** Ficha de un nodo para el inventario impreso (sólo texto). */
export type InventoryEntry = {
  id: string;
  title: string;
  typeTitle: string;
  description?: string;
  fields: { label: string; value: string }[];
  outgoing: string[];
  incoming: string[];
  errors: string[];
  warns: string[];
};

/** Markdown → texto plano (lo justo para el PDF: sin marcas, enlaces como su texto). */
export function plainText(md: string | undefined): string | undefined {
  if (!md) return undefined;
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ''))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '· ')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${formatValue(x)}`).join('; ');
  return String(v);
}

/**
 * Una ficha por cada nodo pintado (sin notas), en el orden del diagrama:
 * nombre, tipo, descripción, propiedades (las mismas que la ficha del visor)
 * y aristas de este diagrama, salientes y entrantes.
 */
export function buildInventory(view: ViewModel, palette: PaletteInterface): InventoryEntry[] {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const name = (n: ViewNode) => findNodeType(n.type, palette).label({ name: n.name, props: n.props });

  const edgeText = (otherId: string, e: (typeof view.edges)[number]) => {
    const other = byId.get(otherId);
    const ctx = { edge: e, source: byId.get(e.source)!, target: byId.get(e.target)! };
    const label = e.label ?? e.technology ?? findEdgeType(ctx, palette)?.label?.(ctx);
    const extras = [label, e.type && `tipo ${e.type}`, e.uses && 'uso'].filter(Boolean).join(', ');
    return `${other ? name(other) : otherId}${extras ? ` (${extras})` : ''}`;
  };

  return view.nodes
    .filter((n) => !(findNodeType(n.type, palette).isBackground?.() ?? false))
    .map((n) => {
      const type = findNodeType(n.type, palette);
      const detail = type.detail?.(n.props, n) ?? { fields: [] };
      return {
        // Para el lector, el id del catálogo (sin el prefijo interno de los nodos importados)
        id: n.origin.kind === 'ref' ? n.origin.catalogId : n.id,
        title: name(n),
        typeTitle: type.title,
        description: plainText(detail.description),
        fields: detail.fields.map((f) => ({ label: f.label, value: formatValue(f.value) })),
        outgoing: view.edges.filter((e) => e.source === n.id).map((e) => edgeText(e.target, e)),
        incoming: view.edges.filter((e) => e.target === n.id).map((e) => edgeText(e.source, e)),
        errors: n.errors ?? [],
        warns: n.warns ?? [],
      };
    });
}
