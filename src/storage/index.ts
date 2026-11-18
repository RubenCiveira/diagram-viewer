import { EmbeddedStorage } from './providers/embedded/EmbeddedStorage';
import { HttpStorage } from './providers/http/HttpStorage';
import { LocalFolderStorage } from './providers/local-folder/LocalFolderStorage';
import type { Storage } from './Repository';

export * from './Repository';

/**
 * Elige la fuente de archivos según cómo se ha abierto el visor:
 * - servido por HTTP con un index.json al lado → se lee directamente (siempre lo último);
 * - abierto como fichero con un diagram-data.js al lado → se usa ese empaquetado, sin permisos;
 * - abierto como fichero sin él → hay que pedir acceso a la carpeta.
 */
export async function resolveStorage(): Promise<Storage> {
  if (await HttpStorage.isAvailable()) return new HttpStorage();
  return EmbeddedStorage.fromWindow() ?? new LocalFolderStorage();
}

// Desarrollo: la fuente de archivos se crea una vez y vive en el estado de React; si su
// código cambia, una actualización en caliente la dejaría con la versión anterior.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
