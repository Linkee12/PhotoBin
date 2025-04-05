import { client } from "../cuple";
import { ImageResizeService } from "./ImageResizeService";
import { _arrayBufferToBase64, importKey } from "./key";

const SIZE = { width: 300, height: 200 };
const QUALITY = 0.3;

export class UploadService {
  constructor(private _imageResizeService: ImageResizeService) {}

  async upload(file: File, props: { key: string; albumId: string }) {
    const UUID = crypto.randomUUID();

    const thumbnail = await this._imageResizeService.resize(file, {
      targetSize: SIZE,
    });
    const reduce = await this._imageResizeService.resize(file, {
      quality: QUALITY,
    });

    const cryptedThumbnail = await this._encryptImage(await thumbnail.blob, props.key);
    const cryptedOriginImage = await this._encryptImage(file, props.key);
    const cryptedReducedImage = await this._encryptImage(await reduce.blob, props.key);

    const slicedOriginImg = this._fileCutting(cryptedOriginImage.cryptedImg);
    const slicedReducedeImg = this._fileCutting(cryptedReducedImage.cryptedImg);

    await this._sendFile(slicedOriginImg, props.albumId, UUID);
    await this._sendFile(slicedReducedeImg, props.albumId, UUID);
    const thumbRes = await this._sendFile(
      [cryptedThumbnail.cryptedImg],
      props.albumId,
      UUID,
    );

    if (thumbRes === "success") {
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
  private _fileCutting(img: ArrayBuffer) {
    const SIZE = 1000000; //byte
    const partsOfImg = [];

    for (let i = 0; i < img.byteLength; i += SIZE) {
      const part = img.slice(i, i + SIZE);
      partsOfImg.push(part);
    }
    return partsOfImg;
  }
  private async _sendFile(file: ArrayBuffer[], id: string, uuid: string) {
    let response;
    file.map(async (part, i) => {
      const objUrl = _arrayBufferToBase64(part);
      response = await client.addAlbum.post({
        body: {
          albumID: id,
          uuid: uuid,
          fileName: i.toString(),
          name: "reduced",
          file: objUrl,
        },
      });
    });
    return response;
  }
}
