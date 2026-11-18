import { FileNotFoundError } from '../../Repository';

/** Origen físico de una carpeta local ya autorizada. */
export interface FolderBackend {
  readonly name: string;
  readText(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  /** Rutas de todos los ficheros (recursivo, sin carpetas ocultas ni node_modules) */
  listFiles(): Promise<string[]>;
}

const skip = (name: string) => name.startsWith('.') || name === 'node_modules';

/** Carpeta abierta con la File System Access API (Chrome / Edge). */
export class HandleBackend implements FolderBackend {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  get name() {
    return this.root.name;
  }

  private async file(path: string): Promise<File> {
    const parts = path.split('/');
    try {
      let dir = this.root;
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
      return await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    } catch (e: any) {
      if (e?.name === 'NotFoundError' || e?.name === 'TypeMismatchError') throw new FileNotFoundError(path);
      if (e?.name === 'NotAllowedError') throw new Error('El navegador ha retirado el permiso de lectura. Vuelve a abrir la carpeta.');
      throw e;
    }
  }

  async readText(path: string) {
    return (await this.file(path)).text();
  }

  async exists(path: string) {
    try {
      await this.file(path);
      return true;
    } catch (e) {
      if (e instanceof FileNotFoundError) return false;
      throw e;
    }
  }

  async listFiles() {
    const out: string[] = [];
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
      for await (const [name, h] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (skip(name)) continue;
        if (h.kind === 'directory') await walk(h as FileSystemDirectoryHandle, prefix + name + '/');
        else out.push(prefix + name);
      }
    };
    await walk(this.root, '');
    return out;
  }
}

/** Ficheros sueltos obtenidos de <input webkitdirectory> o de arrastrar la carpeta (Firefox / Safari). */
export class FilesBackend implements FolderBackend {
  constructor(
    readonly name: string,
    private readonly files: Map<string, File>,
  ) {}

  /** Construye el backend desde un <input webkitdirectory>: las rutas incluyen la carpeta raíz, que se elimina. */
  static fromInput(list: FileList): FilesBackend {
    const files = [...list];
    const map = new Map<string, File>();
    for (const f of files) map.set(f.webkitRelativePath.split('/').slice(1).join('/'), f);
    return new FilesBackend(files[0]?.webkitRelativePath.split('/')[0] ?? 'carpeta', map);
  }

  /** Construye el backend recorriendo una carpeta arrastrada (API de entries, disponible en todos los navegadores). */
  static async fromEntry(dir: FileSystemDirectoryEntry): Promise<FilesBackend> {
    const map = new Map<string, File>();
    const walk = async (d: FileSystemDirectoryEntry, prefix: string): Promise<void> => {
      const reader = d.createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const en of batch) {
          if (skip(en.name)) continue;
          if (en.isDirectory) await walk(en as FileSystemDirectoryEntry, prefix + en.name + '/');
          else map.set(prefix + en.name, await new Promise<File>((res, rej) => (en as FileSystemFileEntry).file(res, rej)));
        }
      }
    };
    await walk(dir, '');
    return new FilesBackend(dir.name, map);
  }

  async readText(path: string) {
    const f = this.files.get(path);
    if (!f) throw new FileNotFoundError(path);
    return f.text();
  }

  async exists(path: string) {
    return this.files.has(path);
  }

  async listFiles() {
    return [...this.files.keys()].filter((p) => !p.split('/').some(skip));
  }
}
