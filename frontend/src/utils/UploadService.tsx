import { client } from "../cuple";
import { ImageResizeService } from "./ImageResizeService";
import { _arrayBufferToBase64, importKey } from "./key";

export class UploadService {
  constructor(private _imageResizeService: ImageResizeService) {}

  async upload(file: File, props: { key: string; albumId: string }) {
    const UUID = crypto.randomUUID();
    const thumbnail = await this._imageResizeService.resize(file, {
      targetSize: { width: 300, height: 200 },
    });
    const cryptedThumbnail = await this._encryptImage(await thumbnail.blob, props.key);
    const cryptedOriginImage = await this._encryptImage(file, props.key);
    const reduce = await this._imageResizeService.resize(file, {
      quality: 0.3,
    });
    const cryptedReducedImage = await this._encryptImage(await reduce.blob, props.key);
    const partsOfOriginImg = [];
    const partsOfReducedImg = [];
    const originImgByte = cryptedOriginImage.cryptedImg.byteLength;

    for (let i = 0; i < originImgByte; i += 1000000) {
      const part = cryptedOriginImage.cryptedImg.slice(i, i + 1000000);
      partsOfOriginImg.push(part);
    }
    const reducedImgByte = cryptedReducedImage.cryptedImg.byteLength;
    for (let i = 0; i < reducedImgByte; i += 1000000) {
      if (reduce !== null) {
        const part = cryptedReducedImage.cryptedImg.slice(i, i + 1000000);
        partsOfReducedImg.push(part);
      }
    }
    const objUrl = _arrayBufferToBase64(cryptedThumbnail.cryptedImg);
    let response = await client.addAlbum.post({
      body: {
        albumID: props.albumId,
        uuid: UUID,
        fileName: "0",
        name: "thumbnail",
        file: objUrl,
      },
    });
    partsOfOriginImg.map(async (part, i) => {
      const objUrl = _arrayBufferToBase64(part);
      response = await client.addAlbum.post({
        body: {
          albumID: props.albumId,
          uuid: UUID,
          fileName: i.toString(),
          name: "origin",
          file: objUrl,
        },
      });
    });
    partsOfReducedImg.map(async (part, i) => {
      const objUrl = _arrayBufferToBase64(part);
      response = await client.addAlbum.post({
        body: {
          albumID: props.albumId,
          uuid: UUID,
          fileName: i.toString(),
          name: "reduced",
          file: objUrl,
        },
      });
    });

    if (response.result === "success") {
      return thumbnail.url;
    }
  }
  private async _encryptImage(file: File | Blob, key: string) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const buffer = await file.arrayBuffer();
    const cryptedImg = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      buffer,
    );
    return { cryptedImg, iv };
  }
}
