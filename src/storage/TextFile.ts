import { baseName, tryParseCatalog, tryParseDiagramModel, type CatalogModel, type DiagramModel } from '../diagram';
import type { FileStorage } from './Repository';

/** Base para ficheros de solo lectura que saben devolver su texto: el parseo es común. */
export abstract class TextFile implements FileStorage {
  constructor(protected readonly path: string) {}

  abstract readText(): Promise<string>;

  name(): string {
    return baseName(this.path);
  }

  fullName(): string {
    return this.path;
  }

  isWritable(): boolean {
    return false;
  }

  private async readJson(): Promise<unknown> {
    const text = await this.readText();
    try {
      return JSON.parse(text);
    } catch (e: any) {
      throw new Error(`JSON inválido en «${this.path}»: ${e?.message ?? e}`);
    }
  }

  async read(): Promise<DiagramModel> {
    const parsed = tryParseDiagramModel(await this.readJson());
    if (!parsed.ok) throw new Error(`«${this.path}» no es un diagrama válido: ${parsed.error}`);
    return parsed.data;
  }

  async readCatalog(): Promise<CatalogModel> {
    const parsed = tryParseCatalog(await this.readJson());
    if (!parsed.ok) throw new Error(`«${this.path}» no es un catálogo válido: ${parsed.error}`);
    return parsed.data;
  }
}
