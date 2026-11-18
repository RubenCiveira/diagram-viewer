import type { ComponentType } from 'react';
import type { CatalogModel, DiagramModel } from '../diagram';

/* ============================================================================
 * Control de acceso
 *
 * Un "gate" es la pantalla que se muestra antes de poder leer nada: login,
 * permiso de lectura de una carpeta, etc. Llama a `onReady` cuando el acceso
 * está concedido. Un Storage sin requisitos devuelve `null`.
 * ==========================================================================*/
export type AccessGateProps = { onReady: () => void };
export type AccessGate = ComponentType<AccessGateProps>;

/* ============================================================================
 * Fuente de archivos
 * ==========================================================================*/
export interface Storage {
  /** Nombre visible de la fuente (p. ej. el nombre de la carpeta) */
  name(): string;
  /** Pantalla de acceso previa, o null si no hace falta */
  gateComponent(): AccessGate | null;
  listRepositories(): Repository[] | Promise<Repository[]>;
}

/** Un diagrama disponible en la fuente (carpeta con index.json o fichero .json) */
export type DiagramEntry = {
  /** Ruta relativa a la raíz del repositorio */
  path: string;
  name?: string;
  description?: string;
};

export interface Repository {
  name(): string;
  /** Diagramas que se pueden abrir (para el árbol inicial) */
  listDiagrams(): Promise<DiagramEntry[]>;
  /** Devuelve el fichero de la ruta indicada (relativa a la raíz), o null si no existe */
  loadFile(path: string): FileStorage | null | Promise<FileStorage | null>;
}

export interface FileStorage {
  name(): string;
  /** Ruta relativa a la raíz del repositorio */
  fullName(): string;
  isWritable(): boolean | Promise<boolean>;
  read(): DiagramModel | Promise<DiagramModel>;
  /** Lee el fichero como catálogo de nodos y relaciones */
  readCatalog(): CatalogModel | Promise<CatalogModel>;
  /** Contenido en bruto (fichas en Markdown, etc.) */
  readText(): Promise<string>;
}

export class FileNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`No se encuentra el fichero «${path}»`);
  }
}
