/**
 * The pinched column count of the album grid, remembered per orientation in
 * `localStorage` (`photobin:columns:portrait` / `photobin:columns:landscape`).
 * A phone turned sideways wants its own count, so the two never mix.
 */

export type Orientation = "portrait" | "landscape";

type ColumnsStorage = Pick<Storage, "getItem" | "setItem">;

function keyFor(orientation: Orientation) {
  return `photobin:columns:${orientation}`;
}

/** The stored count, or `null` when there is none, it is not a positive integer, or storage is unavailable. */
export function readStoredColumns(
  orientation: Orientation,
  storage: ColumnsStorage = localStorage,
): number | null {
  try {
    const stored = storage.getItem(keyFor(orientation));
    if (stored === null) return null;
    const columns = Number(stored);
    return Number.isInteger(columns) && columns > 0 ? columns : null;
  } catch {
    return null;
  }
}

export function storeColumns(
  orientation: Orientation,
  columns: number,
  storage: ColumnsStorage = localStorage,
) {
  try {
    storage.setItem(keyFor(orientation), String(columns));
  } catch {
    // Remembering the count is a convenience; ignore storage errors.
  }
}
