import { openDB } from 'idb';

const DB_NAME = 'nexora-offline-db';
const STORE_NAME = 'pending-actions';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    },
  });
}

export async function queueAction(method: string, url: string, payload: any) {
  const db = await getDB();
  await db.add(STORE_NAME, { method, url, payload });
  
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register('sync-actions');
    }
  }
}
