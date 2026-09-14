import { KeyValueStorage, readItem, writeItem } from "../../../utils/storage";

/**
 * The pinched column count of the album grid, remembered per orientation in
 * `localStorage` (`photobin:columns:portrait` / `photobin:columns:landscape`).
 * A phone turned sideways wants its own count, so the two never mix.
 */
export type Orientation = "portrait" | "landscape";

/** The stored count, or `null` when there is none, it is not a positive integer, or storage is unavailable. */
export function readStoredColumns(
  orientation: Orientation,
  storage: KeyValueStorage = localStorage,
): number | null {
  const columns = Number(readItem(`photobin:columns:${orientation}`, storage));
  return Number.isInteger(columns) && columns > 0 ? columns : null;
}

export function storeColumns(
  orientation: Orientation,
  columns: number,
  storage: KeyValueStorage = localStorage,
) {
  writeItem(`photobin:columns:${orientation}`, String(columns), storage);
}
