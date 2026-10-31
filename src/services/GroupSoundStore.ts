import { SoundDraft } from '../components/call/SoundEditorModal';

const DB_NAME = 'koaline-media';
const STORE_NAME = 'group-sounds';
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const getGroupSounds = async (communityId: string): Promise<SoundDraft[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(communityId);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as SoundDraft[] : []);
    request.onerror = () => reject(request.error);
  });
};

export const saveGroupSounds = async (communityId: string, sounds: SoundDraft[]) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(sounds, communityId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};
