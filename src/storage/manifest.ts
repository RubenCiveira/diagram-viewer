import { normPath } from '../diagram/paths';
import { ZManifest } from '../diagram/model';
import { FileNotFoundError, type DiagramEntry, type Repository } from './Repository';

/**
 * Índice de diagramas de la carpeta (`index.json` en la raíz). Sólo contiene
 * nombres y rutas: es lo que permite listar diagramas cuando la fuente no sabe
 * recorrer carpetas (HTTP).
 *
 *   { "diagrams": [ { "path": "public/e-commerce", "name": "E-commerce", "description": "…" } ] }
 */
export const MANIFEST_FILE = 'index.json';


/** Lee el manifiesto. Devuelve null si no existe; lanza error si existe pero no es válido. */
export async function readManifest(repo: Repository): Promise<DiagramEntry[] | null> {
  let text: string;
  try {
    const file = await repo.loadFile(MANIFEST_FILE);
    if (!file) return null;
    text = await file.readText();
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e: any) {
    throw new Error(`JSON inválido en «${MANIFEST_FILE}»: ${e?.message ?? e}`);
  }
  const parsed = ZManifest.safeParse(json);
  if (!parsed.success) {
    throw new Error(`«${MANIFEST_FILE}» debe ser un índice de diagramas: { "diagrams": [ { "path": … } ] }`);
  }
  return parsed.data.diagrams.map((d) => ({ ...d, path: normPath(d.path) }));
}

/** Fichero del diagrama raíz de una entrada: la propia ruta si es un .json, o su index.json. */
export function diagramFileOf(path: string): string {
  return /\.json$/i.test(path) ? normPath(path) : normPath(`${path}/index.json`);
}
