import { client } from "../../../cuple";
import {
  arrayBufferToBase64,
  base64toUint8Array,
  uint8ArrayToBase64,
} from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { formatDate } from "../../../utils/formatDate";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import {
  isAbortError,
  RetryableError,
  throwIfAborted,
  withRetry,
} from "../../../utils/retry";
import {
  EncryptedEntry,
  fileFingerprint,
  PendingUpload,
  PendingUploadStore,
  ResumablePartType,
  UploadBatch,
} from "./PendingUploadStore";
import {
  mapWithConcurrency,
  PartTransport,
  PartTransportError,
  PartType,
  splitIntoChunks,
  UPLOAD_CONCURRENCY,
} from "./PartTransport";

export const THUMBNAIL_SIZE = { width: 300, height: 200 };
/** The reduced rendition only feeds the fullscreen viewer, so cap it at screen-ish size. */
export const REDUCED_MAX_EDGE = 2560;
export const REDUCED_QUALITY = 0.8;
/** Originals at most this big (bytes) and within `REDUCED_MAX_EDGE` are shown as-is. */
const SKIP_REDUCED_BELOW_BYTES = 2 * 1024 * 1024;
const VIDEOTYPES = ["video/mp4", "video/webm", "video/ogg"];
const IMAGETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/** Parts whose plaintext is the picked file itself and therefore reproducible after a reload. */
const RESUMABLE: ReadonlySet<PartType> = new Set<ResumablePartType>([
  "original",
  "originalVideo",
  "unsupportedFile",
]);
const SEND_ORDER: PartType[] = [
  "originalVideo",
  "original",
  "reduced",
  "thumbnail",
  "unsupportedFile",
];

type PreparedPart = {
  iv: Uint8Array;
  chunks: ArrayBuffer[];
  /** Chunk indexes confirmed by the server in this session. */
  sent: Set<number>;
};

type PreparedUpload = {
  fingerprint: string;
  fileId: string;
  fileName: EncryptedEntry;
  encryptedDate: EncryptedEntry;
  batch: UploadBatch;
  thumbnailUrl: string | undefined;
  isVideo: boolean;
  parts: Partial<Record<PartType, PreparedPart>>;
};

type UploadYield =
  | {
      result: "finish";
      thumbnail: string | undefined;
      /** iv of the uploaded thumbnail part, to tell a later server-side replacement apart. */
      thumbnailIv: string | undefined;
      fileId: string;
    }
  | { result: "progress"; bytes: number };

export class UploadService {
  private _transport = new PartTransport();
  /** Encrypted state of files that failed in this session, for "retry" without re-encrypting. */
  private _failed = new Map<string, PreparedUpload>();

  constructor(
    private _canvasService: CanvasService,
    private _cryptoService: CryptoService,
  ) {}

  /**
   * Uploads one file. Resumes from in-memory state (a failed attempt in this
   * session) or from a localStorage record (previous session) when available,
   * sending only the parts the server does not have yet. Throws on abort or
   * after retries are exhausted; the resume state is kept in both cases.
   */
  async *upload(
    file: File,
    props: {
      key: string | null;
      albumId: string;
      /** Batch for a fresh upload; a resumed or retried file keeps its original batch. */
      batch: UploadBatch;
      signal?: AbortSignal;
    },
  ): AsyncGenerator<UploadYield> {
    const store = new PendingUploadStore(props.albumId);
    const fingerprint = fileFingerprint(file);

    let prepared = this._failed.get(fingerprint);
    if (prepared === undefined) {
      prepared = await this._prepare(
        file,
        props.key,
        store.find(fingerprint),
        props.batch,
      );
      this._failed.set(fingerprint, prepared);
    }
    store.save(this._toRecord(prepared));

    const alreadyFinalized = yield* this._send(prepared, props.albumId, props.signal);

    this._failed.delete(fingerprint);
    store.remove(prepared.fileId);
    // An already finalized file is listed via metadata; announcing it again
    // would show it twice.
    if (alreadyFinalized) return;
    yield {
      result: "finish",
      thumbnail: prepared.thumbnailUrl,
      thumbnailIv: thumbnailIv(prepared),
      fileId: prepared.fileId,
    };
  }

  /** Creates a new batch identity with its name encrypted once for all its files. */
  async createBatch(name: string, key: string | null): Promise<UploadBatch> {
    return {
      batchId: crypto.randomUUID(),
      name: await this._encryptText(name, key),
      createdAt: Date.now(),
    };
  }

  async renameBatch(albumId: string, batchId: string, name: string, key: string | null) {
    const encrypted = await this._encryptText(name, key);
    const res = await client.renameBatch.post({
      body: { albumId, batchId, name: encrypted },
    });
    if (res.result !== "success") throw new Error(`Rename failed (${res.statusCode})`);
  }

  async saveName(albumId: string, name: string, key: string | null) {
    const cryptedName = await this._cryptoService.encrypString(name, key);
    const iv = uint8ArrayToBase64(cryptedName.iv);
    const value = arrayBufferToBase64(cryptedName.encryptedText);
    client.editAlbumName.post({
      body: { albumId, albumName: { iv, value } },
    });
  }

  async addAlbumName(albumId: string, albumName: { value: string; iv: string }) {
    const res = await client.editAlbumName.post({
      body: { albumId, albumName },
    });
    if (res.result !== "success") return { isSuccess: false };
  }

  private async _prepare(
    file: File,
    key: string | null,
    pending: PendingUpload | undefined,
    batch: UploadBatch,
  ): Promise<PreparedUpload> {
    const profile = new URLSearchParams(window.location.search).has("profile");
    const log = (label: string, start: number) => {
      if (profile)
        console.log(
          `[upload] ${file.name} ${label}: ${Math.round(performance.now() - start)}ms`,
        );
    };
    const isImage = IMAGETYPES.includes(file.type);
    const isVideo = VIDEOTYPES.includes(file.type);
    let resumableType: ResumablePartType = "unsupportedFile";
    if (isImage) resumableType = "original";
    else if (isVideo) resumableType = "originalVideo";

    // The file itself is encrypted first so a stale record can be detected
    // (chunk count mismatch) before anything else is derived from it.
    const tEncrypt = performance.now();
    const storedIv = pending?.parts[resumableType];
    let filePart = await this._encryptPart(file, key, storedIv?.iv);
    if (storedIv !== undefined && filePart.chunks.length !== storedIv.chunkCount) {
      console.warn("[upload] pending record does not match file, starting over");
      pending = undefined;
      filePart = await this._encryptPart(file, key);
    }

    const date = formatDate(file.lastModified);
    const fileName = pending?.fileName ?? (await this._encryptText(file.name, key));
    const encryptedDate = pending?.date ?? (await this._encryptText(date, key));
    const parts: PreparedUpload["parts"] = { [resumableType]: filePart };
    let thumbnailUrl: string | undefined;

    if (isImage || isVideo) {
      const image = isImage ? file : await this._canvasService.getImageFromVideo(file);
      const renditions = await this._renderImage(image, log);
      thumbnailUrl = renditions.thumbnailUrl;
      // Canvas output is not byte-stable across sessions: always fresh IVs.
      parts.thumbnail = await this._encryptPart(renditions.thumbnail, key);
      if (renditions.reduced !== undefined) {
        parts.reduced = await this._encryptPart(renditions.reduced, key);
      }
      if (isVideo) parts.original = await this._encryptPart(image, key);
    }
    log("encrypt", tEncrypt);

    return {
      fingerprint: fileFingerprint(file),
      fileId: pending?.fileId ?? crypto.randomUUID(),
      fileName,
      encryptedDate,
      batch: pending?.batch ?? batch,
      thumbnailUrl,
      isVideo,
      parts,
    };
  }

  /**
   * Draws the thumbnail and (when worth it) a reduced rendition from a single
   * decode. Small originals within `REDUCED_MAX_EDGE` are shown as-is, so
   * `reduced` is undefined for them and the metadata carries no `reduced` part.
   */
  private async _renderImage(image: Blob, log: (label: string, start: number) => void) {
    const tResize = performance.now();
    const loaded = await this._canvasService.load(image);
    const thumbnail = loaded.resize({ targetSize: THUMBNAIL_SIZE });
    const needsReduced =
      image.size > SKIP_REDUCED_BELOW_BYTES ||
      Math.max(loaded.width, loaded.height) > REDUCED_MAX_EDGE;
    const reduced = needsReduced
      ? loaded.resize({
          maxEdge: REDUCED_MAX_EDGE,
          quality: REDUCED_QUALITY,
          // WebP encoding is far slower than JPEG in browsers; keep WebP only
          // for sources that may carry transparency.
          mimeType: image.type === "image/jpeg" ? "image/jpeg" : "image/webp",
        })
      : undefined;
    const thumbnailUrl = thumbnail.url;
    loaded.release();
    log("decode+resize", tResize);

    const tBlobs = performance.now();
    const thumbnailBlob = await thumbnail.blob;
    const reducedBlob = reduced === undefined ? undefined : await reduced.blob;
    log(`canvas toBlob(thumb${reducedBlob ? "+reduced" : ""})`, tBlobs);
    return { thumbnail: thumbnailBlob, reduced: reducedBlob, thumbnailUrl };
  }

  private async *_send(prepared: PreparedUpload, albumId: string, signal?: AbortSignal) {
    const uploaded = await withRetry(
      () =>
        this._rpc(() =>
          client.getUploadedParts.get({
            query: { albumId, fileId: prepared.fileId },
          }),
        ),
      { signal },
    );

    for (const type of SEND_ORDER) {
      const part = prepared.parts[type];
      if (part === undefined) continue;
      if (!uploaded.finalized) {
        const onServer = new Set(RESUMABLE.has(type) ? (uploaded.parts[type] ?? []) : []);
        yield* this._sendPart(part, {
          albumId,
          fileId: prepared.fileId,
          type,
          onServer,
          signal,
        });
      } else {
        // A previous session finished but did not clear its record: nothing to send.
        for (const chunk of part.chunks)
          yield { result: "progress" as const, bytes: chunk.byteLength };
      }
    }

    if (!uploaded.finalized) {
      const finalized = await withRetry(
        () =>
          this._rpc(() =>
            client.finalizeFile.post({
              body: {
                albumId,
                fileMetadata: this._toMetadata(prepared),
                batch: prepared.batch,
              },
            }),
          ),
        { signal },
      );
      if (finalized.batchId !== prepared.batch.batchId) {
        console.warn(
          "[upload] the server did not record the upload batch; it is probably running an older version",
        );
      }
    }
    return uploaded.finalized;
  }

  /**
   * Sends the chunks the server does not have yet, `UPLOAD_CONCURRENCY` at a
   * time, each with its own retry. Progress is yielded per chunk (skipped
   * chunks count immediately) so the sequential progress bar keeps moving.
   */
  private async *_sendPart(
    part: PreparedPart,
    ctx: {
      albumId: string;
      fileId: string;
      type: PartType;
      onServer: Set<string>;
      signal?: AbortSignal;
    },
  ) {
    const profile = new URLSearchParams(window.location.search).has("profile");
    const missing: number[] = [];
    for (let i = 0; i < part.chunks.length; i++) {
      if (part.sent.has(i) || ctx.onServer.has(i.toString())) {
        if (profile) console.log(`[upload] ${ctx.type}[${i}] skipped (already uploaded)`);
        yield { result: "progress" as const, bytes: part.chunks[i].byteLength };
      } else {
        missing.push(i);
      }
    }
    throwIfAborted(ctx.signal);
    const tSend = performance.now();
    yield* progressOf((report) =>
      mapWithConcurrency(missing.length, UPLOAD_CONCURRENCY, async (n) => {
        const i = missing[n];
        await withRetry(() => this._putChunk(ctx, i, part.chunks[i]), {
          signal: ctx.signal,
        });
        part.sent.add(i);
        report(part.chunks[i].byteLength);
      }),
    );
    if (profile) {
      console.log(
        `[upload] ${ctx.type}: sent ${missing.length}/${part.chunks.length} chunks in ${Math.round(performance.now() - tSend)}ms`,
      );
    }
  }

  /** Puts one chunk through the binary transport, classifying failures for `withRetry`. */
  private async _putChunk(
    ctx: { albumId: string; fileId: string; type: PartType; signal?: AbortSignal },
    index: number,
    chunk: ArrayBuffer,
  ) {
    throwIfAborted(ctx.signal);
    try {
      await this._transport.put(ctx.albumId, ctx.fileId, ctx.type, index, chunk, {
        signal: ctx.signal,
      });
    } catch (e) {
      if (isAbortError(e)) throw e;
      if (e instanceof PartTransportError) {
        if (e.status >= 500) throw new RetryableError(e.message, { cause: e });
        throw e;
      }
      throw new RetryableError("Network error while uploading", { cause: e });
    }
  }

  /** Classifies a cuple client call: network/5xx → retryable, other non-success → fatal. */
  private async _rpc<T extends { result: string; statusCode: number }>(
    call: () => Promise<T>,
  ): Promise<Extract<T, { result: "success" }>> {
    let res: T;
    try {
      res = await call();
    } catch (e) {
      throw new RetryableError("Network error", { cause: e });
    }
    if (res.result === "success") return res as Extract<T, { result: "success" }>;
    if (res.statusCode >= 500) throw new RetryableError(`Server error ${res.statusCode}`);
    throw new Error(`Request failed (${res.statusCode})`);
  }

  private async _encryptPart(
    data: File | Blob,
    key: string | null,
    base64Iv?: string,
  ): Promise<PreparedPart> {
    const iv = base64Iv === undefined ? undefined : base64toUint8Array(base64Iv);
    const encrypted = await this._cryptoService.encryptImage(data, key, iv);
    return {
      iv: encrypted.iv,
      chunks: splitIntoChunks(encrypted.cryptedImg),
      sent: new Set(),
    };
  }

  private async _encryptText(text: string, key: string | null): Promise<EncryptedEntry> {
    const encrypted = await this._cryptoService.encrypString(text, key);
    return {
      iv: uint8ArrayToBase64(encrypted.iv),
      value: arrayBufferToBase64(encrypted.encryptedText),
    };
  }

  private _toRecord(prepared: PreparedUpload): PendingUpload {
    const parts: PendingUpload["parts"] = {};
    for (const type of RESUMABLE) {
      const part = prepared.parts[type];
      if (part === undefined) continue;
      parts[type as ResumablePartType] = {
        iv: uint8ArrayToBase64(part.iv),
        chunkCount: part.chunks.length,
      };
    }
    return {
      fingerprint: prepared.fingerprint,
      fileId: prepared.fileId,
      createdAt: Date.now(),
      fileName: prepared.fileName,
      date: prepared.encryptedDate,
      batch: prepared.batch,
      parts,
    };
  }

  private _toMetadata(prepared: PreparedUpload): Metadata["files"][0] {
    const describe = (part: PreparedPart | undefined) =>
      part === undefined
        ? undefined
        : { iv: uint8ArrayToBase64(part.iv), chunkCount: part.chunks.length };
    return {
      fileId: prepared.fileId,
      fileName: prepared.fileName,
      date: prepared.encryptedDate,
      original: describe(prepared.parts.original),
      reduced: describe(prepared.parts.reduced),
      thumbnail: describe(prepared.parts.thumbnail),
      originalVideo: describe(prepared.parts.originalVideo),
      unsupportedFile: describe(prepared.parts.unsupportedFile),
      batchId: prepared.batch.batchId,
    };
  }
}

function thumbnailIv(prepared: PreparedUpload): string | undefined {
  const part = prepared.parts.thumbnail;
  return part === undefined ? undefined : uint8ArrayToBase64(part.iv);
}

/**
 * Runs `run` and yields a progress event for every `report(bytes)` call it
 * makes, so concurrent chunk uploads can still drive the sequential progress bar.
 */
async function* progressOf(
  run: (report: (bytes: number) => void) => Promise<unknown>,
): AsyncGenerator<UploadYield, void> {
  const pending: number[] = [];
  let wake: (() => void) | undefined;
  let settled = false;
  const done = run((bytes) => {
    pending.push(bytes);
    wake?.();
  }).finally(() => {
    settled = true;
    wake?.();
  });
  // The rejection (if any) is rethrown by `await done` below.
  done.catch(() => undefined);
  while (true) {
    while (pending.length > 0)
      yield { result: "progress", bytes: pending.shift() as number };
    if (settled) break;
    await new Promise<void>((resolve) => (wake = resolve));
    wake = undefined;
  }
  await done;
}
