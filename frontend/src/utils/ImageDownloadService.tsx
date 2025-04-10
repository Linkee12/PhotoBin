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
    chunks: { reduced: number, original: number }
  }[];
};

export class ImageDownloadService {
  async getTumbnail(metadata: Metadata, id: string, key: string, thumbnailIv: string) {
    const cryptedTumbnail = await this._getPartsOfImage(metadata.albumId, id, "thumbnail", "0");
    if (!cryptedTumbnail) return;
    const img = await this._decryptImage(cryptedTumbnail, key, thumbnailIv);
    const blob = new Blob([img]);
    return { thumbnail: URL.createObjectURL(blob), id: id };
  }
  async getImg(metadata: Metadata,
    id: string,
    iv: string,
    key: string,
    type: "original" | "reduced") {
    const file = metadata.files.find((f) => f.fileId === id)
    if (file === undefined) return
    let parts: string[] = []
    for (let i = 0; i < file?.chunks[type]; i++) {
      const cryptedPart = await this._getPartsOfImage(metadata.albumId, id, type, i.toString());
      if (cryptedPart !== undefined) {
        parts = [...parts, cryptedPart]
      }
    }
    const combinedImg = this._combineChunks(parts)
    if (!parts) return;
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

  private async _decryptImage(base64: string, key: string, base64Iv: string) {
    const iv = base64toUint8Array(base64Iv);
    const cryptedImg = base64ToArrayBuffer(base64);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
  }
  private _combineChunks(chunks: string[]): string {
    let combined = ""
    for (const part of chunks) {
      combined = combined + part
    }

    return combined;
  }
}
