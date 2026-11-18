#!/usr/bin/env node
/**
 * Empaqueta los .json de una carpeta de diagramas en <carpeta>/diagram-data.js, para que
 * diagram-viewer.html pueda abrirse con doble clic (file://) sin pedir permiso de lectura:
 * los navegadores no dejan leer .json locales, pero sí cargar un <script> de la misma carpeta.
 *
 *   pnpm run pack-data <carpeta>
 *
 * Hay que volver a ejecutarlo cada vez que cambien los diagramas.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT = 'diagram-data.js';
const arg = process.argv[2];
if (!arg) {
  console.error('Uso: pnpm run pack-data <carpeta de diagramas>');
  process.exit(1);
}
const root = path.resolve(arg);

async function walk(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const rel = prefix + entry.name;
    if (entry.isDirectory()) out.push(...(await walk(path.join(dir, entry.name), rel + '/')));
    else if (entry.name.endsWith('.json')) out.push(rel);
  }
  return out;
}

const files = (await walk(root)).sort();
const data = {};
const errors = [];
for (const rel of files) {
  try {
    data[rel] = JSON.parse(await readFile(path.join(root, rel), 'utf8'));
  } catch (e) {
    errors.push(`  ${rel}: ${e.message}`);
  }
}
if (errors.length) {
  console.error(`JSON inválido, no se ha generado ${OUTPUT}:\n${errors.join('\n')}`);
  process.exit(1);
}
if (!data['index.json']) console.warn(`Aviso: no hay index.json en la raíz de ${root}`);

const content =
  `// Generado por pack-data (${new Date().toISOString()}). No editar: vuelve a ejecutar\n` +
  `// «pnpm run pack-data <carpeta>» cuando cambien los diagramas.\n` +
  `window.__DIAGRAM_DATA__ = ${JSON.stringify(data)};\n`;
await writeFile(path.join(root, OUTPUT), content);
console.log(`${OUTPUT}: ${files.length} ficheros JSON de ${root} (${(content.length / 1024).toFixed(1)} KB)`);
