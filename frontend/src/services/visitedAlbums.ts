// Minimal stand-in for workstream A's visited-albums store: the merge keeps
// A's file, which exports the same `forgetVisitedAlbum` signature.

export const VISITED_STORAGE_KEY = "photobin:visited";

/** Drops the album from the visited list; storage errors are ignored. */
export function forgetVisitedAlbum(albumId: string, storage: Storage = localStorage) {
  try {
    const raw = storage.getItem(VISITED_STORAGE_KEY);
    if (raw === null) return;
    const visited: unknown = JSON.parse(raw);
    if (typeof visited !== "object" || visited === null) return;
    delete (visited as Record<string, unknown>)[albumId];
    storage.setItem(VISITED_STORAGE_KEY, JSON.stringify(visited));
  } catch {
    // Forgetting is best effort.
  }
}
