import { normPath } from '../../../diagram';
import { FileNotFoundError, type Repository, type Storage } from '../../Repository';
import { TextFile } from '../../TextFile';
import { readManifest } from '../../manifest';

declare global {
  interface Window {
    /** Contenido de los .json de la carpeta, cargado desde diagram-data.js (ver scripts/pack-data.mjs) */
    __DIAGRAM_DATA__?: Record<string, unknown>;
  }
}

/**
 * Diagramas empaquetados en diagram-data.js junto al HTML. Permite abrir el visor con
 * doble clic (file://) sin pedir permiso, a costa de regenerar ese fichero al cambiar los datos.
 */
export class EmbeddedStorage implements Storage {
  private readonly repo: EmbeddedRepository;

  constructor(data: Record<string, unknown>) {
    this.repo = new EmbeddedRepository(data);
  }

  static fromWindow(): EmbeddedStorage | null {
    const data = window.__DIAGRAM_DATA__;
    return data && typeof data === 'object' ? new EmbeddedStorage(data) : null;
  }

  name(): string {
    return decodeURIComponent(location.pathname.split('/').slice(-2, -1)[0] || 'diagramas');
  }

  gateComponent() {
    return null;
  }

  listRepositories(): Repository[] {
    return [this.repo];
  }
}

class EmbeddedRepository implements Repository {
  constructor(private readonly data: Record<string, unknown>) {}

  name(): string {
    return 'diagram-data.js';
  }

  async listDiagrams() {
    return (await readManifest(this)) ?? [];
  }

  loadFile(path: string) {
    return new EmbeddedFile(normPath(path), this.data);
  }
}

class EmbeddedFile extends TextFile {
  constructor(
    path: string,
    private readonly data: Record<string, unknown>,
  ) {
    super(path);
  }

  async readText(): Promise<string> {
    if (!(this.path in this.data)) throw new FileNotFoundError(this.path);
    return JSON.stringify(this.data[this.path]);
  }
}
