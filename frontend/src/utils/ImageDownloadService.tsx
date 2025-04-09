import { client } from "../cuple";
import { base64ToArrayBuffer, base64toUint8Array } from "./base64";
import { importKey } from "./key";

export class ImageDownloadService {
  async getTumbnail(albumID: string, id: string, thumbnailIv: string, key: string) {
    const cryptedTumbnail = await this._getPartsOfImage(albumID, id, "thumbnail", "0");
    if (!cryptedTumbnail) return;
    const img = await this._decryptImage(cryptedTumbnail, key, thumbnailIv);
    const blob = new Blob([img]);
    return URL.createObjectURL(blob);
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
}
