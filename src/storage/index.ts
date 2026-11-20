import { EmbeddedStorage } from './providers/embedded/EmbeddedStorage';
import { HttpStorage } from './providers/http/HttpStorage';
import { LocalFolderStorage } from './providers/local-folder/LocalFolderStorage';
import type { Storage } from './Repository';
import { viewerConfig } from './config';

export * from './Repository';
export { viewerConfig } from './config';

/**
 * Elige la fuente de archivos según `source` de config.js y cómo se ha abierto el visor:
 * - "http": siempre por HTTP desde baseUrl;
 * - "auto" (por defecto) y hay índice accesible por HTTP en baseUrl → se lee directamente (siempre lo último);
 * - si no ("local" o "auto" sin HTTP): diagram-data.js si existe, sin permisos;
 * - y si tampoco → hay que pedir acceso a la carpeta.
 */
export async function resolveStorage(): Promise<Storage> {
  if (viewerConfig.source === 'http') return new HttpStorage();
  if (viewerConfig.source === 'auto' && (await HttpStorage.isAvailable())) return new HttpStorage();
  return EmbeddedStorage.fromWindow() ?? new LocalFolderStorage();
}

// Desarrollo: la fuente de archivos se crea una vez y vive en el estado de React; si su
// código cambia, una actualización en caliente la dejaría con la versión anterior.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
