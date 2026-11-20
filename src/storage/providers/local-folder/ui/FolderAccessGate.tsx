import React from 'react';
import { FolderOpen, FolderSearch, Upload } from 'lucide-react';
import type { AccessGate, AccessGateProps } from '../../../Repository';
import { MANIFEST_FILE } from '../../../manifest';
import { FilesBackend, HandleBackend } from '../backends';
import type { LocalFolderStorage } from '../LocalFolderStorage';

type Phase = 'checking' | 'choose';

/** Crea el gate ligado a una instancia de storage (identidad estable para React). */
export function createFolderAccessGate(storage: LocalFolderStorage): AccessGate {
  return function FolderGate(props: AccessGateProps) {
    return <FolderAccessGate storage={storage} {...props} />;
  };
}

function FolderAccessGate({ storage, onReady }: AccessGateProps & { storage: LocalFolderStorage }) {
  const [phase, setPhase] = React.useState<Phase>('checking');
  const [remembered, setRemembered] = React.useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  /** Comprueba que la carpeta elegida es la de los diagramas antes de dejar pasar. */
  const finish = React.useCallback(async () => {
    if (await storage.hasDiagrams()) {
      onReady();
    } else {
      setError(`No encuentro diagramas en «${storage.name()}» (ni ${MANIFEST_FILE} ni carpetas con index.json). Elige la carpeta de diagramas.`);
      setPhase('choose');
    }
  }, [storage, onReady]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (await storage.tryRestore()) {
        if (alive) await finish();
        return;
      }
      const h = await storage.rememberedHandle();
      if (!alive) return;
      setRemembered(h);
      setPhase('choose');
    })();
    return () => {
      alive = false;
    };
  }, [storage, finish]);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e: any) => {
      if (e?.name !== 'AbortError') setError(e?.message ?? String(e));
    });
  };

  const reopen = () =>
    run(async () => {
      if (remembered && (await storage.grant(remembered))) await finish();
    });

  const pick = () =>
    run(async () => {
      if (!window.showDirectoryPicker) {
        inputRef.current?.click();
        return;
      }
      const h = await window.showDirectoryPicker({ id: 'diagram-viewer', mode: 'read' });
      storage.use(new HandleBackend(h), h);
      await finish();
    });

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    run(async () => {
      storage.use(FilesBackend.fromInput(files));
      e.target.value = '';
      await finish();
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const item = [...e.dataTransfer.items].find((i) => i.kind === 'file');
    if (!item) return;
    // Ambas llamadas deben hacerse de forma síncrona dentro del evento.
    const handleP = 'getAsFileSystemHandle' in item ? (item as any).getAsFileSystemHandle() : null;
    const entry = item.webkitGetAsEntry();
    run(async () => {
      const h = handleP ? await handleP : null;
      if (h?.kind === 'directory') storage.use(new HandleBackend(h), h);
      else if (entry?.isDirectory) storage.use(await FilesBackend.fromEntry(entry as FileSystemDirectoryEntry));
      else throw new Error('Arrastra la carpeta de diagramas, no un fichero suelto.');
      await finish();
    });
  };

  if (phase === 'checking') return null;

  const here =
    location.protocol === 'file:'
      ? decodeURIComponent(location.pathname.replace(/[^/]*$/, ''))
      : location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');

  return (
    <div
      className={`dv-gate${dragging ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="dv-gate-card">
        <div className="dv-gate-logo" aria-hidden>
          <span />
          <i />
          <span />
          <i />
          <span />
        </div>
        <h1>Visor de diagramas</h1>
        <p>
          Para mostrar los diagramas, el navegador necesita permiso para leer la carpeta donde está este fichero (la que
          contiene <code>{MANIFEST_FILE}</code>):
        </p>
        <div className="dv-gate-path">{here}</div>
        {error && <div className="dv-gate-error">{error}</div>}
        <div className="dv-gate-buttons">
          {remembered && (
            <button className="dv-btn dv-btn-primary" onClick={reopen}>
              <FolderOpen size={16} /> Abrir «{remembered.name}»
            </button>
          )}
          <button className={`dv-btn${remembered ? '' : ' dv-btn-primary'}`} onClick={pick}>
            <FolderSearch size={16} /> Seleccionar carpeta…
          </button>
        </div>
        <p className="dv-gate-hint">
          <Upload size={13} /> También puedes arrastrar la carpeta a esta ventana.
        </p>
        <details>
          <summary>Abrir sin pedir permisos</summary>
          <p>
            Con doble clic: genera <code>diagram-data.js</code> junto a este fichero (y vuelve a generarlo cuando cambien los
            diagramas):
          </p>
          <pre>{'pnpm run pack-data carpeta-de-diagramas'}</pre>
          <p>O sirve la carpeta por HTTP y el visor lee los ficheros directamente:</p>
          <pre>{'cd carpeta-de-diagramas\npython3 -m http.server 8000\n# http://localhost:8000/diagram-viewer.html'}</pre>
        </details>
        <input ref={inputRef} type="file" hidden multiple onChange={onInput} {...{ webkitdirectory: '' }} />
      </div>
    </div>
  );
}
