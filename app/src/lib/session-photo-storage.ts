const DATABASE_NAME = "photobooth-session";
const DATABASE_VERSION = 1;
const STORE_NAME = "photos";

type PhotoRecord = {
  sessionId: string;
  photos: string[];
  chosen?: number[];
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("Gagal membuka IndexedDB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
  });
}

export async function saveSessionPhotos(
  sessionId: string,
  photos: string[],
  chosen?: number[]
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ sessionId, photos, chosen } satisfies PhotoRecord);
    transaction.onerror = () => reject(transaction.error || new Error("Gagal menyimpan foto"));
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

export async function getSessionPhotos(sessionId: string): Promise<PhotoRecord | null> {
  const database = await openDatabase();
  const record = await new Promise<PhotoRecord | undefined>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(sessionId);
    request.onerror = () => reject(request.error || new Error("Gagal membaca foto"));
    request.onsuccess = () => resolve(request.result as PhotoRecord | undefined);
  });
  database.close();
  return record || null;
}

export async function clearSessionPhotos(sessionId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(sessionId);
    transaction.onerror = () => reject(transaction.error || new Error("Gagal menghapus foto"));
    transaction.oncomplete = () => resolve();
  });
  database.close();
}
