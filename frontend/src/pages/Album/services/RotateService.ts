import { fetchCuple } from "@cuple/client";
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
import { AlbumFile, Rotation, viewerPart } from "./renditions";
import { coverSize, Size } from "../utils/imageSize";
import {
  REDUCED_MAX_EDGE,
  REDUCED_QUALITY,
  THUMBNAIL_MAX_EDGE,
  THUMBNAIL_SIZE,
} from "./UploadService";

export type RotateResult =
  | { result: "success"; rotation: Rotation }
  | { result: "edit-in-progress" };

/** `current`: the thumbnail already keeps the whole frame (or the file has none to redo). */
export type ThumbnailRefreshResult = "refreshed" | "current" | "edit-in-progress";

type EditablePart = "edited" | "reduced" | "thumbnail";
type SourceMime = "image/jpeg" | "image/png" | "image/webp";
type PartRef = { iv: string; chunkCount: number };
type EditPatch = (typeof client.commitEdit.post)["tInput"]["body"]["patch"];

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

    // `edited` is only in the list when rotation ≠ 0, so it is absent from the patch then.
    const result = await this._edit(albumId, fileId, sealed, (parts) => ({
      rotation,
      reduced: parts.reduced!,
      thumbnail: parts.thumbnail!,
      ...(parts.edited && { edited: parts.edited }),
    }));
    return result === "success" ? { result, rotation } : { result };
  }

  /**
   * Redoes a thumbnail made before thumbnails kept the whole frame (a 300×200
   * centre crop, which the viewer could not show in the photo's own frame).
   * Drawn from what the viewer shows (already at the photo's rotation, or a
   * video's poster frame) and swapped in alone through the edit lifecycle.
   */
  async refreshThumbnail(
    albumId: string,
    file: AlbumFile,
    key: string | null,
  ): Promise<ThumbnailRefreshResult> {
    if (!file.original || !file.thumbnail) return "current";
    const current = await this._imageQueryService.getImg(
      albumId,
      file,
      key,
      "thumbnail",
      {
        withText: false,
      },
    );
    if (!current || !(await this._isCroppedThumbnail(current.blob))) return "current";

    const source = await this._imageQueryService.getImg(
      albumId,
      file,
      key,
      viewerPart(file).type,
      { withText: false },
    );
    if (!source) return "current";
    const loaded = await this._canvasService.load(source.blob);
    try {
      const size = coverSize(loaded, THUMBNAIL_SIZE, THUMBNAIL_MAX_EDGE);
      // A 3:2 photo's crop was its whole frame already.
      if (sameSize(size, THUMBNAIL_SIZE)) return "current";
      const sealed = await this._seal(
        {
          type: "thumbnail",
          blob: loaded.resize({ cover: THUMBNAIL_SIZE, maxEdge: THUMBNAIL_MAX_EDGE })
            .blob,
        },
        key,
      );
      const result = await this._edit(albumId, file.fileId, [sealed], (parts) => ({
        thumbnail: parts.thumbnail!,
      }));
      return result === "success" ? "refreshed" : result;
    } finally {
      loaded.release();
    }
  }

  /** Old thumbnails were exactly the tile size; new ones only are for 3:2 photos. */
  private async _isCroppedThumbnail(blob: Blob) {
    const loaded = await this._canvasService.load(blob);
    try {
      return sameSize(loaded, THUMBNAIL_SIZE);
    } finally {
      loaded.release();
    }
  }

  /**
   * The server-side edit lifecycle: take the file's lock, upload the parts
   * into its staging area, commit the patch built from them; abort on failure.
   */
  private async _edit(
    albumId: string,
    fileId: string,
    sealed: SealedPart[],
    patch: (parts: Partial<Record<EditablePart, PartRef>>) => EditPatch,
  ): Promise<"success" | "edit-in-progress"> {
    const begin = await fetchCuple(client.beginEdit.post, {
      body: { albumId, fileId },
    }).thenKeep(["success", "edit-in-progress"]);
    if (begin.result === "edit-in-progress") return "edit-in-progress";
    const { editId } = begin;

    try {
      const parts: Partial<Record<EditablePart, PartRef>> = {};
      for (const part of sealed) {
        parts[part.type] = {
          iv: part.iv,
          chunkCount: await this._upload(albumId, fileId, editId, part),
        };
      }
      await fetchCuple(client.commitEdit.post, {
        body: { albumId, fileId, editId, patch: patch(parts) },
      }).thenKeepSuccess();
      return "success";
    } catch (err) {
      await fetchCuple(client.abortEdit.post, { body: { albumId, fileId, editId } })
        .thenKeepSuccess()
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
      {
        type: "thumbnail",
        blob: loaded.resize({ cover: THUMBNAIL_SIZE, maxEdge: THUMBNAIL_MAX_EDGE }).blob,
      },
    ];
  }

  private async _seal(
    { type, blob }: Rendition,
    key: string | null,
  ): Promise<SealedPart> {
    const { cryptedImg, iv } = await this._cryptoService.encryptImage(await blob, key);
    // Plain mode has no iv, but a replaced part needs a new one: the grid and
    // the browser cache (`?v=<iv>`) tell parts apart by it. Decryption
    // ignores it there, so a random version stands in.
    const version = key === null ? crypto.getRandomValues(new Uint8Array(12)) : iv;
    return { type, bytes: cryptedImg, iv: uint8ArrayToBase64(version) };
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

function sameSize(a: Size, b: Size) {
  return a.width === b.width && a.height === b.height;
}
