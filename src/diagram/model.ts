import { z } from 'zod';

/* ============================================================================
 * Formato de los ficheros de diagrama
 * ==========================================================================*/

/** Tipo de elemento de la paleta (microservice, database…) */
export type ElementType = string;

/**
 * Clase de nodo en un diagrama:
 * - `node`: definido en el propio diagrama (`type`, `name`, `props`…)
 * - `ref`: referencia a un nodo del catálogo (`ref`), que aporta tipo y datos
 * - `diagram`: enlace a otro diagrama (`file`)
 */
export type NodeKind = 'node' | 'ref' | 'diagram';

/** Punto en el lienzo */
export type Position = { x: number; y: number };

/** Atajos de expansión de una referencia */
export type ExpandMode = 'node' | 'config' | 'all';

/** Qué relaciones del catálogo incluir al pintar una referencia */
export type RelationRule = {
  /** Tipo(s) de relación; si falta, cualquiera */
  type?: string | string[];
  /** true: se importa el nodo del otro extremo; false: sólo se pinta si ya está en el diagrama */
  import?: boolean;
};

export type DiagramNode = {
  id: string;
  /** Clase de nodo. Por compatibilidad, cualquier otro valor se trata como `node` con ese `type`. */
  kind: string;
  /** kind=node: tipo de la paleta. kind=ref: sobrescribe el del catálogo. */
  type?: ElementType;
  /** kind=ref: id del nodo en el catálogo */
  ref?: string;
  /** kind=diagram: fichero del diagrama, relativo a este */
  file?: string;
  /** kind=diagram: el subdiagrama definido aquí mismo (alternativa a `file`) */
  diagram?: DiagramModel;
  /** kind=ref: atajo de reglas de relación */
  expand?: ExpandMode;
  /** kind=ref: relaciones salientes a incluir (se suman a `expand`) */
  outgoing?: RelationRule[];
  /** kind=ref: relaciones entrantes a incluir (se suman a `expand`) */
  incoming?: RelationRule[];
  name?: string;
  /** Descripción en Markdown */
  description?: string;
  props?: Record<string, any>;
  /** Opcional: si falta, se calcula con autolayout */
  position?: Position;
  errors?: string[];
  warns?: string[];
  width?: number;
  height?: number;
};

/** Tipos de arista según los handles que usa */
export type EdgeKind = 'lateral' | 'parentChild';

/** Arista de un diagrama. Su id no se escribe: se calcula con `edgeId(source, target)`. */
export type DiagramEdge = {
  source: string;
  target: string;
  /** Id del handle de origen ('out' | 'children') */
  sourceHandle?: string;
  /** Id del handle de destino ('in' | 'parent') */
  targetHandle?: string;
  kind?: EdgeKind;
  /** Uso (acoplamiento fuerte): se dibuja hacia abajo y destacada */
  uses?: boolean;
  /** Tipo de relación (config, call…) */
  type?: string;
  label?: string;
  description?: string;
  technology?: string;
  props?: Record<string, any>;
};

export type DiagramModel = {
  version: string;
  /** Título visible en la cabecera y las migas de pan */
  title?: string;
  /** Descripción en Markdown */
  description?: string;
  /** Dirección del autolayout: izquierda→derecha o arriba→abajo */
  direction?: 'LR' | 'TB';
  /**
   * Qué nodos del catálogo pintar. Cada entrada incluye todos los nodos de su
   * tipo; además se pintan las relaciones del catálogo entre los nodos
   * presentes, y entre los importados por las referencias sólo quedan esos
   * tipos. Los nodos declarados en el diagrama se pintan siempre.
   */
  include?: IncludeRule[];
  /** Forma abreviada de `include`: `["microFront"]` = `[{ "type": "microFront" }]` */
  types?: string[];
  /** Cajas que agrupan a los nodos de ciertos tipos */
  groups?: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

/**
 * Selector de nodos del catálogo:
 * - `type`: todos los nodos de ese tipo;
 * - `ref`: un nodo concreto (`$self` = el nodo para el que se genera la plantilla), siguiendo
 *   sus relaciones salientes de `dependencies` y `uses`, y las entrantes (`incoming`), que
 *   encajen con el patrón `"tipoDeRelación/tipoDeNodo"` (`*` = cualquiera; el tipo de nodo es el
 *   del otro extremo) e incluyendo los nodos del otro extremo.
 * `diagram` es una plantilla: cada nodo incluido por la regla abre un subdiagrama generado
 * con `$self` sustituido por ese nodo.
 */
export type IncludeRule = {
  type?: string;
  ref?: string;
  dependencies?: string;
  uses?: string;
  /** Relaciones que llegan al nodo `ref` (desde `dependencies` o `uses` de otros) */
  incoming?: string;
  diagram?: DiagramModel;
};

/** Valor que se sustituye por el nodo concreto al instanciar una plantilla de subdiagrama */
export const SELF_REF = '$self';

/** Instancia una plantilla: cambia cada valor `"$self"` por el id del nodo */
export function instantiateTemplate(template: DiagramModel, catalogId: string): DiagramModel {
  return JSON.parse(JSON.stringify(template), (_k, v) => (v === SELF_REF ? catalogId : v));
}

/** ¿El patrón `tipoDeRelación/tipoDeNodo` encaja? (`*` = cualquiera; sin `/`, sólo se mira la relación) */
export function matchesRelationPattern(pattern: string | undefined, relationType: string | undefined, nodeType: string): boolean {
  if (!pattern) return false;
  const [rel = '*', node = '*'] = pattern.split('/');
  return (rel === '*' || rel === relationType) && (node === '*' || node === nodeType);
}

/** Caja que envuelve a los nodos de ciertos tipos */
export type DiagramGroup = {
  name: string;
  types: string[];
  /** Color de acento de la caja */
  color?: string;
  description?: string;
  /** `box`: los nodos se reparten dentro de la caja en una rejilla lo más cuadrada posible */
  layout?: 'box';
  /** Pintar la caja aunque envuelva a un solo nodo (por defecto no se pinta) */
  explicit?: boolean;
};

/** Tipos incluidos por un diagrama, sumando `include` y la forma abreviada `types` */
export function includedTypes(model: Pick<DiagramModel, 'include' | 'types'>): string[] {
  return [...(model.include ?? []).flatMap((r) => (r.type ? [r.type] : [])), ...(model.types ?? [])];
}

/** Separador de las rutas de subdiagramas definidos dentro de otro: `frontend.json::login::detalle` */
export const INLINE_SEP = '::';

/* ============================================================================
 * Zod schemas (tolerantes: los errores de contenido se muestran en el nodo)
 * ==========================================================================*/
const ZPoint = z
  .object({ x: z.number(), y: z.number() })
  .describe('Posición fija en el lienzo. Opcional: sin ella, el visor coloca el nodo automáticamente.');
const ZProps = z
  .record(z.string(), z.any())
  .describe('Propiedades del tipo de nodo o de la relación (ver la guía, §5). Se admiten claves extra.');
const ZMarkdown = (what: string) => z.string().describe(`${what} En Markdown.`);

export const ZRelationRule = z
  .object({
    type: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Tipo(s) de relación que incluye la regla (config, call…). Sin él, cualquiera.'),
    import: z
      .boolean()
      .optional()
      .describe('true: añade el nodo del otro extremo si no está. false (defecto): solo pinta la relación si ya está.'),
  })
  .describe('Regla para traer relaciones del catálogo al expandir una referencia.');

export const ZDiagramNode = z
  .object({
    id: z.string().describe('Identificador único dentro del diagrama. Lo usan las aristas (source/target).'),
    kind: z
      .string()
      .default('node')
      .describe('"ref": nodo del catálogo. "diagram": abre otro diagrama. "node": nodo solo de este diagrama.'),
    type: z.string().optional().describe('Tipo del nodo. kind=node: obligatorio. kind=ref: sobrescribe el del catálogo. Texto libre: los tipos de la paleta tienen icono y ficha propios; cualquier otro se pinta como nodo genérico.'),
    ref: z.string().optional().describe('kind=ref: id del nodo en el catálogo de la carpeta.'),
    file: z.string().optional().describe('kind=diagram: fichero del subdiagrama, relativo a este diagrama ("/" = raíz).'),
    // Recursivo: un subdiagrama definido dentro de un nodo
    get diagram() {
      return ZDiagramModel.optional().describe('kind=diagram: el subdiagrama definido aquí mismo (alternativa a file).');
    },
    expand: z
      .enum(['node', 'config', 'all'])
      .optional()
      .describe('kind=ref: atajo de reglas. node (defecto): sin relaciones. config: sus dependencias config. all: todas.'),
    outgoing: z.array(ZRelationRule).optional().describe('kind=ref: relaciones salientes a incluir (se suman a expand).'),
    incoming: z.array(ZRelationRule).optional().describe('kind=ref: relaciones entrantes a incluir (se suman a expand).'),
    name: z.string().optional().describe('Nombre visible.'),
    description: ZMarkdown('Descripción para la ficha.').optional(),
    props: ZProps.optional(),
    position: ZPoint.optional(),
    errors: z.array(z.string()).optional().describe('Errores a marcar en el nodo (rojo).'),
    warns: z.array(z.string()).optional().describe('Avisos a marcar en el nodo (naranja).'),
    width: z.number().positive().optional().describe('Ancho fijo de la forma, en px.'),
    height: z.number().positive().optional().describe('Alto fijo de la forma, en px.'),
  })
  .describe('Nodo de un diagrama.');

export const ZDiagramEdge = z
  .object({
    source: z.string().describe('id de un nodo de este diagrama.'),
    target: z.string().describe('id de un nodo de este diagrama.'),
    sourceHandle: z.string().optional().describe('Avanzado: "out" (lateral) o "children" (abajo).'),
    targetHandle: z.string().optional().describe('Avanzado: "in" (lateral) o "parent" (arriba).'),
    kind: z.enum(['lateral', 'parentChild']).optional().describe('parentChild: de padre a hijo, hacia abajo.'),
    uses: z.boolean().optional().describe('true: uso (acoplamiento fuerte), hacia abajo y destacado.'),
    type: z.string().optional().describe('Tipo de relación (texto libre: config, call…).'),
    label: z.string().optional().describe('Texto sobre la flecha.'),
    description: ZMarkdown('Descripción para la ficha de la arista.').optional(),
    technology: z.string().optional().describe('Tecnología; etiqueta si no hay label.'),
    props: ZProps.optional(),
  })
  .describe('Arista propia del diagrama. Sin id: se calcula como from:<source>-to:<target>.');

export const ZDiagramModel = z
  .object({
    version: z.string().default('1.0').describe('Versión del formato: "1.0".'),
    title: z.string().optional().describe('Título de la cabecera y de las migas de pan.'),
    description: ZMarkdown('Descripción del diagrama.').optional(),
    direction: z
      .enum(['LR', 'TB'])
      .optional()
      .describe('Dirección del autolayout: LR (izquierda→derecha, defecto) o TB (arriba→abajo).'),
    include: z
      .array(
        z
          .object({
            type: z.string().optional().describe('Incluye todos los nodos del catálogo de este tipo (texto libre).'),
            ref: z.string().optional().describe('Incluye este nodo del catálogo ("$self" dentro de una plantilla).'),
            dependencies: z
              .string()
              .optional()
              .describe('Con ref: sus dependencias que encajen con "tipoDeRelación/tipoDeNodo" (* = cualquiera).'),
            uses: z.string().optional().describe('Con ref: sus usos que encajen con "tipoDeRelación/tipoDeNodo".'),
            incoming: z
              .string()
              .optional()
              .describe('Con ref: relaciones que le llegan que encajen con "tipoDeRelación/tipoDeNodo".'),
            // Plantilla de subdiagrama para cada nodo incluido (recursivo)
            get diagram() {
              return ZDiagramModel.optional().describe(
                'Plantilla: cada nodo incluido por este selector abre un subdiagrama con "$self" = ese nodo.',
              );
            },
          })
          .describe('Selector de nodos del catálogo: por type o por ref.'),
      )
      .optional()
      .describe('Selectores de nodos del catálogo que pintar.'),
    types: z.array(z.string()).optional().describe('Obsoleto: forma abreviada de include por tipo.'),
    groups: z
      .array(
        z
          .object({
            name: z.string().describe('Título de la caja.'),
            types: z.array(z.string()).describe('Tipos de nodo que entran en la caja (texto libre).'),
            color: z.string().optional().describe('Color de acento (#rrggbb).'),
            description: z.string().optional().describe('Texto al pasar el ratón.'),
            layout: z.enum(['box']).optional().describe('box: rejilla cuadrada. Sin él, en columna.'),
            explicit: z.boolean().optional().describe('true: pinta la caja aunque tenga un solo nodo.'),
          })
          .describe('Caja que agrupa nodos por tipo.'),
      )
      .optional()
      .describe('Cajas que agrupan nodos por tipo.'),
    // Puede faltar si el diagrama se define sólo por `include`
    get nodes() {
      return z.array(ZDiagramNode).default([]).describe('Nodos declarados.');
    },
    edges: z.array(ZDiagramEdge).default([]).describe('Aristas propias del diagrama.'),
  })
  .describe('Diagrama del visor: una vista sobre el catálogo de su carpeta.');

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const where = issue?.path?.length ? ` (en ${issue.path.join('.')})` : '';
  return `${issue?.message ?? 'Formato no válido'}${where}`;
}

/** Intenta parsear un objeto (ya deserializado) a DiagramModel. */
export function tryParseDiagramModel(input: unknown): { ok: true; data: DiagramModel } | { ok: false; error: string } {
  const parsed = ZDiagramModel.safeParse(input);
  return parsed.success ? { ok: true, data: parsed.data as DiagramModel } : { ok: false, error: firstIssue(parsed.error) };
}

/* ============================================================================
 * Catálogo: nodos y relaciones compartidos por todos los diagramas
 * ==========================================================================*/
/** Nombre del catálogo: uno por carpeta de diagrama, junto a su diagrama raíz */
export const CATALOG_FILE = 'catalog.json';

/** Arista saliente de un nodo del catálogo */
export type CatalogDependency = {
  target: string;
  /**
   * Nodo intermedio por el que pasa la relación (p. ej. el gateway entre un mfe y su bff).
   * Nunca se pinta directa: siempre origen → intermedio → destino.
   */
  through?: string;
  /** Tipo de relación: sirve para filtrar al expandir referencias (config, call…) */
  type?: string;
  kind?: EdgeKind;
  label?: string;
  description?: string;
  technology?: string;
  props?: Record<string, any>;
};

export type CatalogNode = {
  id: string;
  type: ElementType;
  name?: string;
  description?: string;
  props?: Record<string, any>;
  /** Aristas salientes del nodo: se dibujan hacia la derecha */
  dependencies?: CatalogDependency[];
  /** Usos: acoplamiento más fuerte que una dependencia. Se dibujan hacia abajo y destacados. */
  uses?: CatalogDependency[];
};

/** Dependencia ya asociada a su origen, con su id calculado */
export type CatalogRelation = CatalogDependency & { id: string; source: string; /** Viene de `uses` */ uses?: boolean };

export type CatalogModel = {
  version: string;
  nodes: CatalogNode[];
  /** Todas las dependencias de todos los nodos (derivado de `nodes[].dependencies`) */
  relations: CatalogRelation[];
};

const ZDependency = z
  .object({
    target: z.string().describe('id del nodo de destino, en el mismo catálogo.'),
    through: z
      .string()
      .optional()
      .describe('id de un nodo intermedio (p. ej. el gateway): se pinta origen → intermedio → destino, nunca directa.'),
    // Variante con la errata habitual; se normaliza a `through`
    throught: z.string().optional().describe('Obsoleto: errata de through.'),
    type: z.string().optional().describe('Tipo de relación (texto libre). Vocabulario recomendado: config, call, loads, embeds, route, proxy-service, proxy-api, guard, contains.'),
    kind: z.enum(['lateral', 'parentChild']).optional().describe('parentChild: de padre a hijo (mejor usar el bloque uses).'),
    label: z.string().optional().describe('Texto sobre la flecha.'),
    description: ZMarkdown('Descripción para la ficha de la relación.').optional(),
    technology: z.string().optional().describe('Tecnología; etiqueta si no hay label.'),
    props: ZProps.optional(),
  })
  .describe('Relación saliente de un nodo del catálogo.');

export const ZCatalogModel = z
  .object({
    version: z.string().default('1.0').describe('Versión del formato: "1.0".'),
    nodes: z
      .array(
        z
          .object({
            id: z.string().describe('Identificador único en el catálogo (kebab-case con prefijo: mfe-, bff-, api-…).'),
            type: z.string().describe('Tipo del nodo. Texto libre: los tipos de la paleta tienen icono y ficha propios; cualquier otro se pinta como nodo genérico.'),
            name: z.string().optional().describe('Nombre visible.'),
            description: ZMarkdown('Descripción para la ficha.').optional(),
            props: ZProps.optional(),
            dependencies: z
              .array(ZDependency)
              .optional()
              .describe('Relaciones salientes normales: flecha hacia la derecha.'),
            uses: z
              .array(ZDependency)
              .optional()
              .describe('Relaciones de acoplamiento fuerte: flecha hacia abajo, destacada.'),
          })
          .describe('Pieza del sistema.'),
      )
      .describe('Nodos del sistema, cada uno con sus relaciones salientes.'),
  })
  .describe('Catálogo de una carpeta de diagramas: nodos y relaciones reutilizables.');

/** Índice de diagramas (`index.json` en la raíz de la carpeta de diagramas) */
export const ZManifest = z
  .object({
    diagrams: z
      .array(
        z.object({
          path: z.string().describe('Carpeta del diagrama (se abre su index.json) o fichero .json, relativa a la raíz.'),
          name: z.string().optional().describe('Nombre visible.'),
          description: z.string().optional().describe('Descripción corta.'),
        }),
      )
      .describe('Diagramas que aparecen en el árbol inicial.'),
  })
  .describe('Índice de diagramas de la carpeta raíz: solo nombres y rutas.');

/** `throught` → `through` */
function normDep(d: CatalogDependency & { throught?: string }): CatalogDependency {
  const { throught, ...rest } = d;
  return { ...rest, through: d.through ?? throught };
}

export function tryParseCatalog(input: unknown): { ok: true; data: CatalogModel } | { ok: false; error: string } {
  const parsed = ZCatalogModel.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const nodes = parsed.data.nodes as CatalogNode[];
  const ids = new UniqueIds();
  const relations: CatalogRelation[] = nodes.flatMap((n) => [
    ...(n.dependencies ?? []).map((d) => ({ ...normDep(d), source: n.id, id: ids.next(n.id, d.target) })),
    ...(n.uses ?? []).map((d) => ({ ...normDep(d), source: n.id, id: ids.next(n.id, d.target), uses: true })),
  ]);
  return { ok: true, data: { version: parsed.data.version, nodes, relations } };
}

/* ============================================================================
 * Ids de arista: siempre calculados a partir de sus extremos
 * ==========================================================================*/
export const edgeId = (source: string, target: string) => `from:${source}-to:${target}`;

/** Genera `from:a-to:b`, y `from:a-to:b#2`, `#3`… si el mismo par se repite. */
export class UniqueIds {
  private readonly seen = new Map<string, number>();

  next(source: string, target: string): string {
    const base = edgeId(source, target);
    const n = (this.seen.get(base) ?? 0) + 1;
    this.seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  }
}

// Desarrollo: los objetos creados al arrancar (fuente de archivos, ficheros) conservan
// la versión anterior de estos schemas tras un cambio en caliente; mejor recargar entera.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
