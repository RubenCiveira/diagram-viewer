import './App.css';
import React from 'react';
import { Panel } from '@xyflow/react';
import { Eye, FolderOpen, Moon, RefreshCw, Sun } from 'lucide-react';
import { AppContext } from './AppContext';
import { useTheme } from './useTheme';
import { patchUrl, type Viewport } from './urlState';
import { runAction } from './actionRunner';
import { ErrorBanner, ErrorScreen, LoadingOverlay } from './ui';
import DiagramCanvas from '../diagram/ui/DiagramCanvas';
import DetailPanel from '../diagram/ui/DetailPanel';
import FileTree from '../diagram/ui/FileTree';
import HeaderPanel from '../diagram/ui/HeaderPanel';
import ActionDialog from '../diagram/ui/ActionDialog';
import { useDiagramNavigation } from '../diagram/useDiagramNavigation';
import PrintControl from '../print/PrintControl';
import { baseName, resolveAction, stripExt, type PreparedAction, type ViewModel, type ViewNode } from '../diagram';
import { findNodeType } from '../palette';
import type { DetailTarget, DiagramViewerContext } from '../palette/DiagramElementType';
import { ModularAppPalette } from '../palette/providers/modular-app';
import { resolveStorage, type DiagramEntry, type Repository, type Storage } from '../storage';

const palette = ModularAppPalette;

/** Id con el que la selección va en la URL (los ids de arista empiezan por "from:") */
const targetId = (t: DetailTarget | null) => (t ? (t.type === 'node' ? t.node.id : t.edge.id) : undefined);

function findTarget(view: ViewModel, id: string | undefined): DetailTarget | null {
  if (!id) return null;
  const node = view.nodes.find((n) => n.id === id);
  if (node) return { type: 'node', node };
  const edge = view.edges.find((e) => e.id === id);
  return edge ? { type: 'edge', edge } : null;
}

export default function App() {
  const { theme, toggle: toggleTheme, setOverride: setThemeOverride } = useTheme();
  const [storage, setStorage] = React.useState<Storage | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [repo, setRepo] = React.useState<Repository | null>(null);
  const [tree, setTree] = React.useState<{ entries: DiagramEntry[] | null; error?: string }>({ entries: null });
  const [detail, setDetailState] = React.useState<DetailTarget | null>(null);
  /** Nodo seleccionado en el lienzo: muestra el botón para activarlo */
  const [selected, setSelected] = React.useState<ViewNode | null>(null);
  // Los avisos pertenecen a una carga concreta: al navegar dejan de mostrarse
  const [notice, setNoticeState] = React.useState<{ message: string; loadId: number } | null>(null);
  /** Acción del nodo esperando a que se elijan sus variables */
  const [pendingAction, setPendingAction] = React.useState<{ action: PreparedAction; nodeId: string; nodeName: string } | null>(null);
  /** Raíz del visor: de aquí salen los eventos de las acciones (y burbujean hasta quien lo contenga) */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const nav = useDiagramNavigation(repo);
  const loadIdRef = React.useRef(nav.loadId);
  loadIdRef.current = nav.loadId;
  const setNotice = React.useCallback(
    (message: string | null) => setNoticeState(message ? { message, loadId: loadIdRef.current } : null),
    [],
  );

  // 1. Fuente de archivos según cómo se ha abierto la página
  React.useEffect(() => {
    resolveStorage().then((s) => {
      setStorage(s);
      setGateOpen(!!s.gateComponent());
    });
  }, []);

  // 2. Tras el control de acceso, el repositorio (la carpeta)
  React.useEffect(() => {
    if (!storage || gateOpen) return;
    Promise.resolve(storage.listRepositories())
      .then((repos) => setRepo(repos[0] ?? null))
      .catch((e) => setNotice(e?.message ?? String(e)));
  }, [storage, gateOpen, setNotice]);

  // 3. Lo que indique la URL: árbol o diagrama
  const { start } = nav;
  React.useEffect(() => {
    if (repo) void start();
  }, [repo, start]);

  // 4. Sin fichero seleccionado: árbol de diagramas de la fuente
  const showingTree = !!repo && !nav.file;
  React.useEffect(() => {
    if (!showingTree) return;
    let alive = true;
    setTree({ entries: null });
    repo!
      .listDiagrams()
      .then((entries) => alive && setTree({ entries }))
      .catch((e) => alive && setTree({ entries: [], error: e?.message ?? String(e) }));
    return () => {
      alive = false;
    };
  }, [showingTree, repo]);

  // La ficha abierta se recupera de la URL en cada carga (y se cierra al cambiar de diagrama)
  React.useEffect(() => {
    setDetailState(nav.view ? findTarget(nav.view, nav.restore.sel) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.loadId]);

  /** Abre o cierra la ficha y lo refleja en la URL */
  const setDetail = React.useCallback((t: DetailTarget | null) => {
    setDetailState(t);
    patchUrl({ sel: targetId(t) });
  }, []);

  const onViewportChange = React.useCallback((vp: Viewport) => patchUrl({ vp }), []);

  const changeFolder = React.useCallback(() => {
    setRepo(null);
    setGateOpen(true);
  }, []);

  const { open: openDiagram } = nav;
  const viewer: DiagramViewerContext = React.useMemo(
    () => ({ currentPath: nav.path, openDiagram, showDetail: setDetail }),
    [nav.path, openDiagram, setDetail],
  );

  const activateNode = React.useCallback(
    (node: ViewNode) => {
      const type = findNodeType(node.type, palette);
      // Nodo incluido con plantilla: abre su subdiagrama (su ficha se ve dentro)
      if (node.subdiagram) return openDiagram(node.subdiagram, type.label({ name: node.name, props: node.props }));
      if (type.open) Promise.resolve(type.open(node.props, node, viewer)).catch((e) => setNotice(e?.message ?? String(e)));
      else setDetail({ type: 'node', node });
    },
    [viewer, setDetail, setNotice, openDiagram],
  );

  const execute = React.useCallback(
    (action: PreparedAction, nodeId: string, chosen?: Record<string, string>) => {
      try {
        runAction(resolveAction(action, nodeId, chosen), rootRef.current ?? window);
      } catch (e: any) {
        setNotice(e?.message ?? String(e));
      }
    },
    [setNotice],
  );

  const onAction = React.useCallback(
    (action: PreparedAction, nodeId: string, nodeName: string) => {
      if (action.fields.length) setPendingAction({ action, nodeId, nodeName });
      else execute(action, nodeId);
    },
    [execute],
  );

  // Retroceso: al diagrama padre o, desde el raíz, al árbol
  const { back } = nav;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable], .dv-modal')) return;
      e.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  const onWarnings = React.useCallback(
    (w: string[]) => setNotice(w.length === 1 ? w[0] : `${w.length} avisos: ${w[0]}…`),
    [setNotice],
  );

  const context = React.useMemo(() => ({ palette, storage: storage ?? undefined, repository: repo ?? undefined }), [storage, repo]);

  const Gate = storage?.gateComponent();
  const actions = (withReload: boolean) => (
    <>
      {withReload && (
        <button className="dv-icon-btn" onClick={nav.reload} title="Recargar el diagrama">
          <RefreshCw size={15} />
        </button>
      )}
      {Gate && (
        <button className="dv-icon-btn" onClick={changeFolder} title="Abrir otra carpeta">
          <FolderOpen size={15} />
        </button>
      )}
      <button className="dv-icon-btn" onClick={toggleTheme} title="Cambiar tema">
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </>
  );

  let body: React.ReactNode;
  if (!storage) {
    body = <LoadingOverlay show />;
  } else if (gateOpen && Gate) {
    body = <Gate onReady={() => setGateOpen(false)} />;
  } else if (showingTree) {
    body = (
      <>
        <FileTree
          source={storage.name()}
          entries={tree.entries}
          error={tree.error ?? nav.error}
          onOpen={nav.selectFile}
          actions={actions(false)}
        />
        <LoadingOverlay show={nav.loading} />
      </>
    );
  } else if (!nav.view) {
    body = nav.error ? (
      <ErrorScreen
        message={nav.error}
        actions={
          <>
            <button className="dv-btn dv-btn-primary" onClick={() => void start()}>
              <RefreshCw size={16} /> Reintentar
            </button>
            <button className="dv-btn" onClick={nav.closeFile}>
              Ver los diagramas
            </button>
          </>
        }
      />
    ) : (
      <LoadingOverlay show />
    );
  } else {
    const current = nav.stack[nav.stack.length - 1];
    body = (
      <div className="dv-app">
        <DiagramCanvas
          key={nav.loadId}
          model={nav.view}
          palette={palette}
          colorMode={theme}
          onActivateNode={activateNode}
          onShowDetail={setDetail}
          onSelectNode={setSelected}
          onWarnings={onWarnings}
          initialViewport={nav.restore.vp}
          selectedId={nav.restore.sel}
          onViewportChange={onViewportChange}
        >
          <Panel position="top-left">
            <HeaderPanel
              title={nav.view.title ?? nav.labelOf(current) ?? stripExt(baseName(nav.path))}
              description={nav.view.description}
              crumbs={nav.stack.slice(0, -1).map((e) => ({ path: e.path, label: nav.labelOf(e) }))}
              onNavigate={nav.goTo}
              onHome={nav.closeFile}
              onBack={nav.back}
            />
          </Panel>
          <Panel position="top-right" className="dv-toolbar-stack">
            <div className="dv-panel dv-toolbar">
              <span className="dv-source" title={`Fuente: ${storage.name()} · ${nav.file}`}>
                <FolderOpen size={14} /> {nav.file}
              </span>
              <PrintControl
                view={nav.view}
                palette={palette}
                title={nav.view.title ?? nav.labelOf(current)}
                source={`${nav.file} › ${nav.path}`}
                setThemeOverride={setThemeOverride}
                onError={setNotice}
              />
              {actions(true)}
            </div>
            {selected && (
              <div className="dv-panel dv-toolbar">
                <button
                  className="dv-icon-btn"
                  onClick={() => activateNode(selected)}
                  title={selected.subdiagram ? 'Abrir el subdiagrama' : 'Ver el detalle'}
                  aria-label={selected.subdiagram ? 'Abrir el subdiagrama' : 'Ver el detalle'}
                >
                  <Eye size={15} />
                </button>
              </div>
            )}
          </Panel>
        </DiagramCanvas>
        <DetailPanel
          target={detail}
          model={nav.view}
          catalog={nav.catalog}
          path={nav.path}
          palette={palette}
          onClose={() => setDetail(null)}
          onOpenDiagram={openDiagram}
          onAction={onAction}
        />
        {pendingAction && (
          <ActionDialog
            action={pendingAction.action}
            nodeName={pendingAction.nodeName}
            onClose={() => setPendingAction(null)}
            onRun={(chosen) => {
              setPendingAction(null);
              execute(pendingAction.action, pendingAction.nodeId, chosen);
            }}
          />
        )}
        <LoadingOverlay show={nav.loading} />
        {(nav.error || notice?.loadId === nav.loadId) && (
          <ErrorBanner
            message={(nav.error ?? notice?.message)!}
            onClose={() => {
              setNotice(null);
              nav.clearError();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <AppContext.Provider value={context}>
      <div ref={rootRef} className="dv-root">
        {body}
      </div>
    </AppContext.Provider>
  );
}
