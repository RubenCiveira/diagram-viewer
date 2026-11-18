import type { ReactNode } from 'react';
import type { ElementType, ViewEdge, ViewNode } from '../diagram';

export type NodeCategory = 'actor' | 'component' | 'note';

/** Una fila de la ficha de un elemento */
export type DetailField = { label: string; value: unknown };

/** Contenido de la ficha que se abre al pulsar un elemento */
export type ElementDetail = {
  /** Texto en Markdown que encabeza la ficha */
  description?: string;
  fields: DetailField[];
};

/** Elemento cuya ficha se muestra en el panel lateral */
export type DetailTarget = { type: 'node'; node: ViewNode } | { type: 'edge'; edge: ViewEdge };

/**
 * Lo que un tipo de elemento puede hacer sobre el visor. En el editor de
 * referencia `open` recibía un RealtimeDiagram para editar; aquí navega o
 * muestra información.
 */
export interface DiagramViewerContext {
  /** Ruta (relativa a la raíz) del diagrama abierto */
  currentPath: string;
  /** Abre otro diagrama; `path` es relativo al diagrama actual */
  openDiagram(path: string, title?: string): void;
  /** Muestra la ficha de un elemento */
  showDetail(target: DetailTarget): void;
}

export interface DiagramElementType<P = any> {
  /** Identificador del tipo: es el `type` de los nodos */
  kind: ElementType;
  /** Título visible (tipo del elemento en la ficha) */
  title: string;

  /** Icono pequeño (cabecera de la ficha, leyenda) */
  paletteIcon?: ReactNode;
  /** Icono para el interior del nodo */
  nodeIcon?(props: P): ReactNode;

  /**
   * Acción al pulsar el nodo. Si no se define, se abre la ficha (si `detail` devuelve algo).
   */
  open?(props: P, node: ViewNode, viewer: DiagramViewerContext): Promise<void> | void;

  /** Etiqueta visible del nodo */
  label(input: { name?: string; props: P }): string;

  /** Categoría para agrupaciones */
  category(): NodeCategory;

  /** Tamaño de la forma (sin la etiqueta inferior) si no hay width/height persistido */
  nodeSize?(input: { props: P }): { width: number; height: number };

  /** Nodo de fondo (p. ej. una nota): se dibuja detrás y no lleva etiqueta inferior */
  isBackground?(): boolean;

  /** Forma del nodo. Si no se define, se usa un recuadro genérico. */
  renderShape?(props: P, content: ReactNode): ReactNode;

  /** Datos de la ficha. `null` = el elemento no tiene ficha. */
  detail?(props: P, node: ViewNode): ElementDetail | null;
}

export interface DiagramNodeInstance {
  node: ViewNode;
  type: DiagramElementType;
}
