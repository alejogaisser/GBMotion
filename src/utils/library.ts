import type { ProjectState } from './project';
import type { LayerAnimation, TypographySettings } from '../types/motion';

export type LibraryEntry = { id: string; name: string; savedAt: number } & (
  { kind: 'project'; project: Omit<ProjectState, 'version'> } |
  { kind: 'kit'; typography: TypographySettings; animation: LayerAnimation }
);
function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gb-motion-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function libraryOperation(operation: 'list' | 'save' | 'delete', payload?: LibraryEntry | string): Promise<LibraryEntry[]> {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('entries', operation === 'list' ? 'readonly' : 'readwrite');
      const entries = tx.objectStore('entries');
      if (operation === 'save') entries.put(payload);
      if (operation === 'delete') entries.delete(payload as string);
      const list = entries.getAll();
      tx.oncomplete = () => resolve((list.result as LibraryEntry[]).sort((a, b) => b.savedAt - a.savedAt));
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
