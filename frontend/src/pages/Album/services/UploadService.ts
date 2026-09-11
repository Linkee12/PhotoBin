import { client } from "../../../cuple";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../../utils/base64";
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { formatDate } from "../../../utils/formatDate";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { getChunks, sendFileParts } from "./ChunkUploader";
import { PartType } from "./ImageQueryService";

export const THUMBNAIL_SIZE = { width: 300, height: 200 };
export const REDUCED_QUALITY = 0.5;
const SIZE = THUMBNAIL_SIZE;
const QUALITY = REDUCED_QUALITY;
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
      name: string;
      date: string;
      isVideo: boolean;
    }
  | { result: "progress"; bytes: number };

export class UploadService {
  constructor(
    private _canvasService: CanvasService,
    private _cryptoService: CryptoService,
  ) {}
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async *upload(
    file: File,
    props: { key: string; albumId: string },
  ): AsyncGenerator<UploadYield> {
    const profile = new URLSearchParams(window.location.search).has("profile");
    const t0 = performance.now();
    const log = (label: string, start: number) => {
      if (profile)
        console.log(
          `[upload] ${file.name} ${label}: ${Math.round(performance.now() - start)}ms`,
        );
    };
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
      const tResize = performance.now();
      thumbnail = await this._canvasService.resize(image, {
        targetSize: SIZE,
      });
      const reduce = await this._canvasService.resize(image, {
        quality: QUALITY,
      });
      log("resize", tResize);

      const tEncrypt = performance.now();
      const cryptedThumbnail = await this._cryptoService.encryptImage(
        await thumbnail.blob,
        props.key,
      );
      const cryptedOriginImage = await this._cryptoService.encryptImage(image, props.key);
      const cryptedReducedImage = await this._cryptoService.encryptImage(
        await reduce.blob,
        props.key,
      );
      log("encrypt(thumb+original+reduced)", tEncrypt);

      const slicedOriginImg = this._getChunks(cryptedOriginImage.cryptedImg);
      const slicedReducedImg = this._getChunks(cryptedReducedImage.cryptedImg);

      const tOrigin = performance.now();
      const originRes = this._sendFile(slicedOriginImg, props.albumId, uuid, "original");
      for await (const bytes of originRes) yield { result: "progress", bytes };
      log(`send original (${slicedOriginImg.length} chunks)`, tOrigin);

      const tReduced = performance.now();
      const reducedRes = this._sendFile(slicedReducedImg, props.albumId, uuid, "reduced");
      for await (const bytes of reducedRes) yield { result: "progress", bytes };
      log(`send reduced (${slicedReducedImg.length} chunks)`, tReduced);

      const tThumb = performance.now();
      const thumbRes = this._sendFile(
        [cryptedThumbnail.cryptedImg],
        props.albumId,
        uuid,
        "thumbnail",
      );
      for await (const bytes of thumbRes) yield { result: "progress", bytes };
      log("send thumbnail", tThumb);
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
    log("TOTAL", t0);
    yield {
      result: "finish",
      thumbnail: thumbnail ? thumbnail.url : undefined,
      name: file.name,
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
    return getChunks(file);
  }

  private _sendFile(
    files: ArrayBuffer[],
    albumId: string,
    fileId: string,
    fileType: PartType,
  ) {
    return sendFileParts(files, albumId, fileId, fileType);
  }
}
