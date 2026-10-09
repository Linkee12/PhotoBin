/**
 * `localStorage` that never throws: everything stored through it is a
 * convenience (a remembered view, column count, visited albums), so a blocked
 * or full storage reads as empty and writes are dropped.
 */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function readItem(key: string, storage: KeyValueStorage = localStorage) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(
  key: string,
  value: string,
  storage: KeyValueStorage = localStorage,
) {
  try {
    storage.setItem(key, value);
  } catch {
    // Dropped on purpose (see above).
  }
}
