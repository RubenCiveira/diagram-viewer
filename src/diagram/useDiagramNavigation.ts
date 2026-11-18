import React from 'react';
import { readUrl, writeUrl, type Viewport } from '../app/urlState';
import { FileNotFoundError, type Repository } from '../storage';
import { diagramFileOf } from '../storage/manifest';
import { CATALOG_FILE, INLINE_SEP, type DiagramModel } from './model';
import { baseName, resolvePath, stripExt } from './paths';
import { CatalogIndex, resolveDiagram, usesCatalog, type ViewModel } from './resolve';

/** Un diagrama en la ruta de navegación. `title` es la etiqueta del nodo desde el que se abrió. */
export type NavEntry = { path: string; title?: string };

/** Selección y encuadre que hay que recuperar al mostrar una carga (vienen de la URL) */
export type Restore = { sel?: string; vp?: Viewport };

type State = {
  /** Diagrama elegido en el árbol (null = mostrar el árbol) */
  file: string | null;
  stack: NavEntry[];
  model: DiagramModel | null;
  /** Diagrama con las referencias al catálogo ya aplicadas */
  view: ViewModel | null;
  /** Catálogo usado para resolver `view` (null si el diagrama no tiene referencias o no se pudo cargar) */
  catalog: CatalogIndex | null;
  restore: Restore;
  /** Cambia en cada carga correcta (sirve de `key` para reiniciar el lienzo) */
  loadId: number;
  loading: boolean;
  error: string | null;
};

type History = 'push' | 'replace' | 'none';
/** `stale`: otra carga posterior la ha sustituido (no es un error) */
type LoadResult = 'ok' | 'error' | 'stale';

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');

/** Ruta de un subdiagrama tal como va en la URL: relativa a la carpeta del raíz, o absoluta con '/' si sale de ella. */
function toUrlPath(rootPath: string, path: string): string {
  const dir = dirOf(rootPath);
  return path.startsWith(dir) ? path.slice(dir.length) : `/${path}`;
}

/** Fichero seleccionado y pila de diagramas abiertos: raíz → subdiagrama → … */
export function useDiagramNavigation(repo: Repository | null) {
  const [state, setState] = React.useState<State>({
    file: null,
    stack: [],
    model: null,
    view: null,
    catalog: null,
    restore: {},
    loadId: 0,
    loading: false,
    error: null,
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const titles = React.useRef(new Map<string, string>());
  const request = React.useRef(0);

  /** Lee un diagrama. `fichero::a::b` es el subdiagrama `b` definido dentro del nodo `a` de ese fichero. */
  const readModel = React.useCallback(
    async (path: string): Promise<DiagramModel> => {
      const [filePath, ...inline] = path.split(INLINE_SEP);
      const file = await repo!.loadFile(filePath);
      if (!file) throw new FileNotFoundError(filePath);
      let model = await file.read();
      let title = model.title;
      for (const id of inline) {
        const node = model.nodes.find((n) => n.id === id && n.diagram);
        if (!node) throw new Error(`No existe el subdiagrama «${id}» dentro de «${filePath}»`);
        model = node.diagram!;
        title = model.title ?? node.name ?? id;
      }
      if (title) titles.current.set(path, title);
      return title && !model.title ? { ...model, title } : model;
    },
    [repo],
  );

  /**
   * Cada carpeta de diagrama tiene su propio catálogo, junto a su diagrama raíz
   * (public/portal/catalog.json). Los subdiagramas usan el de su raíz aunque
   * estén en subcarpetas. Se lee una vez por carpeta (y de nuevo al recargar).
   */
  const catalogCache = React.useRef(new Map<string, Promise<{ index: CatalogIndex | null; error?: string }>>());
  React.useEffect(() => {
    catalogCache.current.clear();
  }, [repo]);
  const readCatalog = React.useCallback(
    (path: string) => {
      let cached = catalogCache.current.get(path);
      if (!cached) {
        cached = (async () => {
          try {
            const file = await repo!.loadFile(path);
            if (!file) return { index: null, error: `No existe ${path}` };
            return { index: new CatalogIndex(await file.readCatalog()) };
          } catch (e: any) {
            return { index: null, error: e instanceof FileNotFoundError ? `No existe ${path}` : (e?.message ?? String(e)) };
          }
        })();
        catalogCache.current.set(path, cached);
      }
      return cached;
    },
    [repo],
  );

  const load = React.useCallback(
    async (file: string, stack: NavEntry[], history: History, restore: Restore = {}, fresh = false): Promise<LoadResult> => {
      if (!repo || !stack.length) return 'stale';
      const req = ++request.current;
      setState((s) => ({ ...s, loading: true }));
      try {
        const model = await readModel(stack[stack.length - 1].path);
        const catalogPath = dirOf(stack[0].path) + CATALOG_FILE;
        if (fresh) catalogCache.current.delete(catalogPath);
        const { index: catalog, error: catalogError } = usesCatalog(model) ? await readCatalog(catalogPath) : { index: null };
        if (req !== request.current) return 'stale';
        const view = resolveDiagram(model, catalog);
        if (catalogError) view.warnings.unshift(`Catálogo: ${catalogError}`);
        if (history !== 'none') {
          const diagrams = stack.slice(1).map((e) => toUrlPath(stack[0].path, e.path));
          writeUrl({ file, diagrams, sel: restore.sel, vp: restore.vp }, history);
        }
        setState((s) => ({ file, stack, model, view, catalog, restore, loadId: s.loadId + 1, loading: false, error: null }));
        // Títulos de los diagramas padre que no se han cargado (al entrar por un enlace)
        for (const e of stack.slice(0, -1)) {
          if (e.title || titles.current.has(e.path)) continue;
          readModel(e.path)
            .then(() => setState((s) => ({ ...s })))
            .catch(() => undefined);
        }
        return 'ok';
      } catch (e: any) {
        if (req !== request.current) return 'stale';
        setState((s) => ({ ...s, loading: false, error: e?.message ?? String(e) }));
        return 'error';
      }
    },
    [repo, readModel, readCatalog],
  );

  /** Muestra el árbol de diagramas */
  const showTree = React.useCallback((history: History) => {
    request.current++;
    if (history !== 'none') writeUrl({ diagrams: [] }, history);
    setState((s) => ({ ...s, file: null, stack: [], model: null, view: null, catalog: null, restore: {}, loading: false, error: null }));
  }, []);

  /**
   * Aplica lo que diga la URL: sin `file`, el árbol; con `file`, su diagrama,
   * los subdiagramas abiertos, la selección y el encuadre. Si un subdiagrama
   * del enlace ya no existe, se queda en el raíz.
   */
  const syncFromUrl = React.useCallback(
    async (history: 'replace' | 'none', fresh = false) => {
      const url = readUrl();
      if (!url.file) return showTree('none');
      const root = diagramFileOf(url.file);
      let stack: NavEntry[];
      try {
        stack = [{ path: root }, ...url.diagrams.map((d) => ({ path: resolvePath(root, d) }))];
      } catch {
        stack = [{ path: root }];
      }
      const restore = { sel: url.sel, vp: url.vp };
      if ((await load(url.file, stack, history, restore, fresh)) === 'error' && stack.length > 1) {
        await load(url.file, stack.slice(0, 1), 'replace');
      }
    },
    [load, showTree],
  );

  React.useEffect(() => {
    if (!repo) return;
    const onPop = () => void syncFromUrl('none');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [repo, syncFromUrl]);

  /** Abre un diagrama del árbol */
  const selectFile = React.useCallback(
    (file: string) => void load(file, [{ path: diagramFileOf(file) }], 'push'),
    [load],
  );

  /** Abre un diagrama relativo al actual */
  const open = React.useCallback(
    (rel: string, title?: string) => {
      const { stack, file } = stateRef.current;
      if (!file || !stack.length) return;
      const base = stack[stack.length - 1].path;
      let path: string;
      try {
        // `::id`: subdiagrama definido dentro del diagrama actual
        path = rel.startsWith(INLINE_SEP) ? base + rel : resolvePath(base.split(INLINE_SEP)[0], rel);
      } catch (e: any) {
        setState((s) => ({ ...s, error: e.message }));
        return;
      }
      void load(file, [...stack, { path, title }], 'push');
    },
    [load],
  );
  /** Vuelve al diagrama `index` de la pila */
  const goTo = React.useCallback(
    (index: number) => {
      const { stack, file } = stateRef.current;
      if (file) void load(file, stack.slice(0, index + 1), 'push');
    },
    [load],
  );
  /** Al diagrama padre o, desde el raíz, al árbol */
  const back = React.useCallback(() => {
    const { stack, file } = stateRef.current;
    if (!file) return;
    if (stack.length > 1) void load(file, stack.slice(0, -1), 'push');
    else showTree('push');
  }, [load, showTree]);
  const closeFile = React.useCallback(() => showTree('push'), [showTree]);
  /** Vuelve a leer los ficheros conservando selección y encuadre */
  const reload = React.useCallback(() => void syncFromUrl('none', true), [syncFromUrl]);
  const start = React.useCallback(() => syncFromUrl('replace'), [syncFromUrl]);
  const clearError = React.useCallback(() => setState((s) => ({ ...s, error: null })), []);
  /** Etiqueta para las migas de pan */
  const labelOf = React.useCallback(
    (e: NavEntry) => e.title ?? titles.current.get(e.path) ?? (e.path.includes(INLINE_SEP) ? e.path.split(INLINE_SEP).pop()! : stripExt(baseName(e.path))),
    [],
  );

  const current = state.stack[state.stack.length - 1];
  return {
    ...state,
    path: current?.path ?? '',
    start,
    selectFile,
    closeFile,
    open,
    goTo,
    back,
    reload,
    clearError,
    labelOf,
  };
}
