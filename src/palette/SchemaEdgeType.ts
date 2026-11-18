import type { DiagramEdgeType, DiagramEdgeTypeCtx, EdgeStyle } from './DiagramEdgeType';
import type { ElementDetail } from './DiagramElementType';
import { schemaFields, type Definition } from './schema';

/**
 * Base para tipos de arista que aplican entre ciertos kinds de origen y destino
 * y describen sus props con un JSON Schema.
 */
export abstract class SchemaEdgeType implements DiagramEdgeType {
  abstract title: string;
  /** Tipos de nodo de origen admitidos (vacío = cualquiera) */
  protected sources: string[] = [];
  /** Tipos de nodo de destino admitidos (vacío = cualquiera) */
  protected targets: string[] = [];
  /** Tipos de relación admitidos (vacío = cualquiera) */
  protected relationTypes: string[] = [];
  /** Etiqueta corta por defecto */
  protected shortLabel?: string;
  protected edgeStyle: EdgeStyle = {};

  precedence(ctx: DiagramEdgeTypeCtx): number {
    const okSource = !this.sources.length || this.sources.includes(ctx.source.type);
    const okTarget = !this.targets.length || this.targets.includes(ctx.target.type);
    const okRelation = !this.relationTypes.length || (!!ctx.edge.type && this.relationTypes.includes(ctx.edge.type));
    return okSource && okTarget && okRelation ? 1 : 0;
  }

  label(_ctx: DiagramEdgeTypeCtx) {
    return this.shortLabel;
  }

  style(_ctx: DiagramEdgeTypeCtx): EdgeStyle {
    return this.edgeStyle;
  }

  definition(): Definition {
    return { schema: {} };
  }

  detail(props: Record<string, any> | undefined, ctx: DiagramEdgeTypeCtx): ElementDetail | null {
    return {
      description: ctx.edge.description ?? props?.description,
      fields: schemaFields(this.definition().schema, props),
    };
  }
}
