import { Zip, ZipPassThrough } from "fflate";
import { ImageQueryService } from "./ImageQueryService";
import { AlbumFile, downloadFileName, downloadPart } from "./renditions";
import { sleep } from "../../../utils/retry";

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
 * into the origin-private file system and hands the result to the browser.
 */
export class DownloadService {
  constructor(private _imageQueryService: ImageQueryService) {}

  async download(props: DownloadProps) {
    const root = await navigator.storage.getDirectory();
    const zipName = `${props.albumName === "" ? "Album" : props.albumName}.zip`;
    const fileHandle = await root.getFileHandle(zipName, { create: true });
    const writable = await fileHandle.createWritable();

    const zipFinished = new Promise<void>((resolve, reject) => {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          reject(err);
          return;
        }
        void (async () => {
          if (chunk) await writable.write(chunk);
          if (final) {
            await writable.close();
            resolve();
          }
        })();
      });
      this._addFiles(zip, props).then(() => zip.end(), reject);
    });
    try {
      await zipFinished;
    } catch (e) {
      await writable.abort().catch(() => undefined);
      throw e;
    }

    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
