import {
  mapWithConcurrency,
  PartTransport,
  PartType,
  splitIntoChunks,
  UPLOAD_CONCURRENCY,
} from "./PartTransport";

const transport = new PartTransport();

/** Splits an encrypted buffer into `CHUNK_SIZE` parts. */
export function getChunks(file: ArrayBuffer) {
  return splitIntoChunks(file);
}

/**
 * Uploads parts through the binary transport (up to `UPLOAD_CONCURRENCY` in
 * flight), yielding the byte length of each part as it is confirmed.
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
  const t0 = performance.now();
  await mapWithConcurrency(files.length, UPLOAD_CONCURRENCY, (i) =>
    transport.put(albumId, fileId, fileType, i, files[i], { editId }),
  );
  if (profile) {
    console.log(
      `[upload] ${fileType} (${files.length} chunks): ${Math.round(performance.now() - t0)}ms`,
    );
  }
  for (const file of files) yield file.byteLength;
}
