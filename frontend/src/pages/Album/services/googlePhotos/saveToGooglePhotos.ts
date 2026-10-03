import { ImageQueryService } from "../ImageQueryService";
import { AlbumFile, downloadFileName, downloadPart } from "../renditions";
import {
  BATCH_CREATE_LIMIT,
  chunk,
  createLibraryAlbum,
  createMediaItems,
  libraryAlbumTitle,
  uploadMediaBytes,
} from "./googlePhotosApi";

type SaveProps = {
  token: string;
  albumId: string;
  albumName: string;
  files: AlbumFile[];
  key: string | null;
  fileIds: string[];
  onProgress?: (percent: number) => void;
};

/**
 * Decrypts each selected file (its download rendition, like a zip download)
 * and adds it to a new Google Photos album named after this one. Returns how
 * many Google accepted; a file it rejects (e.g. an unsupported format) only
 * lowers that count.
 */
export async function saveToGooglePhotos(
  imageQueryService: ImageQueryService,
  props: SaveProps,
): Promise<{ saved: number; total: number }> {
  const selected = props.fileIds
    .map((id) => props.files.find((f) => f.fileId === id))
    .filter((f): f is AlbumFile => f !== undefined);
  const googleAlbumId = await createLibraryAlbum(
    props.token,
    libraryAlbumTitle(props.albumName),
  );

  const uploads: { uploadToken: string; fileName: string }[] = [];
  for (const [i, file] of selected.entries()) {
    const type = downloadPart(file);
    const media = await imageQueryService.getImg(props.albumId, file, props.key, type);
    if (media) {
      try {
        uploads.push({
          uploadToken: await uploadMediaBytes(props.token, media.blob, undefined),
          fileName: downloadFileName(type, media.fileName),
        });
      } catch (e) {
        console.error(`Saving ${media.fileName} to Google Photos failed`, e);
      }
    }
    props.onProgress?.(Math.floor(((i + 1) / selected.length) * 100));
  }

  let saved = 0;
  for (const batch of chunk(uploads, BATCH_CREATE_LIMIT)) {
    saved += await createMediaItems(props.token, googleAlbumId, batch);
  }
  return { saved, total: selected.length };
}
