import { client } from "../../../cuple";
import { Metadata } from "../hooks/useAlbumContext";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../../utils/base64";
import { ImageResizeService } from "./ImageResizeService";
import { CryptoService } from "./CryptoService";
import { formatDate } from "../../../utils/formatDate";

const SIZE = { width: 300, height: 200 };
const QUALITY = 0.3;
const VIDEOTYPES = ["video/mp4", "video/webm", "video/ogg"];
const IMAGETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

type UploadReturn =
  | {
      thumbnail: string;
      fileId: string;
      date: string;
    }
  | undefined
  | null;

export class UploadService {
  constructor(
    private _imageResizeService: ImageResizeService,
    private _cryptoService: CryptoService,
  ) {}

  async upload(
    file: File,
    props: { key: string; albumId: string },
  ): Promise<UploadReturn> {
    if (VIDEOTYPES.includes(file.type)) {
      return null;
    }
    if (IMAGETYPES.includes(file.type)) {
      const uuid = crypto.randomUUID();
      const date = formatDate(file.lastModified);
      const thumbnail = await this._imageResizeService.resize(file, {
        targetSize: SIZE,
      });
      const reduce = await this._imageResizeService.resize(file, {
        quality: QUALITY,
      });
      const cryptedThumbnail = await this._cryptoService.encryptImage(
        await thumbnail.blob,
        props.key,
      );
      const cryptedOriginImage = await this._cryptoService.encryptImage(file, props.key);
      const cryptedReducedImage = await this._cryptoService.encryptImage(
        await reduce.blob,
        props.key,
      );
      const cryptedFileName = await this._cryptoService.encrypString(
        file.name,
        props.key,
      );
      const cryptedDate = await this._cryptoService.encrypString(
        date.toString(),
        props.key,
      );

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
          fileName: {
            iv: uint8ArrayToBase64(cryptedFileName.iv),
            value: arrayBufferToBase64(cryptedFileName.encryptedText),
          },
          date: {
            iv: uint8ArrayToBase64(cryptedDate.iv),
            value: arrayBufferToBase64(cryptedDate.encryptedText),
          },
          fileId: uuid,
          original: {
            iv: uint8ArrayToBase64(cryptedOriginImage.iv),
            chunkCount: slicedOriginImg.length,
          },
          reduced: {
            iv: uint8ArrayToBase64(cryptedReducedImage.iv),
            chunkCount: slicedOriginImg.length,
          },
          thumbnail: {
            iv: uint8ArrayToBase64(cryptedThumbnail.iv),
            chunkCount: 1,
          },
        };
        await this._finalize(props.albumId, fileMetadata);
        return {
          thumbnail: thumbnail.url,
          fileId: uuid,
          date: date,
        };
      }
    }
  }

  async saveName(albumId: string, name: string, key: string) {
    const cryptedName = await this._cryptoService.encrypString(name, key);
    const iv = uint8ArrayToBase64(cryptedName.iv);
    const value = arrayBufferToBase64(cryptedName.encryptedText);
    client.editAlbumName.post({
      body: { albumId, albumName: { iv, value } },
    });
  }

  private async _finalize(albumId: string, fileMetadata: Metadata["files"][0]) {
    client.finalizeFile.post({
      body: {
        albumId,
        fileMetadata,
      },
    });
  }

  async addAlbumName(albumId: string, albumName: { value: string; iv: string }) {
    const res = await client.editAlbumName.post({
      body: { albumId, albumName },
    });
    if (res.result !== "success") return { isSuccess: false };
  }
  private _getChunks(file: ArrayBuffer) {
    const SIZE = 1000000; //byte
    const partsOfFile = [];

    for (let i = 0; i < file.byteLength; i += SIZE) {
      const part = file.slice(i, i + SIZE);
      partsOfFile.push(part);
    }
    return partsOfFile;
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
