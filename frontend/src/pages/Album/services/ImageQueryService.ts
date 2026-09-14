import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { CryptoService } from "./CryptoService";
import {
  DOWNLOAD_CONCURRENCY,
  mapWithConcurrency,
  PartTransport,
  PartType,
} from "./PartTransport";
import { isProfiling } from "../../../utils/profile";

export type { PartType };

export class ImageQueryService {
  private _transport = new PartTransport();

  constructor(private _cryptoService: CryptoService) {}

  /**
   * Fetches, reassembles and decrypts one rendition of a file into a `Blob`.
   * The caller decides whether it needs an object URL for it (and owns that
   * URL). `withText: false` skips decrypting the file name and date (the
   * album already has them decoded) — use it for thumbnails.
   */
  async getImg(
    albumId: string,
    file: Metadata["files"][number],
    key: string | null,
    type: PartType,
    options: { withText?: boolean } = {},
  ) {
    const part = file[type];
    if (!part) return;
    const profile = isProfiling();

    const tFetch = performance.now();
    const chunks = await mapWithConcurrency(part.chunkCount, DOWNLOAD_CONCURRENCY, (i) =>
      this._transport.get(albumId, file.fileId, type, i, { version: part.iv }),
    );
    const combinedImg = this._combineChunks(chunks);
    const tDecrypt = performance.now();
    const img = await this._cryptoService.decryptImage(combinedImg, key, part.iv);
    if (profile) {
      console.log(
        `[download] ${type} ${file.fileId.slice(0, 8)} (${chunks.length} chunks, ${combinedImg.byteLength} B) fetch: ${Math.round(tDecrypt - tFetch)}ms, decrypt: ${Math.round(performance.now() - tDecrypt)}ms`,
      );
    }

    const withText = options.withText ?? true;
    const date = withText
      ? await this._cryptoService.decryptText(file.date.value, key, file.date.iv)
      : "";
    const blob = new Blob([img]);
    const fileName = withText
      ? await this._cryptoService.decryptText(file.fileName.value, key, file.fileName.iv)
      : "";
    return { id: file.fileId, fileName, blob, date };
  }

  private _combineChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    if (chunks.length === 1) return chunks[0];
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return combined.buffer;
  }
}
