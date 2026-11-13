export type Bike = {
  id: string; name: string; brand: string; model: string;
  capacityWh: number; usualRangeKm: number; consumptionWhKm: number;
  chargePercent: number;
  chargeLeds?: number;
}
export type SavedRoute = {
  id: string; name: string; distanceKm: number; ascentM: number;
  durationMin: number; coordinates: [number, number][];
  source: 'valhalla' | 'demo'; createdAt: string; notes?: string;
}
export type Ride = {
  id: string; name: string; date: string; distanceKm: number;
  durationMin: number; ascentM: number; coordinates: [number, number][];
  notes: string; photo?: string; bikeCharges?: number[];
}
type StoreName = 'bikes' | 'routes' | 'rides' | 'settings'
const DB_NAME = 'velo-libre-db';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ['bikes', 'routes', 'rides', 'settings']) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function all<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}
export async function put<T extends {id: string}>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function remove(store: StoreName, id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearAndRestore(data: {bikes: Bike[]; routes: SavedRoute[]; rides: Ride[]}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['bikes', 'routes', 'rides'], 'readwrite');
  for (const [store, values] of Object.entries(data)) {
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    values.forEach(value => objectStore.put(value));
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
