import { client } from "../../../cuple";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { formatDate } from "../../../utils/formatDate";
import { Metadata } from "../../../../../backend/src/services/MetadataService";

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

type UploadYield =
  | {
      result: "finish";
      thumbnail: string | undefined;
      fileId: string;
      date: string;
      isVideo: boolean;
    }
  | { result: "progress"; bytes: number };

export class UploadService {
  constructor(
    private _canvasService: CanvasService,
    private _cryptoService: CryptoService,
  ) {}
  async *upload(
    file: File,
    props: { key: string; albumId: string },
  ): AsyncGenerator<UploadYield> {
    const uuid = crypto.randomUUID();
    const date = formatDate(file.lastModified);
    const cryptedFileName = await this._cryptoService.encrypString(file.name, props.key);
    const cryptedDate = await this._cryptoService.encrypString(
      date.toString(),
      props.key,
    );
    let cryptedVideo;
    let cryptedUnsupported;
    let slicedVideo = [];
    let image;
    let fileMetadata;
    let thumbnail;

    if (IMAGETYPES.includes(file.type) || VIDEOTYPES.includes(file.type)) {
      if (IMAGETYPES.includes(file.type)) {
        image = file;
      } else if (VIDEOTYPES.includes(file.type)) {
        image = await this._canvasService.getImageFromVideo(file);
        cryptedVideo = await this._cryptoService.encryptImage(file, props.key);
        slicedVideo = this._getChunks(cryptedVideo.cryptedImg);
        const videoRes = this._sendFile(
          slicedVideo,
          props.albumId,
          uuid,
          "originalVideo",
        );
        for await (const bytes of videoRes) yield { result: "progress", bytes };
      }
      if (image === undefined) return;
      thumbnail = await this._canvasService.resize(image, {
        targetSize: SIZE,
      });
      const reduce = await this._canvasService.resize(image, {
        quality: QUALITY,
      });
      const cryptedThumbnail = await this._cryptoService.encryptImage(
        await thumbnail.blob,
        props.key,
      );
      const cryptedOriginImage = await this._cryptoService.encryptImage(image, props.key);
      const cryptedReducedImage = await this._cryptoService.encryptImage(
        await reduce.blob,
        props.key,
      );
      const slicedOriginImg = this._getChunks(cryptedOriginImage.cryptedImg);
      const slicedReducedImg = this._getChunks(cryptedReducedImage.cryptedImg);

      const originRes = this._sendFile(slicedOriginImg, props.albumId, uuid, "original");
      for await (const bytes of originRes) yield { result: "progress", bytes };

      const reducedRes = this._sendFile(slicedReducedImg, props.albumId, uuid, "reduced");
      for await (const bytes of reducedRes) yield { result: "progress", bytes };

      const thumbRes = this._sendFile(
        [cryptedThumbnail.cryptedImg],
        props.albumId,
        uuid,
        "thumbnail",
      );
      for await (const bytes of thumbRes) yield { result: "progress", bytes };
      fileMetadata = {
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
          chunkCount: slicedReducedImg.length,
        },
        thumbnail: {
          iv: uint8ArrayToBase64(cryptedThumbnail.iv),
          chunkCount: 1,
        },
        originalVideo:
          slicedVideo.length === 0
            ? undefined
            : {
                iv: uint8ArrayToBase64(
                  (cryptedVideo as { iv: Uint8Array<ArrayBuffer> }).iv,
                ),
                chunkCount: slicedVideo.length,
              },
      };
    } else {
      cryptedUnsupported = await this._cryptoService.encryptImage(file, props.key);
      const slicedUnsopported = this._getChunks(cryptedUnsupported.cryptedImg);
      const videoRes = this._sendFile(
        slicedUnsopported,
        props.albumId,
        uuid,
        "unsupportedFile",
      );
      for await (const bytes of videoRes) yield { result: "progress", bytes };
      fileMetadata = {
        fileName: {
          iv: uint8ArrayToBase64(cryptedFileName.iv),
          value: arrayBufferToBase64(cryptedFileName.encryptedText),
        },
        date: {
          iv: uint8ArrayToBase64(cryptedDate.iv),
          value: arrayBufferToBase64(cryptedDate.encryptedText),
        },
        fileId: uuid,
        unsupportedFile: {
          iv: uint8ArrayToBase64(cryptedUnsupported.iv),
          chunkCount: slicedUnsopported.length,
        },
      };
    }

    await this._finalize(props.albumId, fileMetadata);
    yield {
      result: "finish",
      thumbnail: thumbnail ? thumbnail.url : undefined,
      fileId: uuid,
      date: date,
      isVideo: slicedVideo.length !== 0,
    };
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

  private async *_sendFile(
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
      if (responses.result !== "success") throw new Error("Error while uploading");
      yield files[i].byteLength;
    }
  }
}
