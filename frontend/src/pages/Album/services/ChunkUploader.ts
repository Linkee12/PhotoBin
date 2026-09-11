import { client } from "../../../cuple";
import { arrayBufferToBase64 } from "../../../utils/base64";
import { PartType } from "./ImageQueryService";

const CHUNK_SIZE = 1000000; //byte

/** Splits an encrypted buffer into 1 MB parts. */
export function getChunks(file: ArrayBuffer) {
  const partsOfFile = [];
  for (let i = 0; i < file.byteLength; i += CHUNK_SIZE) {
    const part = file.slice(i, i + CHUNK_SIZE);
    partsOfFile.push(part);
  }
  return partsOfFile;
}

/**
 * Uploads parts one by one, yielding the byte length of each sent part.
 * With `editId` the parts land in the file's edit staging dir instead of the live dir.
 */
export async function* sendFileParts(
  files: ArrayBuffer[],
  albumId: string,
  fileId: string,
  fileType: PartType,
  editId?: string,
) {
  const profile = new URLSearchParams(window.location.search).has("profile");
  for (let i = 0; i < files.length; i++) {
    const t0 = performance.now();
    const objUrl = arrayBufferToBase64(files[i]);
    const tEncoded = performance.now();
    const responses = await client.uploadFilePart.post({
      body: {
        albumId: albumId,
        fileId: fileId,
        partName: i.toString(),
        fileType: fileType,
        encryptedFile: objUrl,
        editId,
      },
    });
    const tPosted = performance.now();
    if (profile) {
      console.log(
        `[upload] ${fileType}[${i}] base64: ${Math.round(tEncoded - t0)}ms, post: ${Math.round(tPosted - tEncoded)}ms`,
      );
    }
    if (responses.result !== "success") throw new Error("Error while uploading");
    yield files[i].byteLength;
  }
}
