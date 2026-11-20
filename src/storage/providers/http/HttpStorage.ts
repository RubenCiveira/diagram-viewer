import { normPath } from '../../../diagram';
import { FileNotFoundError, type Repository, type Storage } from '../../Repository';
import { TextFile } from '../../TextFile';
import { MANIFEST_FILE, readManifest } from '../../manifest';
import { viewerConfig } from '../../config';

/**
 * Lee los ficheros por HTTP, relativos a `baseUrl` de config.js (por defecto, la carpeta
 * de la página). Se usa cuando el visor se sirve desde un servidor (o con `npm run dev`):
 * no requiere permisos. Si baseUrl es de otro origen, ese servidor debe permitir CORS.
 */
export class HttpStorage implements Storage {
  private readonly repo = new HttpRepository();

  /** ¿Hay un índice accesible en baseUrl? */
  static async isAvailable(): Promise<boolean> {
    if (!/^https?:$/.test(new URL(viewerConfig.baseUrl).protocol)) return false;
    try {
      const r = await fetch(urlOf(MANIFEST_FILE), { method: 'GET', cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  name(): string {
    const base = new URL(viewerConfig.baseUrl);
    return decodeURIComponent(base.pathname.split('/').slice(-2, -1)[0] || base.host);
  }

  gateComponent() {
    return null;
  }

  listRepositories(): Repository[] {
    return [this.repo];
  }
}

function urlOf(path: string): string {
  return new URL(normPath(path).split('/').map(encodeURIComponent).join('/'), viewerConfig.baseUrl).href;
}

class HttpRepository implements Repository {
  name(): string {
    return new URL(viewerConfig.baseUrl).host;
  }

  /** Por HTTP no se pueden recorrer carpetas: el índice es la única fuente */
  async listDiagrams() {
    return (await readManifest(this)) ?? [];
  }

  /** No se comprueba la existencia por adelantado: la lectura lanza FileNotFoundError si falta. */
  loadFile(path: string) {
    return new HttpFile(normPath(path));
  }
}

class HttpFile extends TextFile {
  async readText(): Promise<string> {
    const r = await fetch(urlOf(this.path), { cache: 'no-store' });
    if (r.status === 404) throw new FileNotFoundError(this.path);
    if (!r.ok) throw new Error(`Error ${r.status} leyendo «${this.path}»`);
    return r.text();
  }
}
