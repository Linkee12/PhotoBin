import { client } from "../../../cuple";
import { base64ToArrayBuffer } from "../../../utils/base64";
import { CryptoService } from "./CryptoService";

type Metadata = {
  albumId: string;
  albumName: { value: string; iv: string };
  files: {
    fileName: { value: string; iv: string };
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number; original: number; thumbnail: number };
  }[];
};

export class ImageQueryService {
  constructor(private _cryptoService: CryptoService) {}

  async getImg(
    albumId: string,
    file: Metadata["files"][number],
    key: string,
    type: "original" | "reduced" | "thumbnail",
  ) {
    let parts: ArrayBuffer[] = [];
    for (let i = 0; i < file.chunks[type]; i++) {
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
    const iv = this._getIv(file, type);
    const combinedImg = this._combineChunks(parts);
    const img = await this._cryptoService.decryptImage(combinedImg, key, iv);
    const blob = new Blob([img]);
    const fileName = await this._cryptoService.decryptText(
      file.fileName.value,
      key,
      file.fileName.iv,
    );
    return { img: URL.createObjectURL(blob), id: file.fileId, fileName: fileName, blob };
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

  private _getIv(
    file: Metadata["files"][number],
    type: "original" | "reduced" | "thumbnail",
  ) {
    switch (type) {
      case "original":
        return file.originalIv;
      case "reduced":
        return file.reducedIv;
      case "thumbnail":
        return file.thumbnailIv;
    }
  }
}
