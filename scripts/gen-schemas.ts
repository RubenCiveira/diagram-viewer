/**
 * Genera los JSON Schema de los ficheros del visor en docs/schemas/, a partir de los mismos
 * validadores (zod) que usa el visor, para que no se desincronicen:
 *
 *   pnpm run schemas
 *
 * Los schemas son más estrictos que el visor (que es tolerante), para guiar a quien genera
 * los ficheros: `kind` limitado a ref/diagram/node, campos obligatorios según el kind y ningún
 * campo desconocido (detecta erratas). Los `type` de nodos y aristas son texto libre: los de
 * la paleta se listan como `examples` (son los que tienen icono y ficha propios).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ZCatalogModel, ZDiagramModel, ZManifest } from '../src/diagram/model.ts';

type Schema = Record<string, any>;

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'schemas');
const PALETTE_DIRS = ['src/palette/providers/modular-app/nodes', 'src/palette/providers/generic/nodes'];
/** Tipos internos que no se escriben a mano */
const INTERNAL_TYPES = new Set(['subdiagram']);
/** Tipos que solo tienen sentido en un diagrama (no en el catálogo) */
const CANVAS_ONLY_TYPES = new Set(['note']);

/** Tipos de la paleta, leídos de sus ficheros (`kind = '…'`) */
async function paletteTypes(): Promise<string[]> {
  const kinds = new Set<string>();
  for (const dir of PALETTE_DIRS) {
    for (const f of await readdir(path.join(ROOT, dir))) {
      const src = await readFile(path.join(ROOT, dir, f), 'utf8');
      for (const m of src.matchAll(/\bkind\s*(?::[^=]+)?=\s*'([^']+)'/g)) if (!INTERNAL_TYPES.has(m[1])) kinds.add(m[1]);
    }
  }
  return [...kinds].sort();
}

/** Recorre todos los subschemas (incluidos los de definitions) */
function walk(s: Schema, fn: (s: Schema) => void) {
  if (!s || typeof s !== 'object') return;
  fn(s);
  for (const v of Object.values(s)) {
    if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
    else if (v && typeof v === 'object') walk(v, fn);
  }
}

/** Sin campos desconocidos en ningún objeto con propiedades declaradas (los `props` son records y no se tocan) */
function closeObjects(s: Schema) {
  walk(s, (x) => {
    if (x.type === 'object' && x.properties && x.additionalProperties === undefined) x.additionalProperties = false;
  });
}

/** Busca el subschema cuya descripción empieza por `prefix` */
function find(s: Schema, prefix: string): Schema {
  let found: Schema | undefined;
  walk(s, (x) => {
    if (!found && typeof x.description === 'string' && x.description.startsWith(prefix) && x.properties) found = x;
  });
  if (!found) throw new Error(`No se encuentra el schema «${prefix}…»`);
  return found;
}

function generate(model: z.ZodType, id: string, title: string): Schema {
  const s = z.toJSONSchema(model, { target: 'draft-07', io: 'input', cycles: 'ref', reused: 'inline' }) as Schema;
  return { $schema: 'http://json-schema.org/draft-07/schema#', $id: id, title, ...s, $comment: 'Generado con «pnpm run schemas». No editar.' };
}

const types = await paletteTypes();
const catalogTypes = types.filter((t) => !CANVAS_ONLY_TYPES.has(t));

// --- Diagrama
const diagram = generate(ZDiagramModel, 'diagram.schema.json', 'Diagrama del visor');
closeObjects(diagram);
diagram.properties.$schema = { type: 'string', description: 'Ruta a este schema (opcional, para editores y validadores).' };
const node = find(diagram, 'Nodo de un diagrama.');
node.properties.kind = { ...node.properties.kind, enum: ['ref', 'diagram', 'node'] };
node.properties.type = { ...node.properties.type, examples: types };
node.required = ['id', 'kind'];
node.allOf = [
  { if: { properties: { kind: { const: 'ref' } } }, then: { required: ['ref'] } },
  { if: { properties: { kind: { const: 'node' } } }, then: { required: ['type'] } },
  { if: { properties: { kind: { const: 'diagram' } } }, then: { anyOf: [{ required: ['file'] }, { required: ['diagram'] }] } },
];
const selector = find(diagram, 'Selector de nodos del catálogo');
selector.properties.type = { ...selector.properties.type, examples: catalogTypes };
selector.anyOf = [{ required: ['type'] }, { required: ['ref'] }, { required: ['detail'] }];
walk(diagram, (x) => {
  if (x.description === 'Tipos de nodo que entran en la caja (texto libre).') x.items = { type: 'string', examples: types };
});

// --- Catálogo
const catalog = generate(ZCatalogModel, 'catalog.schema.json', 'Catálogo del visor');
closeObjects(catalog);
catalog.properties.$schema = { type: 'string', description: 'Ruta a este schema (opcional).' };
const catNode = find(catalog, 'Pieza del sistema.');
catNode.properties.type = { ...catNode.properties.type, examples: catalogTypes };
// Los ids de los nodos internos se escriben <padre>/<id>: un id no puede llevar '/'
catNode.properties.id = { ...catNode.properties.id, pattern: '^[^/]+$' };
// La errata `throught` se acepta en el visor, pero no se debe generar
walk(catalog, (x) => {
  if (x.properties?.throught) delete x.properties.throught;
});

// --- Índice
const manifest = generate(ZManifest, 'index.schema.json', 'Índice de diagramas del visor');
closeObjects(manifest);
manifest.properties.$schema = { type: 'string', description: 'Ruta a este schema (opcional).' };

await mkdir(OUT, { recursive: true });
for (const [file, schema] of [
  ['diagram.schema.json', diagram],
  ['catalog.schema.json', catalog],
  ['index.schema.json', manifest],
] as const) {
  await writeFile(path.join(OUT, file), JSON.stringify(schema, null, 2) + '\n');
  console.log(`docs/schemas/${file}`);
}
console.log(`Tipos de la paleta: ${types.join(', ')}`);
