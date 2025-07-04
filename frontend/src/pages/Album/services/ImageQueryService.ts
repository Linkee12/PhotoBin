import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { client } from "../../../cuple";
import { base64ToArrayBuffer } from "../../../utils/base64";
import { CryptoService } from "./CryptoService";

export class ImageQueryService {
  constructor(private _cryptoService: CryptoService) {}

  async getImg(
    albumId: string,
    file: Metadata["files"][number],
    key: string,
    type: "original" | "reduced" | "thumbnail",
  ) {
    let parts: ArrayBuffer[] = [];
    for (let i = 0; i < file[type].chunkCount; i++) {
      const base64Part = await this._getPartsOfImage(
        albumId,
        file.fileId,
        type,
        i.toString(),
      );
      if (base64Part !== undefined) {
        const cryptedArraxBufferPart = base64ToArrayBuffer(base64Part);
        parts = [...parts, cryptedArraxBufferPart];
      }
    }
    const iv = file[type].iv;
    const combinedImg = this._combineChunks(parts);
    const img = await this._cryptoService.decryptImage(combinedImg, key, iv);
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
      img: URL.createObjectURL(blob),
      id: file.fileId,
      fileName: fileName,
      blob,
      date,
    };
  }

  private async _getPartsOfImage(
    albumId: string,
    id: string,
    type: string,
    name: string,
  ) {
    const response = await client.getPartOfImage.get({
      query: { albumId: albumId, id: id, type: type, name: name },
    });
    if (response.result === "success") return response.file;
  }

  private _combineChunks(chunks: ArrayBuffer[]): ArrayBuffer {
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
