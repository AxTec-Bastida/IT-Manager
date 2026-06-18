export type OfflinePhotoBlobRecord = {
  clientActionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  blob: Blob;
};

export type OfflinePhotoBlobMetadata = Omit<OfflinePhotoBlobRecord, "blob">;

const dbName = "warehouse-it-offline-photo-blobs-v1";
const storeName = "photos";

export async function saveOfflinePhotoBlob(clientActionId: string, file: File) {
  const db = await openPhotoDb();
  const record: OfflinePhotoBlobRecord = {
    clientActionId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  await runStoreRequest(db, "readwrite", (store) => store.put(record));
  db.close();
  return record;
}

export async function getOfflinePhotoBlob(clientActionId: string) {
  const db = await openPhotoDb();
  const record = await runStoreRequest<OfflinePhotoBlobRecord | undefined>(db, "readonly", (store) => store.get(clientActionId));
  db.close();
  return record ?? null;
}

export async function deleteOfflinePhotoBlob(clientActionId: string) {
  const db = await openPhotoDb();
  await runStoreRequest(db, "readwrite", (store) => store.delete(clientActionId));
  db.close();
}

export async function deleteOfflinePhotoBlobs(clientActionIds: string[]) {
  const uniqueIds = Array.from(new Set(clientActionIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete offline photo blobs."));
    tx.oncomplete = () => resolve();
    const store = tx.objectStore(storeName);
    uniqueIds.forEach((id) => store.delete(id));
  });
  db.close();
}

export async function listOfflinePhotoBlobMetadata() {
  const db = await openPhotoDb();
  const records = await runStoreRequest<OfflinePhotoBlobRecord[]>(db, "readonly", (store) => store.getAll());
  db.close();
  return records.map((record) => ({
    clientActionId: record.clientActionId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
  }));
}

export function supportsOfflinePhotoBlobs() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openPhotoDb() {
  if (!supportsOfflinePhotoBlobs()) return Promise.reject(new Error("Offline photo storage is not available in this browser."));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "clientActionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline photo storage."));
  });
}

function runStoreRequest<T = unknown>(db: IDBDatabase, mode: IDBTransactionMode, makeRequest: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = makeRequest(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error("Offline photo storage request failed."));
    tx.onerror = () => reject(tx.error ?? new Error("Offline photo storage transaction failed."));
  });
}
