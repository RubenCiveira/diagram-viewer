/**
 * Valida una carpeta de diagramas:
 *
 *   pnpm run validate <carpeta> [--strict]
 *
 * - Errores: JSON inválido o ficheros que no cumplen su JSON Schema (docs/schemas/). El fichero
 *   está mal formado. Terminan con código 1.
 * - Avisos funcionales: referencias entre ficheros que no se resuelven (ids del catálogo,
 *   intermedios, subdiagramas, aristas, ids duplicados, include del catálogo). El visor los tolera: pinta el nodo
 *   marcado y muestra un aviso. Sólo hacen fallar el comando con --strict.
 *
 * Pensado para que quien genera los ficheros (una persona o un agente de IA) compruebe su
 * salida antes de abrirla en el visor.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import Ajv, { type ErrorObject } from 'ajv';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const arg = args.find((a) => !a.startsWith('--'));
if (!arg) {
  console.error('Uso: pnpm run validate <carpeta de diagramas> [--strict]');
  process.exit(1);
}
const base = path.resolve(arg);

const ajv = new Ajv({ allErrors: true, strict: false });
const load = async (f: string) => JSON.parse(await readFile(path.join(ROOT, 'docs/schemas', f), 'utf8'));
const validators = {
  index: ajv.compile(await load('index.schema.json')),
  catalog: ajv.compile(await load('catalog.schema.json')),
  diagram: ajv.compile(await load('diagram.schema.json')),
};

const errors: string[] = [];
const warnings: string[] = [];
const err = (file: string, msg: string) => errors.push(`${file}: ${msg}`);
const warn = (file: string, msg: string) => warnings.push(`${file}: ${msg}`);
const fmt = (e: ErrorObject) =>
  `${e.instancePath || '/'} ${e.message}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as string[]).join(', ')})` : ''}${e.params && 'additionalProperty' in e.params ? ` «${e.params.additionalProperty}»` : ''}`;

async function walk(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), prefix + e.name + '/')));
    else if (e.name.endsWith('.json')) out.push(prefix + e.name);
  }
  return out;
}

const files = await walk(base);
const json = new Map<string, any>();
for (const f of files) {
  try {
    json.set(f, JSON.parse(await readFile(path.join(base, f), 'utf8')));
  } catch (e: any) {
    err(f, `JSON inválido: ${e.message}`);
  }
}

const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
const resolveRel = (from: string, rel: string) => path.posix.normalize(rel.startsWith('/') ? rel.slice(1) : dirOf(from) + rel);

/**
 * Ficheros de un catálogo: el propio catalog.json y los que incluye (en profundidad, como el
 * visor). Los avisos de include (no existe, ciclo) se dan una sola vez por fichero.
 */
const catalogFiles = new Set<string>();
const includeChecked = new Set<string>();
function collectCatalog(file: string, chain: string[] = [file]): string[] {
  catalogFiles.add(file);
  const out = [file];
  for (const rel of json.get(file)?.include ?? []) {
    if (typeof rel !== 'string') continue;
    const target = resolveRel(file, rel);
    const report = !includeChecked.has(file);
    if (target.startsWith('../')) {
      if (report) warn(file, `include «${rel}» sale de la carpeta de diagramas`);
    } else if (chain.includes(target)) {
      if (report) warn(file, `include «${rel}» forma un ciclo (${[...chain, target].join(' → ')})`);
    } else if (!json.has(target)) {
      if (report) warn(file, `include «${rel}»: no existe ${target}`);
    } else if (!out.includes(target)) {
      for (const f of collectCatalog(target, [...chain, target])) if (!out.includes(f)) out.push(f);
    }
  }
  includeChecked.add(file);
  return out;
}
/** Catálogo de cada carpeta de diagrama → sus ficheros, en el orden en que el visor los suma */
const catalogsByFolder = new Map<string, string[]>();
for (const f of json.keys()) if (path.basename(f) === 'catalog.json') catalogsByFolder.set(dirOf(f), collectCatalog(f));

// 1. Cada fichero contra su schema
const kindOf = (f: string) => (f === 'index.json' ? 'index' : catalogFiles.has(f) ? 'catalog' : 'diagram');
for (const [f, data] of json) {
  const v = validators[kindOf(f)];
  if (!v(data)) for (const e of v.errors ?? []) err(f, fmt(e));
}

// 2. Referencias (avisos funcionales: el visor los tolera): índice → carpetas; catálogo → targets; diagramas → ref, aristas, file
const exists = async (p: string) => stat(path.join(base, p)).then(() => true, () => false);
const index = json.get('index.json');
if (!index) warn('index.json', 'falta el índice de la raíz');
const roots: string[] = [];
for (const d of index?.diagrams ?? []) {
  const file = d.path.endsWith('.json') ? d.path : `${d.path.replace(/\/$/, '')}/index.json`;
  if (!(await exists(file))) warn('index.json', `«${d.path}»: no existe ${file}`);
  else roots.push(file);
}

const checkDiagram = (file: string, d: any, catalogIds: Set<string> | null, where: string) => {
  const ids = new Set<string>();
  for (const n of d.nodes ?? []) {
    if (ids.has(n.id)) warn(file, `${where}nodo «${n.id}» duplicado`);
    ids.add(n.id);
    if (n.kind === 'ref' && n.ref && catalogIds && !catalogIds.has(n.ref)) warn(file, `${where}nodo «${n.id}»: «${n.ref}» no está en el catálogo`);
    if (n.kind === 'ref' && !catalogIds) warn(file, `${where}nodo «${n.id}» usa ref pero la carpeta no tiene catalog.json`);
    if (n.kind === 'diagram' && n.file && !json.has(resolveRel(file, n.file))) warn(file, `${where}nodo «${n.id}»: no existe ${resolveRel(file, n.file)}`);
    if (n.diagram) checkDiagram(file, n.diagram, catalogIds, `${where}${n.id} › `);
  }
  for (const e of d.edges ?? []) {
    for (const end of [e.source, e.target]) if (!ids.has(end)) warn(file, `${where}arista ${e.source} → ${e.target}: «${end}» no es un nodo de este diagrama`);
  }
  for (const [i, r] of (d.include ?? []).entries()) {
    if (r.ref && r.ref !== '$self' && catalogIds && !catalogIds.has(r.ref)) warn(file, `${where}include[${i}]: «${r.ref}» no está en el catálogo`);
    if (r.detail && r.detail !== '$self' && catalogIds && !catalogIds.has(r.detail)) warn(file, `${where}include[${i}]: «${r.detail}» no está en el catálogo`);
    if ((r.ref || r.type || r.detail) && !catalogIds) warn(file, `${where}include[${i}] necesita catalog.json en la carpeta`);
    if (r.diagram) checkDiagram(file, r.diagram, catalogIds, `${where}include[${i}] › `);
  }
};

for (const root of roots) {
  const folder = dirOf(root);
  const parts = catalogsByFolder.get(folder);
  let catalogIds: Set<string> | null = null;
  if (parts) {
    catalogIds = new Set();
    // Nodos de todos los ficheros del catálogo: un target puede estar en otro fichero
    const owner = new Map<string, string>();
    const nodes = parts.flatMap((f) => (json.get(f)?.nodes ?? []).map((n: any) => ({ f, n })));
    for (const { f, n } of nodes) {
      if (catalogIds.has(n.id)) warn(f, `nodo «${n.id}» duplicado${owner.get(n.id) !== f ? ` (ya está en ${owner.get(n.id)})` : ''}`);
      else owner.set(n.id, f);
      catalogIds.add(n.id);
    }
    // Nodos internos (`nodes` de un nodo): id completo <padre>/<id>, únicos entre hermanos
    const all: { f: string; n: any; id: string; parent?: string }[] = [];
    const flatten = (f: string, list: any[], parent?: string) => {
      const siblings = new Set<string>();
      for (const n of list ?? []) {
        const id = parent ? `${parent}/${n.id}` : n.id;
        if (parent) {
          if (siblings.has(n.id)) warn(f, `nodo interno «${id}» duplicado`);
          siblings.add(n.id);
          catalogIds!.add(id);
        }
        all.push({ f, n, id, parent });
        if (n.nodes) flatten(f, n.nodes, id);
      }
    };
    for (const { f, n } of nodes) flatten(f, [n]);
    // Como el visor: un target de un nodo interno se busca primero entre sus hermanos, luego subiendo
    const lookup = (ref: string, parent?: string) => {
      for (let scope = parent; scope; scope = scope.includes('/') ? scope.slice(0, scope.lastIndexOf('/')) : undefined) {
        if (catalogIds!.has(`${scope}/${ref}`)) return true;
      }
      return catalogIds!.has(ref);
    };
    for (const { f, n, id, parent } of all) {
      for (const block of ['dependencies', 'uses'] as const) {
        for (const r of n[block] ?? []) {
          if (!lookup(r.target, parent)) warn(f, `«${id}».${block}: «${r.target}» no existe`);
          if (r.through && !lookup(r.through, parent)) warn(f, `«${id}».${block}: intermedio «${r.through}» no existe`);
        }
      }
    }
  }
  // Diagramas de esa carpeta (incluidas subcarpetas): todos comparten su catálogo
  for (const [f, d] of json) {
    if (f.startsWith(folder) && kindOf(f) === 'diagram') checkDiagram(f, d, catalogIds, '');
  }
}

const list = (items: string[]) => items.map((e) => `  - ${e}`).join('\n');
if (errors.length) console.error(`✗ ${errors.length} error(es) de formato en ${base}:\n${list(errors)}`);
if (warnings.length) console.warn(`⚠ ${warnings.length} aviso(s) funcional(es) en ${base}:\n${list(warnings)}`);
if (errors.length || (strict && warnings.length)) process.exit(1);
console.log(`✓ ${files.length} ficheros con formato válido en ${base}${warnings.length ? ' (con avisos)' : ''}`);
