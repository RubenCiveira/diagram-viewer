import { normPath } from '../../../diagram';
import type { AccessGate, Repository, Storage } from '../../Repository';
import { TextFile } from '../../TextFile';
import { readManifest } from '../../manifest';
import { HandleBackend, type FolderBackend } from './backends';
import { handleStore } from './handleStore';
import { createFolderAccessGate } from './ui/FolderAccessGate';

/**
 * Carpeta local abierta desde el propio navegador (página abierta con file://).
 * El control de acceso es el permiso de lectura de la carpeta: hasta que el
 * usuario lo concede, el gate impide continuar.
 */
export class LocalFolderStorage implements Storage {
  private backend: FolderBackend | null = null;
  private restoreAttempted = false;
  private readonly gate: AccessGate = createFolderAccessGate(this);

  static readonly supportsHandles = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  name(): string {
    return this.backend?.name ?? 'carpeta local';
  }

  gateComponent(): AccessGate {
    return this.gate;
  }

  listRepositories(): Repository[] {
    if (!this.backend) throw new Error('No hay ninguna carpeta abierta');
    return [new LocalFolderRepository(this.backend)];
  }

  /** Usa la carpeta indicada. Si es un handle, se recuerda para la próxima visita. */
  use(backend: FolderBackend, remember?: FileSystemDirectoryHandle) {
    this.backend = backend;
    if (remember) void handleStore.set(remember);
  }

  /** Carpeta recordada de una visita anterior (puede requerir volver a conceder permiso). */
  async rememberedHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (!LocalFolderStorage.supportsHandles) return null;
    return (await handleStore.get()) ?? null;
  }

  /**
   * Si la carpeta recordada sigue autorizada, la abre sin preguntar. Sólo se
   * intenta una vez: si el usuario vuelve al gate es para cambiar de carpeta.
   */
  async tryRestore(): Promise<boolean> {
    if (this.restoreAttempted) return false;
    this.restoreAttempted = true;
    const h = await this.rememberedHandle();
    if (!h) return false;
    try {
      if ((await h.queryPermission({ mode: 'read' })) !== 'granted') return false;
    } catch {
      return false;
    }
    this.use(new HandleBackend(h));
    return true;
  }

  /** Pide permiso sobre un handle (requiere un gesto del usuario) y lo abre si se concede. */
  async grant(h: FileSystemDirectoryHandle): Promise<boolean> {
    if ((await h.requestPermission({ mode: 'read' })) !== 'granted') return false;
    this.use(new HandleBackend(h), h);
    return true;
  }

  /** ¿La carpeta abierta contiene algún diagrama? */
  async hasDiagrams(): Promise<boolean> {
    return !!this.backend && (await new LocalFolderRepository(this.backend).listDiagrams()).length > 0;
  }
}

class LocalFolderRepository implements Repository {
  constructor(private readonly backend: FolderBackend) {}

  name(): string {
    return this.backend.name;
  }

  loadFile(path: string) {
    return new LocalFile(normPath(path), this.backend);
  }

  /**
   * Usa el índice si existe. Si no, recorre la carpeta: cada carpeta con un
   * index.json es un diagrama (salvo que esté dentro de otro, porque entonces es un subdiagrama).
   */
  async listDiagrams() {
    const manifest = await readManifest(this);
    if (manifest) return manifest;
    const dirs = (await this.backend.listFiles())
      .filter((p) => p.endsWith('/index.json'))
      .map((p) => p.slice(0, -'/index.json'.length))
      .sort();
    return dirs.filter((d) => !dirs.some((o) => o !== d && d.startsWith(o + '/'))).map((path) => ({ path }));
  }
}

class LocalFile extends TextFile {
  constructor(
    path: string,
    private readonly backend: FolderBackend,
  ) {
    super(path);
  }

  readText(): Promise<string> {
    return this.backend.readText(this.path);
  }
}
