/* Ein sehr kleiner IndexedDB-Zugriff — nur was gebraucht wird: einen Wert
   ablegen, einen Wert holen. localStorage waere einfacher, fasst aber je nach
   Browser nur 5 MB und wird synchron gelesen; der Rezeptkatalog ist zu gross
   dafuer und wuerde beim Start den Bildschirm blockieren. */

const DB_NAME = 'preply-v8';
const STORE = 'cache';
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB nicht verfügbar')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => { dbPromise = null; throw error; });
  return dbPromise;
}

function run(mode, work) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

/* Alle Aufrufer duerfen davon ausgehen, dass ein Fehlschlag kein Problem ist:
   ein Cache, den es nicht gibt, ist ein leerer Cache. Private Fenster und
   Browser mit abgeschalteter Speicherung landen genau hier. */
export async function idbGet(key) {
  try { return await run('readonly', (store) => store.get(key)); }
  catch { return null; }
}

export async function idbSet(key, value) {
  try { await run('readwrite', (store) => store.put(value, key)); return true; }
  catch { return false; }
}

export async function idbDelete(key) {
  try { await run('readwrite', (store) => store.delete(key)); return true; }
  catch { return false; }
}
