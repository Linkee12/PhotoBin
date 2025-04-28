import { client } from "../cuple";
import { Metadata } from "../pages/Album/hooks/useAlbumContext";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "./base64";
import { ImageResizeService } from "./ImageResizeService";
import { importKey } from "./key";

const SIZE = { width: 300, height: 200 };
const QUALITY = 0.3;
type UploadReturn =
  | {
      thumbnail: string;
      fileId: string;
    }
  | undefined;

export class UploadService {
  constructor(private _imageResizeService: ImageResizeService) {}

  async upload(
    file: File,
    props: { key: string; albumId: string },
  ): Promise<UploadReturn> {
    const uuid = crypto.randomUUID();
    console.log(file.name);
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
      uuid,
      "original",
    );
    const reducedRes = await this._sendFile(
      slicedReducedeImg,
      props.albumId,
      uuid,
      "reduced",
    );
    const thumbRes = await this._sendFile(
      [cryptedThumbnail.cryptedImg],
      props.albumId,
      uuid,
      "thumbnail",
    );
    if (originRes.isSuccess || reducedRes.isSuccess || thumbRes.isSuccess) {
      const fileMetadata = {
        fileName: file.name,
        thumbnail: thumbnail.url,
        fileId: uuid,
        originalIv: uint8ArrayToBase64(cryptedOriginImage.iv),
        thumbnailIv: uint8ArrayToBase64(cryptedThumbnail.iv),
        reducedIv: uint8ArrayToBase64(cryptedReducedImage.iv),
        chunks: {
          reduced: slicedReducedeImg.length,
          original: slicedOriginImg.length,
          thumbnail: 1,
        },
      };
      await this._finalize(props.albumId, fileMetadata);
      return {
        thumbnail: thumbnail.url,
        fileId: uuid,
      };
    }
  }
  async _finalize(albumId: string, fileMetadata: Metadata["files"][0]) {
    client.finalizeFile.post({
      body: {
        albumId,
        fileMetadata,
      },
    });
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

  private async _sendFile(
    files: ArrayBuffer[],
    albumId: string,
    fileId: string,
    fileType: string,
  ) {
    for (let i = 0; i < files.length; i++) {
      const objUrl = arrayBufferToBase64(files[i]);
      const responses = await client.uploadFilePart.post({
        body: {
          albumId: albumId,
          fileId: fileId,
          partName: i.toString(),
          fileType: fileType,
          encryptedFile: objUrl,
        },
      });
      if (responses.result !== "success") return { isSuccess: false };
    }
    return { isSuccess: true };
  }
}
