import { buildCatalog, resolvePath, type ActionTemplate, type CatalogModel, type CatalogNode } from '../diagram';
import { FileNotFoundError, type Repository } from './Repository';

/** Progreso de la carga: ficheros ya leídos frente al total conocido hasta ahora (crece al descubrir includes) */
export type LoadProgress = { done: number; total: number };

/** Descargas de includes simultáneas */
const CONCURRENCY = 4;

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
 *
 * Los ficheros se descargan primero, hasta {@link CONCURRENCY} a la vez, según se van
 * descubriendo sus includes (`onProgress` informa de cada paso); después se ensamblan en el
 * orden de arriba, así que el resultado no depende de qué descarga termine antes.
 */
export async function loadCatalog(
  repo: Repository,
  path: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<{ catalog: CatalogModel; warnings: string[] }> {
  const files = await fetchAll(repo, path, onProgress);
  const rootResult = files.get(path)!;
  if ('error' in rootResult) throw rootResult.error;
  const root = rootResult.model;

  const warnings: string[] = [];
  const nodes: CatalogNode[] = [];
  /** Fichero que define cada id (para avisar de repetidos) */
  const owner = new Map<string, string>();
  /** Plantillas de acción, por nombre: con uno repetido gana la primera */
  const templates = new Map<string, ActionTemplate>();
  const templateOwner = new Map<string, string>();
  /** Ficheros ya sumados: un fichero incluido dos veces (por caminos distintos) se suma una sola vez */
  const done = new Set<string>();

  const visit = (file: string, model: CatalogModel, chain: string[]) => {
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
      const child = files.get(target)!;
      if ('error' in child) {
        const e = child.error;
        warnings.push(`${file}: include «${rel}»: ${e instanceof FileNotFoundError ? `no existe ${target}` : (e?.message ?? e)}`);
        continue;
      }
      visit(target, child.model, [...chain, target]);
    }
  };

  visit(path, root, [path]);
  return { catalog: buildCatalog(root.version, nodes, [...templates.values()]), warnings };
}

type Fetched = { model: CatalogModel } | { error: any };

/**
 * Descarga el fichero raíz y todos los que alcanza por `include`, con un máximo de
 * {@link CONCURRENCY} descargas en curso. Si falla el raíz no se sigue.
 */
async function fetchAll(repo: Repository, root: string, onProgress?: (p: LoadProgress) => void) {
  const results = new Map<string, Fetched>();
  /** Rutas ya descubiertas (descargadas, en curso o en cola) */
  const seen = new Set<string>([root]);
  const queue: string[] = [root];
  let running = 0;
  let finished = 0;

  const report = () => onProgress?.({ done: finished, total: seen.size });

  const read = async (file: string): Promise<Fetched> => {
    try {
      const f = await repo.loadFile(file);
      if (!f) throw new FileNotFoundError(file);
      return { model: await f.readCatalog() };
    } catch (error) {
      return { error };
    }
  };

  await new Promise<void>((resolve) => {
    const pump = () => {
      while (running < CONCURRENCY && queue.length) {
        const file = queue.shift()!;
        running++;
        void read(file).then((r) => {
          running--;
          finished++;
          results.set(file, r);
          if ('model' in r) {
            for (const rel of r.model.include ?? []) {
              let target: string;
              try {
                target = resolvePath(file, rel);
              } catch {
                continue; // el aviso lo da el ensamblado
              }
              if (seen.has(target)) continue;
              seen.add(target);
              queue.push(target);
            }
          }
          report();
          if (!running && !queue.length) resolve();
          else pump();
        });
      }
    };
    report();
    pump();
  });
  return results;
}
