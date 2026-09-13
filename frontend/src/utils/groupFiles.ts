import { Metadata } from "../../../backend/src/services/MetadataService";
import { formatDateTime } from "./formatDateTime";

export type AlbumView = "history" | "date";
export const ALBUM_VIEWS: AlbumView[] = ["history", "date"];
export const DEFAULT_ALBUM_VIEW: AlbumView = "history";

export type Thumbnail = {
  /** Object URL of the thumbnail; undefined while loading and for unsupported files. */
  thumbnail: string | undefined;
  /** The file has a thumbnail part that has not been fetched yet. */
  isLoading: boolean;
  id: string;
  name: string;
  isVideo: boolean;
  /**
   * Unsupported files that belong to this photo (a RAW next to its JPG): the
   * same basename, a different extension. They get no tile of their own and
   * follow the photo when it is selected, downloaded or deleted.
   */
  sidecars: Sidecar[];
};

export type Sidecar = { id: string; name: string };

export type ThumbnailGroup = {
  /** Stable identity across renders (collapse state, React keys). */
  key: string;
  /** Header text: the batch name in history view, the photo date in date view. */
  title: string;
  /** Extra header text after the title (` · 09/12 14:05 · 3 photos`). */
  meta: string;
  /** Set when the group is a named upload batch and can therefore be renamed. */
  batchId: string | undefined;
  thumbnails: Thumbnail[];
};

export type DecodedBatches = Record<string, { name: string; createdAt: number }>;
export type DecodedFiles = Record<string, { name: string; date: string }>;

type GroupInput = {
  files: Metadata["files"];
  decodedFiles: DecodedFiles;
  decodedBatches: DecodedBatches;
  /** Loaded thumbnail URLs by fileId. Files without an entry show a placeholder. */
  thumbnails: ReadonlyMap<string, string | undefined>;
  view: AlbumView;
};

const EARLIER_KEY = "batch:earlier";
const EARLIER_TITLE = "Earlier uploads";

/**
 * Header for a batch that metadata lists on files but not in `batches` (or
 * whose name could not be decoded). The id keeps such batches apart; only
 * files with no `batchId` at all belong to "Earlier uploads".
 */
function unknownBatchTitle(batchId: string): string {
  return `Upload ${batchId.slice(0, 8)}`;
}

/**
 * Pure grouping of the album's files for one view. Every file gets a tile,
 * except unsupported files that are sidecars of a supported one (see
 * `Thumbnail.sidecars`); the ones whose thumbnail has not been fetched yet
 * are marked `isLoading` so the grid shows placeholders that fill in as
 * thumbnails arrive. The order inside a group is the upload order (metadata
 * order).
 */
export function groupFiles(input: GroupInput): ThumbnailGroup[] {
  const sidecars = pairSidecars(input);
  const groups = new Map<string, ThumbnailGroup>();
  for (const file of input.files) {
    if (sidecars.attached.has(file.fileId)) continue;
    const slot = groupOf(file, input);
    let group = groups.get(slot.key);
    if (group === undefined) {
      group = { ...slot, meta: "", thumbnails: [] };
      groups.set(slot.key, group);
    }
    group.thumbnails.push({
      id: file.fileId,
      thumbnail: input.thumbnails.get(file.fileId),
      isLoading: file.thumbnail !== undefined && !input.thumbnails.has(file.fileId),
      name: input.decodedFiles[file.fileId]?.name ?? "",
      isVideo: file.originalVideo !== undefined,
      sidecars: sidecars.byPhoto.get(file.fileId) ?? [],
    });
  }
  const result = [...groups.values()];
  if (input.view === "history") {
    result.sort((a, b) => compareHistory(a, b, input));
    for (const group of result) group.meta = historyMeta(group, input);
  }
  return result;
}

/**
 * Pairs every unsupported file (no thumbnail) with the first supported file
 * of the same basename, compared without extension and case. The album's
 * files, not just the batch's: a RAW may be added later than its JPG.
 */
function pairSidecars(input: GroupInput) {
  const photoByBasename = new Map<string, string>();
  for (const file of input.files) {
    if (file.thumbnail === undefined) continue;
    const key = basenameKey(input.decodedFiles[file.fileId]?.name);
    if (key !== undefined && !photoByBasename.has(key)) {
      photoByBasename.set(key, file.fileId);
    }
  }
  const byPhoto = new Map<string, Sidecar[]>();
  const attached = new Set<string>();
  for (const file of input.files) {
    if (file.thumbnail !== undefined) continue;
    const name = input.decodedFiles[file.fileId]?.name;
    const photoId = photoByBasename.get(basenameKey(name) ?? "");
    if (photoId === undefined || name === undefined) continue;
    attached.add(file.fileId);
    const list = byPhoto.get(photoId) ?? [];
    list.push({ id: file.fileId, name });
    byPhoto.set(photoId, list);
  }
  return { byPhoto, attached };
}

/** `IMG_0001.CR3` → `img_0001`; undefined without a name or an extension. */
function basenameKey(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return name.slice(0, dot).toLowerCase();
}

function groupOf(
  file: Metadata["files"][number],
  input: GroupInput,
): Pick<ThumbnailGroup, "key" | "title" | "batchId"> {
  if (input.view === "date") {
    const date = input.decodedFiles[file.fileId]?.date ?? "";
    return { key: `date:${date}`, title: date, batchId: undefined };
  }
  if (file.batchId === undefined) {
    return { key: EARLIER_KEY, title: EARLIER_TITLE, batchId: undefined };
  }
  const batch = input.decodedBatches[file.batchId];
  // A batch the server has no entry for cannot be renamed (there is nothing
  // to rename), so `batchId` stays undefined; the key still keeps it separate.
  if (batch === undefined) {
    return {
      key: `batch:${file.batchId}`,
      title: unknownBatchTitle(file.batchId),
      batchId: undefined,
    };
  }
  return { key: `batch:${file.batchId}`, title: batch.name, batchId: file.batchId };
}

/** Newest known batch first, then batches without a timestamp, "Earlier uploads" last. */
function compareHistory(a: ThumbnailGroup, b: ThumbnailGroup, input: GroupInput) {
  if (historyRank(a) !== historyRank(b)) return historyRank(a) - historyRank(b);
  return createdAtOf(b, input) - createdAtOf(a, input);
}

function historyRank(group: ThumbnailGroup): number {
  if (group.key === EARLIER_KEY) return 2;
  if (group.batchId === undefined) return 1;
  return 0;
}

function createdAtOf(group: ThumbnailGroup, input: GroupInput): number {
  if (group.batchId === undefined) return Number.NEGATIVE_INFINITY;
  return input.decodedBatches[group.batchId]?.createdAt ?? Number.NEGATIVE_INFINITY;
}

function historyMeta(group: ThumbnailGroup, input: GroupInput): string {
  const n = group.thumbnails.length;
  const count = n === 1 ? "1 photo" : `${n} photos`;
  const batch =
    group.batchId === undefined ? undefined : input.decodedBatches[group.batchId];
  if (batch === undefined) return count;
  return `${formatDateTime(batch.createdAt)} · ${count}`;
}
