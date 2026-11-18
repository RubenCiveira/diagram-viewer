import type { ViewEdge, ViewNode } from '../diagram';
import type { ElementDetail } from './DiagramElementType';

export interface DiagramEdgeTypeCtx {
  edge: ViewEdge;
  source: ViewNode;
  target: ViewNode;
}

export type EdgeStyle = { color?: string; animated?: boolean; dashed?: boolean };

export interface DiagramEdgeType<T = any> {
  /** Nombre del tipo de conexión (cabecera de la ficha) */
  title: string;

  /** Afinidad con la conexión: gana el tipo con mayor valor; 0 = no aplica */
  precedence(ctx: DiagramEdgeTypeCtx): number;

  /** Etiqueta por defecto si la arista no trae `label` */
  label?(ctx: DiagramEdgeTypeCtx): string | undefined;

  style?(ctx: DiagramEdgeTypeCtx): EdgeStyle;

  /** Datos de la ficha. `null` = la arista no tiene ficha. */
  detail?(props: T, ctx: DiagramEdgeTypeCtx): ElementDetail | null;
}
