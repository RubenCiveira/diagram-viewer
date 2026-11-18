import type { DiagramEdgeType, DiagramEdgeTypeCtx } from './DiagramEdgeType';
import type { DiagramElementType } from './DiagramElementType';
import { UnknownElement } from './providers/generic/nodes/unknown';

export * from './DiagramElementType';
export * from './DiagramEdgeType';

export interface PaletteInterface {
  nodes: DiagramElementType[];
  edges?: DiagramEdgeType[];
  note?: DiagramElementType;
}

const unknownTypes = new Map<string, DiagramElementType>();

/** Tipo de un nodo según su kind. Nunca devuelve undefined: los kinds desconocidos se pintan con un tipo genérico. */
export function findNodeType(kind: string, palette: PaletteInterface | undefined | null): DiagramElementType {
  if (palette?.note && palette.note.kind === kind) return palette.note;
  const found = palette?.nodes.find((t) => t.kind === kind);
  if (found) return found;
  let unknown = unknownTypes.get(kind);
  if (!unknown) unknownTypes.set(kind, (unknown = new UnknownElement(kind)));
  return unknown;
}

/** Tipo de arista con mayor precedencia para la conexión, o undefined si ninguno aplica. */
export function findEdgeType(ctx: DiagramEdgeTypeCtx, palette: PaletteInterface | undefined | null) {
  let best: DiagramEdgeType | undefined;
  let bestScore = 0;
  for (const t of palette?.edges ?? []) {
    const score = t.precedence(ctx);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}
