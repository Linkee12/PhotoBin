import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { CryptoService } from "./CryptoService";
import {
  DOWNLOAD_CONCURRENCY,
  mapWithConcurrency,
  PartTransport,
  PartType,
} from "./PartTransport";

export class ImageQueryService {
  private _transport = new PartTransport();

  constructor(private _cryptoService: CryptoService) {}

  async getImg(
    albumId: string,
    file: Metadata["files"][number],
    key: string | null,
    type: PartType,
  ) {
    const part = file[type];
    if (!part) return;
    const profile = new URLSearchParams(window.location.search).has("profile");

    const tFetch = performance.now();
    const chunks = await mapWithConcurrency(part.chunkCount, DOWNLOAD_CONCURRENCY, (i) =>
      this._transport.get(albumId, file.fileId, type, i),
    );
    const combinedImg = this._combineChunks(chunks);
    const tDecrypt = performance.now();
    const img = await this._cryptoService.decryptImage(combinedImg, key, part.iv);
    if (profile) {
      console.log(
        `[download] ${type} ${file.fileId.slice(0, 8)} (${chunks.length} chunks, ${combinedImg.byteLength} B) fetch: ${Math.round(tDecrypt - tFetch)}ms, decrypt: ${Math.round(performance.now() - tDecrypt)}ms`,
      );
    }

    const date = await this._cryptoService.decryptText(
      file.date.value,
      key,
      file.date.iv,
    );
    const blob = new Blob([img]);
    const fileName = await this._cryptoService.decryptText(
      file.fileName.value,
      key,
      file.fileName.iv,
    );
    return {
      img: type === "unsupportedFile" ? undefined : URL.createObjectURL(blob),
      id: file.fileId,
      fileName: fileName,
      blob,
      date,
    };
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
