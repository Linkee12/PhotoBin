import { readItem, writeItem } from "../utils/storage";

/**
 * The albums this browser has opened, for the "your albums" list on the home
 * page. One localStorage record keyed by albumId; `url` is the full album URL
 * including the hash (the key), so it is stored, never rendered or logged.
 */
export type VisitedAlbum = {
  albumId: string;
  url: string;
  title: string;
  expiresAt: number | null;
  itemCount: number;
  visitedAt: number;
};

export const VISITED_STORAGE_KEY = "photobin:visited";

type Stored = Record<string, Omit<VisitedAlbum, "albumId">>;

function isEntry(value: unknown): value is Stored[string] {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.url === "string" &&
    typeof v.title === "string" &&
    (typeof v.expiresAt === "number" || v.expiresAt === null) &&
    typeof v.itemCount === "number" &&
    typeof v.visitedAt === "number"
  );
}

/** Malformed, missing or unreadable storage counts as empty. */
function read(storage: Storage): Stored {
  try {
    const parsed: unknown = JSON.parse(readItem(VISITED_STORAGE_KEY, storage) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isEntry(v)));
  } catch {
    return {};
  }
}

function write(storage: Storage, stored: Stored) {
  writeItem(VISITED_STORAGE_KEY, JSON.stringify(stored), storage);
}

/** Most recently visited first; albums past their expiry are left out. */
export function listVisitedAlbums(
  now = Date.now(),
  storage: Storage = localStorage,
): VisitedAlbum[] {
  return Object.entries(read(storage))
    .map(([albumId, entry]) => ({ albumId, ...entry }))
    .filter((album) => album.expiresAt === null || album.expiresAt >= now)
    .sort((a, b) => b.visitedAt - a.visitedAt);
}

export function rememberVisitedAlbum(
  album: Omit<VisitedAlbum, "visitedAt">,
  now = Date.now(),
  storage: Storage = localStorage,
): void {
  const { albumId, ...entry } = album;
  write(storage, { ...read(storage), [albumId]: { ...entry, visitedAt: now } });
}

export function forgetVisitedAlbum(
  albumId: string,
  storage: Storage = localStorage,
): void {
  const stored = read(storage);
  delete stored[albumId];
  write(storage, stored);
}

/**
 * Asks the browser not to evict this origin's storage under pressure, so the
 * list (and the resumable-upload records) outlive a low-disk cleanup. Best
 * effort: unsupported or refused is fine.
 */
export function requestPersistentStorage(): void {
  try {
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Not available in this context.
  }
}
