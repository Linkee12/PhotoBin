/**
 * The Google Photos REST calls PhotoBin makes, straight from the browser (the
 * endpoints answer CORS preflights). Import goes through the Picker API — the
 * user picks in Google's own UI, the app only ever sees what was picked — and
 * the picked bytes are fed into the normal upload, so they are encrypted like
 * any local file. Save uploads decrypted files with the append-only Library
 * scope: that copy is plaintext in the user's Google account.
 */
import { sleep } from "../../../../utils/retry";

const PICKER_API = "https://photospicker.googleapis.com/v1";
const LIBRARY_API = "https://photoslibrary.googleapis.com/v1";
const PICKED_PAGE_SIZE = 100;
/** `mediaItems.batchCreate` takes at most this many items per call. */
export const BATCH_CREATE_LIMIT = 50;
const DEFAULT_POLL_MS = 3000;
/** Album titles longer than this are rejected by the Library API. */
const ALBUM_TITLE_LIMIT = 500;

export type PickingSession = {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
};

export type PickedMediaItem = {
  id: string;
  createTime?: string;
  type?: "TYPE_UNSPECIFIED" | "PHOTO" | "VIDEO";
  mediaFile: { baseUrl: string; mimeType?: string; filename?: string };
};

/** A Google API answered with an error status. */
export class GooglePhotosError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GooglePhotosError";
  }
}

/** A protobuf JSON `Duration` ("5s", "1.5s") in ms; `fallbackMs` when absent or malformed. */
export function parseDuration(value: string | undefined, fallbackMs: number): number {
  if (value === undefined || value.length < 2 || !value.endsWith("s")) return fallbackMs;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.round(seconds * 1000)
    : fallbackMs;
}

/** The picker page, told to close itself once the user is done. */
export function pickerWindowUrl(pickerUri: string): string {
  let uri = pickerUri;
  while (uri.endsWith("/")) uri = uri.slice(0, -1);
  return `${uri}/autoclose`;
}

/** The full-quality bytes of a picked item: `=dv` for a video, `=d` for a photo. */
export function mediaDownloadUrl(item: PickedMediaItem): string {
  return `${item.mediaFile.baseUrl}=${item.type === "VIDEO" ? "dv" : "d"}`;
}

/** Name for a picked item's `File`; Google omits it for some items. */
export function pickedFileName(item: PickedMediaItem): string {
  const name = item.mediaFile.filename?.trim();
  return name ? name : `google-photos-${item.id}`;
}

/** Title of the Google Photos album a save creates. */
export function libraryAlbumTitle(albumName: string): string {
  const title = albumName.trim() === "" ? "PhotoBin" : albumName.trim();
  return title.slice(0, ALBUM_TITLE_LIMIT);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function googleFetch(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    let message = `Google Photos answered ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // Not JSON: keep the status message.
    }
    throw new GooglePhotosError(message, response.status);
  }
  return response;
}

async function googleJson<T>(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await googleFetch(url, token, { ...init, headers });
  return (await response.json()) as T;
}

// ─── Picker (import) ─────────────────────────────────────────────────────────

export function createPickingSession(token: string, signal?: AbortSignal) {
  return googleJson<PickingSession>(`${PICKER_API}/sessions`, token, {
    method: "POST",
    body: "{}",
    signal,
  });
}

/** Best effort: Google expires unused sessions anyway. */
export async function deletePickingSession(token: string, sessionId: string) {
  await googleFetch(`${PICKER_API}/sessions/${sessionId}`, token, {
    method: "DELETE",
  }).catch(() => undefined);
}

/** Polls the session at Google's pace until the user has picked; throws when Google gives up on it. */
export async function waitForPickedItems(
  token: string,
  session: PickingSession,
  signal: AbortSignal,
): Promise<void> {
  let current = session;
  const deadline =
    Date.now() + parseDuration(session.pollingConfig?.timeoutIn, 30 * 60_000);
  while (current.mediaItemsSet !== true) {
    if (Date.now() > deadline) throw new Error("The Google Photos selection timed out");
    await sleep(
      parseDuration(current.pollingConfig?.pollInterval, DEFAULT_POLL_MS),
      signal,
    );
    current = await googleJson<PickingSession>(
      `${PICKER_API}/sessions/${session.id}`,
      token,
      { signal },
    );
  }
}

export async function listPickedItems(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      sessionId,
      pageSize: String(PICKED_PAGE_SIZE),
    });
    if (pageToken !== undefined) query.set("pageToken", pageToken);
    const page = await googleJson<{
      mediaItems?: PickedMediaItem[];
      nextPageToken?: string;
    }>(`${PICKER_API}/mediaItems?${query}`, token, { signal });
    items.push(...(page.mediaItems ?? []));
    pageToken = page.nextPageToken || undefined;
  } while (pageToken !== undefined);
  return items;
}

/** A picked item as a `File`, dated by its capture time like a local file's `lastModified`. */
export async function downloadPickedItem(
  token: string,
  item: PickedMediaItem,
  signal?: AbortSignal,
): Promise<File> {
  const response = await googleFetch(mediaDownloadUrl(item), token, { signal });
  const blob = await response.blob();
  const created = item.createTime === undefined ? NaN : Date.parse(item.createTime);
  return new File([blob], pickedFileName(item), {
    type: item.mediaFile.mimeType ?? blob.type,
    lastModified: Number.isNaN(created) ? Date.now() : created,
  });
}

// ─── Library (save) ──────────────────────────────────────────────────────────

export async function createLibraryAlbum(token: string, title: string): Promise<string> {
  const album = await googleJson<{ id: string }>(`${LIBRARY_API}/albums`, token, {
    method: "POST",
    body: JSON.stringify({ album: { title } }),
  });
  return album.id;
}

/** Sends the bytes; the returned upload token becomes a media item in `createMediaItems`. */
export async function uploadMediaBytes(
  token: string,
  blob: Blob,
  mimeType: string | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Goog-Upload-Protocol": "raw",
  };
  if (mimeType) headers["X-Goog-Upload-Content-Type"] = mimeType;
  const response = await googleFetch(`${LIBRARY_API}/uploads`, token, {
    method: "POST",
    headers,
    body: blob,
    signal,
  });
  return response.text();
}

/** Creates up to `BATCH_CREATE_LIMIT` items in `albumId`; returns how many Google accepted. */
export async function createMediaItems(
  token: string,
  albumId: string,
  uploads: { uploadToken: string; fileName: string }[],
): Promise<number> {
  const result = await googleJson<{
    newMediaItemResults?: { status?: { code?: number } }[];
  }>(`${LIBRARY_API}/mediaItems:batchCreate`, token, {
    method: "POST",
    body: JSON.stringify({
      albumId,
      newMediaItems: uploads.map(({ uploadToken, fileName }) => ({
        simpleMediaItem: { uploadToken, fileName },
      })),
    }),
  });
  return countCreated(result.newMediaItemResults ?? []);
}

/** A `batchCreate` result succeeded when its status code is absent or 0 (OK). */
export function countCreated(results: { status?: { code?: number } }[]): number {
  return results.filter((r) => (r.status?.code ?? 0) === 0).length;
}
