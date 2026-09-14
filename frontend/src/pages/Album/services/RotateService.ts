import { client } from "../../../cuple";
import { uint8ArrayToBase64 } from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { ImageQueryService } from "./ImageQueryService";
import {
  mapWithConcurrency,
  PartTransport,
  splitIntoChunks,
  UPLOAD_CONCURRENCY,
} from "./PartTransport";
import { AlbumFile, Rotation } from "./renditions";
import { REDUCED_MAX_EDGE, REDUCED_QUALITY, THUMBNAIL_SIZE } from "./UploadService";

export type RotateResult =
  | { result: "success"; rotation: Rotation }
  | { result: "edit-in-progress" };

type EditablePart = "edited" | "reduced" | "thumbnail";
type SourceMime = "image/jpeg" | "image/png" | "image/webp";
type PartRef = { iv: string; chunkCount: number };

/** One re-rendered part, before and after encryption. */
type Rendition = { type: EditablePart; blob: Promise<Blob> };
type SealedPart = { type: EditablePart; bytes: ArrayBuffer; iv: string };

const EDITED_QUALITY = 0.95;

/**
 * Non-destructive rotation: the pristine `original` is fetched, re-encoded
 * ONCE at the new absolute rotation (never cumulatively), and the derived
 * `edited`/`reduced`/`thumbnail` parts are swapped in through the server-side
 * edit lifecycle (beginEdit → upload parts → commitEdit, abortEdit on failure).
 */
export class RotateService {
  constructor(
    private _canvasService: CanvasService,
    private _cryptoService: CryptoService,
    private _imageQueryService: ImageQueryService,
    private _transport = new PartTransport(),
  ) {}

  async rotateTo(
    albumId: string,
    file: AlbumFile,
    key: string | null,
    rotation: Rotation,
  ): Promise<RotateResult> {
    // A video's `original` is only its poster frame.
    if (!file.original || file.originalVideo)
      throw new Error("Only images can be rotated");
    const { fileId } = file;

    const original = await this._imageQueryService.getImg(
      albumId,
      file,
      key,
      "original",
      {
        withText: false,
      },
    );
    if (!original) throw new Error("Original image not found");
    const renditions = await this._render(original.blob, rotation);
    const sealed = await Promise.all(renditions.map((r) => this._seal(r, key)));

    const begin = await client.beginEdit.post({ body: { albumId, fileId } });
    if (begin.result === "edit-in-progress") return { result: "edit-in-progress" };
    if (begin.result !== "success") throw new Error("Could not start editing");
    const { editId } = begin;

    try {
      // `edited` is only in the list when rotation ≠ 0, so it is absent from the patch then.
      const parts = {} as Record<EditablePart, PartRef>;
      for (const part of sealed) {
        parts[part.type] = {
          iv: part.iv,
          chunkCount: await this._upload(albumId, fileId, editId, part),
        };
      }
      const commit = await client.commitEdit.post({
        body: { albumId, fileId, editId, patch: { rotation, ...parts } },
      });
      if (commit.result !== "success") throw new Error("Could not commit the edit");
      return { result: "success", rotation };
    } catch (err) {
      await client.abortEdit
        .post({ body: { albumId, fileId, editId } })
        .catch((abortErr: unknown) => console.error("abortEdit failed", abortErr));
      throw err;
    }
  }

  /** Every rendition comes from one canvas rotated from the pristine original. */
  private async _render(original: Blob, rotation: Rotation): Promise<Rendition[]> {
    const mime = sniffMime(new Uint8Array(await original.slice(0, 12).arrayBuffer()));
    const canvas = await this._canvasService.rotate(original, rotation);
    const loaded = await this._canvasService.load(canvas);
    const edited: Rendition[] =
      rotation === 0
        ? []
        : [
            {
              type: "edited",
              blob: this._canvasService.encode(canvas, mime, EDITED_QUALITY),
            },
          ];
    return [
      ...edited,
      {
        type: "reduced",
        // Always produced (even for small originals uploaded without one), so
        // the viewer never has to fall back to the unrotated original.
        blob: loaded.resize({
          maxEdge: REDUCED_MAX_EDGE,
          quality: REDUCED_QUALITY,
          // WebP encoding is far slower than JPEG in browsers; keep WebP only
          // for sources that may carry transparency.
          mimeType: mime === "image/jpeg" ? "image/jpeg" : "image/webp",
        }).blob,
      },
      { type: "thumbnail", blob: loaded.resize({ targetSize: THUMBNAIL_SIZE }).blob },
    ];
  }

  private async _seal(
    { type, blob }: Rendition,
    key: string | null,
  ): Promise<SealedPart> {
    const { cryptedImg, iv } = await this._cryptoService.encryptImage(await blob, key);
    return { type, bytes: cryptedImg, iv: uint8ArrayToBase64(iv) };
  }

  /** Uploads one part into the edit's staging area; resolves to its chunk count. */
  private async _upload(
    albumId: string,
    fileId: string,
    editId: string,
    part: SealedPart,
  ) {
    const chunks = splitIntoChunks(part.bytes);
    await mapWithConcurrency(chunks.length, UPLOAD_CONCURRENCY, (i) =>
      this._transport.put(albumId, fileId, part.type, i, chunks[i], { editId }),
    );
    return chunks.length;
  }
}

/**
 * Decrypted blobs carry no type, so sniff the magic bytes. PNG stays PNG
 * (lossless) and WebP stays WebP; JPEG and every other type become JPEG.
 */
function sniffMime(header: Uint8Array): SourceMime {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...header.subarray(from, to));
  if (ascii(0, 4) === "\x89PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return "image/jpeg";
}
