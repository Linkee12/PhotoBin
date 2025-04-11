import { arrayBuffer } from "stream/consumers";
import { client } from "../cuple";
import { base64ToArrayBuffer, base64toUint8Array } from "./base64";
import { importKey } from "./key";

type Metadata = {
  albumId: string;
  albumName: string;
  files: {
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number, original: number, thumbnail: number }
  }[];
};

export class ImageDownloadService {

  async getImg(metadata: Metadata,
    id: string,
    iv: string,
    key: string,
    type: "original" | "reduced" | "thumbnail") {
    const file = metadata.files.find((f) => f.fileId === id)
    if (file === undefined) return

    let parts: ArrayBuffer[] = []
    for (let i = 0; i < file.chunks[type]; i++) {

      console.log("response")
      const base64Part = await this._getPartsOfImage(metadata.albumId, id, type, i.toString());
      if (base64Part !== undefined) {
        const cryptedArraxBufferPart = base64ToArrayBuffer(base64Part)
        parts = [...parts, cryptedArraxBufferPart]
      }
    }
    const combinedImg = this._combineChunks(parts)
    const img = await this._decryptImage(combinedImg, key, iv);
    const blob = new Blob([img]);
    return { img: URL.createObjectURL(blob), id: id };
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

  private async _decryptImage(cryptedImg: ArrayBuffer, key: string, base64Iv: string) {
    const iv = base64toUint8Array(base64Iv);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
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
