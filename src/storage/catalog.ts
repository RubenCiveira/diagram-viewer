import { buildCatalog, resolvePath, type ActionTemplate, type CatalogModel, type CatalogNode } from '../diagram';
import { FileNotFoundError, type Repository } from './Repository';

/**
 * Lee el catálogo de una carpeta de diagrama siguiendo sus `include`: los nodos de cada
 * fichero incluido se suman, en orden (primero los del propio fichero, luego los de cada
 * include, en profundidad), y las relaciones se calculan sobre el conjunto, así que un
 * `target` o un `through` puede apuntar a un nodo de otro fichero.
 *
 *   { "version": "1.0", "include": ["catalog/pagos.json", "catalog/pedidos.json"], "nodes": [ … ] }
 *
 * Si falla el catálogo principal se lanza el error. Los problemas de los incluidos (no existe,
 * no es válido, ciclo, id repetido) son avisos: se usa lo demás. Con un id repetido gana la
 * primera definición.
 */
export async function loadCatalog(repo: Repository, path: string): Promise<{ catalog: CatalogModel; warnings: string[] }> {
  const warnings: string[] = [];
  const nodes: CatalogNode[] = [];
  /** Fichero que define cada id (para avisar de repetidos) */
  const owner = new Map<string, string>();
  /** Plantillas de acción, por nombre: con uno repetido gana la primera */
  const templates = new Map<string, ActionTemplate>();
  const templateOwner = new Map<string, string>();
  /** Ficheros ya leídos: un fichero incluido dos veces (por caminos distintos) se suma una sola vez */
  const done = new Set<string>();

  const read = async (file: string) => {
    const f = await repo.loadFile(file);
    if (!f) throw new FileNotFoundError(file);
    return f.readCatalog();
  };

  const visit = async (file: string, model: CatalogModel, chain: string[]) => {
    done.add(file);
    for (const t of model.actionTemplates ?? []) {
      const prev = templateOwner.get(t.name);
      if (prev) {
        warnings.push(`Plantilla de acción «${t.name}» repetida en ${file}${prev === file ? '' : ` (ya está en ${prev})`}: se usa la primera`);
        continue;
      }
      templateOwner.set(t.name, file);
      templates.set(t.name, t);
    }
    for (const n of model.nodes) {
      const prev = owner.get(n.id);
      if (prev) {
        warnings.push(`Nodo «${n.id}» repetido en ${file}${prev === file ? '' : ` (ya está en ${prev})`}: se usa el primero`);
        continue;
      }
      owner.set(n.id, file);
      nodes.push(n);
    }
    for (const rel of model.include ?? []) {
      let target: string;
      try {
        target = resolvePath(file, rel);
      } catch (e: any) {
        warnings.push(`${file}: include «${rel}»: ${e?.message ?? e}`);
        continue;
      }
      if (chain.includes(target)) {
        warnings.push(`${file}: include «${rel}» forma un ciclo (${[...chain, target].join(' → ')})`);
        continue;
      }
      if (done.has(target)) continue;
      let child: CatalogModel;
      try {
        child = await read(target);
      } catch (e: any) {
        warnings.push(`${file}: include «${rel}»: ${e instanceof FileNotFoundError ? `no existe ${target}` : (e?.message ?? e)}`);
        continue;
      }
      await visit(target, child, [...chain, target]);
    }
  };

  const root = await read(path);
  await visit(path, root, [path]);
  return { catalog: buildCatalog(root.version, nodes, [...templates.values()]), warnings };
}
