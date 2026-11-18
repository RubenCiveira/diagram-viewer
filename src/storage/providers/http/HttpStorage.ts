import { normPath } from '../../../diagram';
import { FileNotFoundError, type Repository, type Storage } from '../../Repository';
import { TextFile } from '../../TextFile';
import { readManifest } from '../../manifest';

/**
 * Lee los ficheros por HTTP, relativos a la página. Se usa cuando el visor
 * se sirve desde un servidor (o con `npm run dev`): no requiere permisos.
 */
export class HttpStorage implements Storage {
  private readonly repo = new HttpRepository();

  /** ¿Hay un index.json accesible junto a la página? */
  static async isAvailable(): Promise<boolean> {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const r = await fetch(urlOf('index.json'), { method: 'GET', cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  name(): string {
    return decodeURIComponent(location.pathname.split('/').slice(-2, -1)[0] || location.host);
  }

  gateComponent() {
    return null;
  }

  listRepositories(): Repository[] {
    return [this.repo];
  }
}

function urlOf(path: string): string {
  return new URL(normPath(path).split('/').map(encodeURIComponent).join('/'), location.href).href;
}

class HttpRepository implements Repository {
  name(): string {
    return location.host;
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
