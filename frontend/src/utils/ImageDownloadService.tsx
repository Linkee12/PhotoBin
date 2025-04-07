import { client } from "../cuple";
import { _base64ToArrayBuffer, importKey } from "./key";

export class ImageDownloadService {
  async getTumbnail(albumID: string, id: string) {
    const cryptedTumbnail = await this._getPartsOfImage(albumID, id, "thumbnail", "0");
    console.log(cryptedTumbnail);
  }

  private async _getPartsOfImage(
    albumId: string,
    id: string,
    type: string,
    name: string,
  ) {
    const asd = await client.getPartOfImage.get({
      query: { albumId: albumId, id: id, type: type, name: name },
    });
    console.log(asd);
  }

  private async _decryptImage(base64: string, key: string, iv: BufferSource) {
    const cryptedImg = _base64ToArrayBuffer(base64);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
    console.log(decryptedBuffer);
  }
}
