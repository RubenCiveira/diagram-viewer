import React from 'react';
import { ChevronDown, ChevronRight, Folder, Layers } from 'lucide-react';
import type { DiagramEntry } from '../../storage';

type Props = {
  /** Nombre de la fuente (carpeta u host) */
  source: string;
  entries: DiagramEntry[] | null;
  error?: string | null;
  onOpen: (path: string) => void;
  /** Acciones de la cabecera (cambiar carpeta, tema…) */
  actions?: React.ReactNode;
};

type TreeFolder = { name: string; path: string; folders: TreeFolder[]; diagrams: DiagramEntry[] };

/** Agrupa las rutas en carpetas: public/e-commerce → public › e-commerce */
function buildTree(entries: DiagramEntry[]): TreeFolder {
  const root: TreeFolder = { name: '', path: '', folders: [], diagrams: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      const path = folder.path ? `${folder.path}/${part}` : part;
      let next = folder.folders.find((f) => f.name === part);
      if (!next) folder.folders.push((next = { name: part, path, folders: [], diagrams: [] }));
      folder = next;
    }
    folder.diagrams.push(entry);
  }
  const sort = (f: TreeFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.diagrams.sort((a, b) => a.path.localeCompare(b.path));
    f.folders.forEach(sort);
  };
  sort(root);
  return root;
}

/** Pantalla inicial: árbol de los diagramas que ofrece la fuente. */
export default function FileTree({ source, entries, error, onOpen, actions }: Props) {
  const tree = React.useMemo(() => (entries ? buildTree(entries) : null), [entries]);
  return (
    <div className="dv-gate">
      <div className="dv-gate-card dv-tree-card">
        <header className="dv-tree-head">
          <div>
            <h1>Diagramas</h1>
            <div className="dv-muted">{source}</div>
          </div>
          {actions && <div className="dv-tree-actions">{actions}</div>}
        </header>
        {error && <div className="dv-gate-error">{error}</div>}
        {!tree && !error && <p className="dv-muted">Cargando…</p>}
        {tree && !entries!.length && (
          <p className="dv-muted">
            No hay diagramas. Añádelos al <code>index.json</code> de la raíz: <code>{'{ "diagrams": [ { "path": "carpeta" } ] }'}</code>
          </p>
        )}
        {tree && <FolderView folder={tree} depth={0} onOpen={onOpen} />}
      </div>
    </div>
  );
}

function FolderView({ folder, depth, onOpen }: { folder: TreeFolder; depth: number; onOpen: (path: string) => void }) {
  return (
    <ul className="dv-tree" role={depth ? 'group' : 'tree'}>
      {folder.folders.map((f) => (
        <FolderItem key={f.path} folder={f} depth={depth} onOpen={onOpen} />
      ))}
      {folder.diagrams.map((d) => (
        <li key={d.path} role="treeitem">
          <button className="dv-tree-row dv-tree-diagram" style={{ paddingLeft: 10 + depth * 18 }} onClick={() => onOpen(d.path)}>
            <Layers size={16} className="dv-tree-icon" />
            <span className="dv-tree-text">
              <span className="dv-tree-name">
                {d.path.split('/').pop()}
                {d.name && <span className="dv-muted"> · {d.name}</span>}
              </span>
              {d.description && <span className="dv-tree-desc">{d.description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FolderItem({ folder, depth, onOpen }: { folder: TreeFolder; depth: number; onOpen: (path: string) => void }) {
  const [open, setOpen] = React.useState(true);
  return (
    <li role="treeitem" aria-expanded={open}>
      <button className="dv-tree-row" style={{ paddingLeft: 10 + depth * 18 }} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={16} className="dv-tree-icon" />
        <span className="dv-tree-name">{folder.name}</span>
      </button>
      {open && <FolderView folder={folder} depth={depth + 1} onOpen={onOpen} />}
    </li>
  );
}
