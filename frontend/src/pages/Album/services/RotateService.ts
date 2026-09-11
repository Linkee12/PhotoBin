import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { client } from "../../../cuple";
import { uint8ArrayToBase64 } from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { ImageQueryService } from "./ImageQueryService";
import { getChunks, sendFileParts } from "./ChunkUploader";
import { REDUCED_MAX_EDGE, REDUCED_QUALITY, THUMBNAIL_SIZE } from "./UploadService";

const FULL_RES_QUALITY = 0.95;

type AlbumFile = Metadata["files"][number];
export type Rotation = NonNullable<AlbumFile["rotation"]>;
export type RotateResult =
  | { result: "success"; rotation: Rotation }
  | { result: "edit-in-progress" };

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
  ) {}

  async rotateTo(
    albumId: string,
    file: AlbumFile,
    key: string | null,
    rotation: Rotation,
  ): Promise<RotateResult> {
    if (!file.original || file.originalVideo)
      throw new Error("Only images can be rotated");

    const original = await this._imageQueryService.getImg(albumId, file, key, "original");
    if (!original) throw new Error("Original image not found");

    const parts = await this._renderParts(original.blob, rotation);
    const encrypted = {
      edited: parts.edited && (await this._cryptoService.encryptImage(parts.edited, key)),
      reduced: await this._cryptoService.encryptImage(parts.reduced, key),
      thumbnail: await this._cryptoService.encryptImage(parts.thumbnail, key),
    };

    const begin = await client.beginEdit.post({ body: { albumId, fileId: file.fileId } });
    if (begin.result === "edit-in-progress") return { result: "edit-in-progress" };
    if (begin.result !== "success") throw new Error("Could not start editing");
    const editId = begin.editId;

    try {
      const chunkCounts = {
        edited: encrypted.edited
          ? await this._send(
              albumId,
              file.fileId,
              editId,
              "edited",
              encrypted.edited.cryptedImg,
            )
          : undefined,
        reduced: await this._send(
          albumId,
          file.fileId,
          editId,
          "reduced",
          encrypted.reduced.cryptedImg,
        ),
        thumbnail: await this._send(
          albumId,
          file.fileId,
          editId,
          "thumbnail",
          encrypted.thumbnail.cryptedImg,
        ),
      };
      const commit = await client.commitEdit.post({
        body: {
          albumId,
          fileId: file.fileId,
          editId,
          patch: {
            rotation,
            edited:
              encrypted.edited && chunkCounts.edited !== undefined
                ? {
                    iv: uint8ArrayToBase64(encrypted.edited.iv),
                    chunkCount: chunkCounts.edited,
                  }
                : undefined,
            reduced: {
              iv: uint8ArrayToBase64(encrypted.reduced.iv),
              chunkCount: chunkCounts.reduced,
            },
            thumbnail: {
              iv: uint8ArrayToBase64(encrypted.thumbnail.iv),
              chunkCount: chunkCounts.thumbnail,
            },
          },
        },
      });
      if (commit.result !== "success") throw new Error("Could not commit the edit");
      return { result: "success", rotation };
    } catch (err) {
      await client.abortEdit
        .post({ body: { albumId, fileId: file.fileId, editId } })
        .catch((abortErr: unknown) => console.error("abortEdit failed", abortErr));
      throw err;
    }
  }

  private async _renderParts(original: Blob, rotation: Rotation) {
    const canvas = await this._canvasService.rotate(original, rotation);
    const mimeType = await this._detectMimeType(original);
    const edited =
      rotation === 0
        ? undefined
        : await this._canvasService.encode(canvas, mimeType, FULL_RES_QUALITY);
    // The edit patch always carries a reduced rendition (even for small
    // originals that were uploaded without one), so the viewer never has to
    // fall back to the unrotated original.
    const loaded = await this._canvasService.load(canvas);
    const reduced = loaded.resize({
      maxEdge: REDUCED_MAX_EDGE,
      quality: REDUCED_QUALITY,
      mimeType: mimeType === "image/jpeg" ? "image/jpeg" : "image/webp",
    });
    const thumbnail = loaded.resize({ targetSize: THUMBNAIL_SIZE });
    return { edited, reduced: await reduced.blob, thumbnail: await thumbnail.blob };
  }

  private async _send(
    albumId: string,
    fileId: string,
    editId: string,
    type: "edited" | "reduced" | "thumbnail",
    encryptedBytes: ArrayBuffer,
  ) {
    const chunks = getChunks(encryptedBytes);
    const parts = sendFileParts(chunks, albumId, fileId, type, editId);
    // Drain the generator; progress is not surfaced for edits.
    while (!(await parts.next()).done);
    return chunks.length;
  }

  /**
   * Decrypted blobs carry no type, so sniff the magic bytes. PNG stays PNG
   * (lossless) and WebP stays WebP; JPEG and every other type become JPEG.
   */
  private async _detectMimeType(blob: Blob): Promise<string> {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const ascii = (from: number, to: number) =>
      String.fromCharCode(...head.slice(from, to));
    if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
    return "image/jpeg";
  }
}

/** File name for a downloaded `edited` part: non JPEG/PNG/WebP sources were re-encoded as JPEG. */
export function editedFileName(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") return fileName;
  return `${match ? fileName.slice(0, -match[0].length) : fileName}.jpg`;
}
