import { Zip, ZipPassThrough } from "fflate";
import { ImageQueryService } from "./ImageQueryService";
import { AlbumFile, downloadFileName, downloadPart } from "./renditions";
import { sleep } from "../../../utils/retry";
import { openZipSink } from "./zipSink";

type DownloadProps = {
  albumId: string;
  albumName: string;
  files: AlbumFile[];
  key: string | null;
  selectedImages: string[];
  onProgress?: (percent: number) => void;
};

/** Pushes to `ZipPassThrough` are cheap copies; yield to the event loop between them so the UI can update. */
const ZIP_PUSH_BYTES = 4 * 1024 * 1024;

/**
 * Zips the selected files (each as its download rendition, see `downloadPart`)
 * into the origin-private file system where the browser allows it (`openZipSink`).
 */
export class DownloadService {
  constructor(private _imageQueryService: ImageQueryService) {}

  /** Returns the zip and its file name; saving it is the caller's (see `utils/saveBlob.ts`). */
  async download(props: DownloadProps): Promise<{ blob: Blob; name: string }> {
    const name = `${props.albumName === "" ? "Album" : props.albumName}.zip`;
    const sink = await openZipSink();

    const zipFinished = new Promise<Blob>((resolve, reject) => {
      // Sequential, so every sink sees the chunks in order.
      let writes = Promise.resolve();
      const enqueue = (chunk: Uint8Array, final: boolean) => {
        writes = writes
          .then(async () => {
            await sink.write(chunk);
            if (final) resolve(await sink.close());
          })
          .catch(reject);
      };
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          reject(err);
          return;
        }
        enqueue(chunk, final);
      });
      this._addFiles(zip, props).then(() => zip.end(), reject);
    });
    try {
      return { blob: await zipFinished, name };
    } catch (e) {
      await sink.abort();
      throw e;
    }
  }

  private async _addFiles(zip: Zip, props: DownloadProps) {
    let count = 0;
    for (const id of props.selectedImages) {
      const file = props.files.find((f) => f.fileId === id);
      if (!file) continue;
      const type = downloadPart(file);
      const origin = await this._imageQueryService.getImg(
        props.albumId,
        file,
        props.key,
        type,
      );
      if (!origin) continue;

      const entry = new ZipPassThrough(downloadFileName(type, origin.fileName));
      zip.add(entry);
      const bytes = new Uint8Array(await origin.blob.arrayBuffer());
      for (let offset = 0; offset < bytes.length; offset += ZIP_PUSH_BYTES) {
        const end = Math.min(offset + ZIP_PUSH_BYTES, bytes.length);
        const isLast = end === bytes.length;
        entry.push(bytes.subarray(offset, end), isLast);
        if (!isLast) await sleep(0);
      }
      ++count;
      props.onProgress?.(Math.floor((count / props.selectedImages.length) * 100));
    }
  }
}
