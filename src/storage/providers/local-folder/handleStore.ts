/**
 * Recuerda el handle de la carpeta en IndexedDB para no tener que volver a
 * elegirla: en la siguiente visita basta con conceder el permiso.
 * La clave incluye la ruta de la página, así cada copia del visor recuerda su carpeta.
 */
const DB = 'diagram-viewer';
const STORE = 'handles';
const KEY = 'dir:' + location.pathname;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function op<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((res, rej) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => res(req.result as T);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return undefined;
  }
}

export const handleStore = {
  get: () => op<FileSystemDirectoryHandle>('readonly', (s) => s.get(KEY)),
  set: (h: FileSystemDirectoryHandle) => op('readwrite', (s) => s.put(h, KEY)),
};
