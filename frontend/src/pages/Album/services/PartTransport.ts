import type { PartType } from "../../../../../backend/src/utils/zod";

export type { PartType };

/** Must stay below `MAX_PART_BYTES` on the backend. Progress is reported per chunk,
 * so this is a compromise between request count and progress-bar granularity.
 * Resume records store chunk counts, so every upload path must slice with this. */
export const CHUNK_SIZE = 2 * 1024 * 1024;
/** Chunk requests in flight at once for a single file. */
export const UPLOAD_CONCURRENCY = 4;
export const DOWNLOAD_CONCURRENCY = 4;

const PARTS_PATH = "/api/parts";

function partUrl(
  albumId: string,
  fileId: string,
  type: PartType,
  part: number,
  editId?: string,
) {
  const url = `${PARTS_PATH}/${albumId}/${fileId}/${type}/${part}`;
  return editId === undefined ? url : `${url}?editId=${encodeURIComponent(editId)}`;
}

/**
 * Binary chunk transport. Bytes (plaintext in plain mode, AES-GCM ciphertext in
 * encrypted mode) travel as `application/octet-stream`, so there is no base64
 * inflation and no JSON parsing of multi-megabyte strings on either side.
 */
export class PartTransport {
  /**
   * Stores one chunk. With `editId` it lands in the file's edit staging dir
   * (see `AlbumService.beginEdit`). `signal` aborts the request in flight.
   */
  async put(
    albumId: string,
    fileId: string,
    type: PartType,
    part: number,
    bytes: ArrayBuffer,
    options: { editId?: string; signal?: AbortSignal } = {},
  ) {
    const response = await fetch(partUrl(albumId, fileId, type, part, options.editId), {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      // Chromium streams Blob bodies straight from the browser process, while
      // ArrayBuffer bodies are copied through the renderer at ~10 MB/s.
      body: new Blob([bytes]),
      signal: options.signal,
    });
    if (!response.ok)
      throw new Error(`Upload of ${type}[${part}] failed: ${response.status}`);
  }

  async get(albumId: string, fileId: string, type: PartType, part: number) {
    const response = await fetch(partUrl(albumId, fileId, type, part));
    if (!response.ok)
      throw new Error(`Download of ${type}[${part}] failed: ${response.status}`);
    return await response.arrayBuffer();
  }
}

export function splitIntoChunks(buffer: ArrayBuffer, size: number = CHUNK_SIZE) {
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += size) {
    chunks.push(buffer.slice(offset, offset + size));
  }
  return chunks;
}

/**
 * Runs `task` for every index in `[0, count)` with at most `limit` running at
 * once. Results are returned in index order; the first failure rejects.
 */
export async function mapWithConcurrency<T>(
  count: number,
  limit: number,
  task: (index: number) => Promise<T>,
): Promise<T[]> {
  const results = new Array<T>(count);
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const index = next++;
      results[index] = await task(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
  return results;
}
