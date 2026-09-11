import { client } from "../../../cuple";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { formatDate } from "../../../utils/formatDate";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import {
  mapWithConcurrency,
  PartTransport,
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

type PartInfo = { iv: string; chunkCount: number };
type FileMetadata = Metadata["files"][number];

export class UploadService {
  private _transport = new PartTransport();

  constructor(
    private _canvasService: CanvasService,
    private _cryptoService: CryptoService,
  ) {}

  async *upload(
    file: File,
    props: { key: string | null; albumId: string },
  ): AsyncGenerator<UploadYield> {
    const profile = new URLSearchParams(window.location.search).has("profile");
    const t0 = performance.now();
    const log = (label: string, start: number) => {
      if (profile)
        console.log(
          `[upload] ${file.name} ${label}: ${Math.round(performance.now() - start)}ms`,
        );
    };
    const fileId = crypto.randomUUID();
    const date = formatDate(file.lastModified);
    const cryptedFileName = await this._cryptoService.encrypString(file.name, props.key);
    const cryptedDate = await this._cryptoService.encrypString(
      date.toString(),
      props.key,
    );
    const base: Pick<FileMetadata, "fileId" | "fileName" | "date"> = {
      fileId,
      fileName: {
        iv: uint8ArrayToBase64(cryptedFileName.iv),
        value: arrayBufferToBase64(cryptedFileName.encryptedText),
      },
      date: {
        iv: uint8ArrayToBase64(cryptedDate.iv),
        value: arrayBufferToBase64(cryptedDate.encryptedText),
      },
    };
    const ctx = { ...props, fileId, log };

    let fileMetadata: FileMetadata;
    let thumbnailUrl: string | undefined;
    let isVideo = false;

    if (IMAGETYPES.includes(file.type)) {
      const image = yield* this._uploadImage(file, ctx);
      fileMetadata = { ...base, ...image.parts };
      thumbnailUrl = image.thumbnailUrl;
    } else if (VIDEOTYPES.includes(file.type)) {
      isVideo = true;
      const originalVideo = yield* this._encryptAndSend(file, "originalVideo", ctx);
      const poster = await this._canvasService.getImageFromVideo(file);
      const image = yield* this._uploadImage(poster, ctx);
      fileMetadata = { ...base, ...image.parts, originalVideo };
      thumbnailUrl = image.thumbnailUrl;
    } else {
      const unsupportedFile = yield* this._encryptAndSend(file, "unsupportedFile", ctx);
      fileMetadata = { ...base, unsupportedFile };
    }

    await this._finalize(props.albumId, fileMetadata);
    log("TOTAL", t0);
    yield {
      result: "finish",
      thumbnail: thumbnailUrl,
      name: file.name,
      fileId,
      date,
      isVideo,
    };
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

  private async _finalize(albumId: string, fileMetadata: FileMetadata) {
    await client.finalizeFile.post({
      body: {
        albumId,
        fileMetadata,
      },
    });
  }

  /**
   * Uploads the original plus the thumbnail and (when worth it) a reduced
   * rendition. The image is decoded once and both renditions are drawn from it.
   */
  private async *_uploadImage(
    image: Blob,
    ctx: UploadContext,
  ): AsyncGenerator<UploadYield, { parts: Partial<FileMetadata>; thumbnailUrl: string }> {
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
    ctx.log("decode+resize", tResize);

    const tBlobs = performance.now();
    const thumbnailBlob = await thumbnail.blob;
    const reducedBlob = reduced === undefined ? undefined : await reduced.blob;
    ctx.log(`canvas toBlob(thumb${reducedBlob ? "+reduced" : ""})`, tBlobs);

    const original = yield* this._encryptAndSend(image, "original", ctx);
    const reducedPart =
      reducedBlob === undefined
        ? undefined
        : yield* this._encryptAndSend(reducedBlob, "reduced", ctx);
    const thumbnailPart = yield* this._encryptAndSend(thumbnailBlob, "thumbnail", ctx);
    return {
      parts: { original, reduced: reducedPart, thumbnail: thumbnailPart },
      thumbnailUrl,
    };
  }

  private async *_encryptAndSend(
    blob: Blob,
    type: PartType,
    ctx: UploadContext,
  ): AsyncGenerator<UploadYield, PartInfo> {
    const tEncrypt = performance.now();
    const crypted = await this._cryptoService.encryptImage(blob, ctx.key);
    ctx.log(`encrypt ${type}`, tEncrypt);
    const chunks = splitIntoChunks(crypted.cryptedImg);

    const tSend = performance.now();
    yield* progressOf((report) =>
      mapWithConcurrency(chunks.length, UPLOAD_CONCURRENCY, async (i) => {
        await this._transport.put(ctx.albumId, ctx.fileId, type, i, chunks[i]);
        report(chunks[i].byteLength);
      }),
    );
    ctx.log(`send ${type} (${chunks.length} chunks)`, tSend);
    return { iv: uint8ArrayToBase64(crypted.iv), chunkCount: chunks.length };
  }
}

type UploadContext = {
  key: string | null;
  albumId: string;
  fileId: string;
  log: (label: string, start: number) => void;
};

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
