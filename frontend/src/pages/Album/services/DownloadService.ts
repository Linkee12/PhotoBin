import { Zip, ZipPassThrough } from "fflate";
import { ImageQueryService } from "./ImageQueryService";
import { AlbumContextType } from "../hooks/useAlbumContext";

type DownloadProps = {
  selectedImages: string[];
  albumContext: AlbumContextType;
};

export class DownloadService {
  constructor(private _imageQueryService: ImageQueryService) {}

  // eslint-disable-next-line sonarjs/cognitive-complexity
  async download(props: DownloadProps) {
    try {
      const root = await navigator.storage.getDirectory();
      const albumName =
        props.albumContext.decodedValues.albumName === ""
          ? "Album"
          : props.albumContext.decodedValues.albumName;
      const fileHandle = await root.getFileHandle(albumName, { create: true });
      const writable = await fileHandle.createWritable();

      let zipFinished = false;
      const zip = new Zip(async (err, chunk, final) => {
        if (err) {
          console.error("ZIP error:", err);
          return;
        }

        if (chunk) {
          await writable.write(chunk);
        }

        if (final) {
          console.log("ZIP successfully completed.");
          await writable.close();
          zipFinished = true;
        }
      });

      let count = 0;
      for (const imgID of props.selectedImages) {
        if (!props.albumContext.metadata?.albumId || !props.albumContext.metadata)
          continue;

        const file = props.albumContext.metadata.files.find((f) => f.fileId === imgID);

        if (!file) continue;

        const type = file.originalVideo !== undefined ? "originalVideo" : "original";
        const origin = await this._imageQueryService.getImg(
          props.albumContext.metadata.albumId,
          file,
          props.albumContext.key,
          type,
        );
        if (!origin) continue;

        const blob = origin.blob;
        const buffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        const passThrough = new ZipPassThrough(origin.fileName);

        zip.add(passThrough);

        const chunkSize = 64 * 1024;
        let offset = 0;

        while (offset < uint8.length) {
          const end = Math.min(offset + chunkSize, uint8.length);
          const chunk = uint8.slice(offset, end);
          const isLastChunk = end === uint8.length;

          passThrough.push(chunk, isLastChunk);
          offset = end;
          if (!isLastChunk) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }
        ++count;
        console.log(
          "Progress...:" + Math.floor((count / props.selectedImages.length) * 100) + "%",
        );
      }

      zip.end();

      while (!zipFinished) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return url;
    } catch (e) {
      console.error("Error creating ZIP:", e);
      throw e;
    }
  }
}
