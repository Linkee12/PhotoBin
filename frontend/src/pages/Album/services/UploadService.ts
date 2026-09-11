import { client, RPC_PATH } from "../../../cuple";
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
} from "./PendingUploadStore";

const SIZE = { width: 300, height: 200 };
const QUALITY = 0.5;
const CHUNK_SIZE = 1000000; //byte
const VIDEOTYPES = ["video/mp4", "video/webm", "video/ogg"];
const IMAGETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

type PartType =
  | "original"
  | "reduced"
  | "thumbnail"
  | "originalVideo"
  | "unsupportedFile";
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

type UploadPartBody = Parameters<typeof client.uploadFilePart.post>[0]["body"];

type PreparedPart = {
  iv: Uint8Array;
  chunks: ArrayBuffer[];
  /** Chunk indexes confirmed by the server in this session. */
  sent: Set<number>;
};

type PreparedUpload = {
  fingerprint: string;
  fileId: string;
  name: string;
  date: string;
  fileName: EncryptedEntry;
  encryptedDate: EncryptedEntry;
  thumbnailUrl: string | undefined;
  isVideo: boolean;
  parts: Partial<Record<PartType, PreparedPart>>;
};

type UploadYield =
  | {
      result: "finish";
      thumbnail: string | undefined;
      fileId: string;
      name: string;
      date: string;
      isVideo: boolean;
    }
  | { result: "progress"; bytes: number };

export class UploadService {
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
    props: { key: string; albumId: string; signal?: AbortSignal },
  ): AsyncGenerator<UploadYield> {
    const store = new PendingUploadStore(props.albumId);
    const fingerprint = fileFingerprint(file);

    let prepared = this._failed.get(fingerprint);
    if (prepared === undefined) {
      prepared = await this._prepare(file, props.key, store.find(fingerprint));
      this._failed.set(fingerprint, prepared);
    }
    store.save(this._toRecord(prepared));

    yield* this._send(prepared, props.albumId, props.signal);

    this._failed.delete(fingerprint);
    store.remove(prepared.fileId);
    yield {
      result: "finish",
      thumbnail: prepared.thumbnailUrl,
      name: prepared.name,
      fileId: prepared.fileId,
      date: prepared.date,
      isVideo: prepared.isVideo,
    };
  }

  async saveName(albumId: string, name: string, key: string) {
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
    key: string,
    pending: PendingUpload | undefined,
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
      const tResize = performance.now();
      const thumbnail = await this._canvasService.resize(image, { targetSize: SIZE });
      const reduce = await this._canvasService.resize(image, { quality: QUALITY });
      log("resize", tResize);
      thumbnailUrl = thumbnail.url;
      // Canvas output is not byte-stable across sessions: always fresh IVs.
      parts.thumbnail = await this._encryptPart(await thumbnail.blob, key);
      parts.reduced = await this._encryptPart(await reduce.blob, key);
      if (isVideo) parts.original = await this._encryptPart(image, key);
    }
    log("encrypt", tEncrypt);

    return {
      fingerprint: fileFingerprint(file),
      fileId: pending?.fileId ?? crypto.randomUUID(),
      name: file.name,
      date,
      fileName,
      encryptedDate,
      thumbnailUrl,
      isVideo,
      parts,
    };
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
      await withRetry(
        () =>
          this._rpc(() =>
            client.finalizeFile.post({
              body: { albumId, fileMetadata: this._toMetadata(prepared) },
            }),
          ),
        { signal },
      );
    }
  }

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
    for (let i = 0; i < part.chunks.length; i++) {
      throwIfAborted(ctx.signal);
      const chunk = part.chunks[i];
      if (part.sent.has(i) || ctx.onServer.has(i.toString())) {
        if (profile) console.log(`[upload] ${ctx.type}[${i}] skipped (already uploaded)`);
        yield { result: "progress" as const, bytes: chunk.byteLength };
        continue;
      }
      const t0 = performance.now();
      const encryptedFile = arrayBufferToBase64(chunk);
      const tEncoded = performance.now();
      await withRetry(
        () =>
          this._postPart(
            {
              albumId: ctx.albumId,
              fileId: ctx.fileId,
              partName: i.toString(),
              fileType: ctx.type,
              encryptedFile,
            },
            ctx.signal,
          ),
        { signal: ctx.signal },
      );
      part.sent.add(i);
      if (profile) {
        console.log(
          `[upload] ${ctx.type}[${i}] base64: ${Math.round(tEncoded - t0)}ms, post: ${Math.round(performance.now() - tEncoded)}ms`,
        );
      }
      yield { result: "progress" as const, bytes: chunk.byteLength };
    }
  }

  /**
   * Posts one chunk. Uses fetch directly (same wire format as the cuple client)
   * because the client offers no way to pass an AbortSignal, and a 1 MB chunk
   * in flight on a slow link must be cancellable.
   */
  private async _postPart(body: UploadPartBody, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await fetch(RPC_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ segments: ["uploadFilePart"], argument: { body } }),
        signal,
      });
    } catch (e) {
      if (isAbortError(e)) throw e;
      throw new RetryableError("Network error while uploading", { cause: e });
    }
    if (response.status >= 500) {
      throw new RetryableError(`Server error ${response.status} while uploading`);
    }
    let json: { result?: string };
    try {
      json = await response.json();
    } catch (e) {
      throw new RetryableError("Unreadable response while uploading", { cause: e });
    }
    if (json.result !== "success") {
      throw new Error(`Upload rejected (${response.status})`);
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
    key: string,
    base64Iv?: string,
  ): Promise<PreparedPart> {
    const iv = base64Iv === undefined ? undefined : base64toUint8Array(base64Iv);
    const encrypted = await this._cryptoService.encryptImage(data, key, iv);
    return {
      iv: encrypted.iv,
      chunks: this._getChunks(encrypted.cryptedImg),
      sent: new Set(),
    };
  }

  private async _encryptText(text: string, key: string): Promise<EncryptedEntry> {
    const encrypted = await this._cryptoService.encrypString(text, key);
    return {
      iv: uint8ArrayToBase64(encrypted.iv),
      value: arrayBufferToBase64(encrypted.encryptedText),
    };
  }

  private _getChunks(file: ArrayBuffer) {
    const partsOfFile = [];
    for (let i = 0; i < file.byteLength; i += CHUNK_SIZE) {
      partsOfFile.push(file.slice(i, i + CHUNK_SIZE));
    }
    return partsOfFile;
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
    };
  }
}
