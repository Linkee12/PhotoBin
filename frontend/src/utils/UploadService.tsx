import { client } from "../cuple";
import { arrayBufferToBase64 } from "./base64";
import { ImageResizeService } from "./ImageResizeService";
import { importKey } from "./key";

const SIZE = { width: 300, height: 200 };
const QUALITY = 0.3;
type UploadReturn = Promise<
  | {
      thumbnail: string;
      fileId: string;
      originalIv: Uint8Array;
      thumbnailIv: Uint8Array;
      reducedIv: Uint8Array;
      chunks: { reduced: number; original: number };
    }
  | undefined
>;

export class UploadService {
  constructor(private _imageResizeService: ImageResizeService) {}

  async upload(
    file: File,
    UUID: string,
    props: { key: string; albumId: string },
  ): UploadReturn {
    const thumbnail = await this._imageResizeService.resize(file, {
      targetSize: SIZE,
    });
    const reduce = await this._imageResizeService.resize(file, {
      quality: QUALITY,
    });

    const cryptedThumbnail = await this._encryptImage(await thumbnail.blob, props.key);
    const cryptedOriginImage = await this._encryptImage(file, props.key);
    const cryptedReducedImage = await this._encryptImage(await reduce.blob, props.key);

    const slicedOriginImg = this._getChunks(cryptedOriginImage.cryptedImg);
    const slicedReducedeImg = this._getChunks(cryptedReducedImage.cryptedImg);

    const originRes = await this._sendFile(
      slicedOriginImg,
      props.albumId,
      UUID,
      "original",
    );
    const reducedRes = await this._sendFile(
      slicedReducedeImg,
      props.albumId,
      UUID,
      "reduced",
    );
    const thumbRes = await this._sendFile(
      [cryptedThumbnail.cryptedImg],
      props.albumId,
      UUID,
      "thumbnail",
    );
    if (originRes.isSuccess || reducedRes.isSuccess || thumbRes.isSuccess) {
      return {
        thumbnail: thumbnail.url,
        fileId: UUID,
        originalIv: cryptedOriginImage.iv,
        thumbnailIv: cryptedThumbnail.iv,
        reducedIv: cryptedReducedImage.iv,
        chunks: { reduced: slicedReducedeImg.length, original: slicedOriginImg.length },
      };
    }
  }
  async uploadMetadata(albumID: string, metadata: string) {
    const response = await client.addMetadata.post({ body: { albumID, metadata } });
    if (response.result !== "success") return { isSuccess: false };
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
  private _getChunks(img: ArrayBuffer) {
    const SIZE = 1000000; //byte
    const partsOfImg = [];

    for (let i = 0; i < img.byteLength; i += SIZE) {
      const part = img.slice(i, i + SIZE);
      partsOfImg.push(part);
    }
    return partsOfImg;
  }

  private async _sendFile(files: ArrayBuffer[], id: string, uuid: string, name: string) {
    for (let i = 0; i < files.length; i++) {
      const objUrl = arrayBufferToBase64(files[i]);
      const responses = await client.addAlbum.post({
        body: {
          albumID: id,
          uuid: uuid,
          fileName: i.toString(),
          name: name,
          file: objUrl,
        },
      });
      if (responses.result !== "success") return { isSuccess: false };
    }
    return { isSuccess: true };
  }
}
