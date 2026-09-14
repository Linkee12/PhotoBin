import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { PartType } from "./PartTransport";

export type AlbumFile = Metadata["files"][number];
export type Rotation = NonNullable<AlbumFile["rotation"]>;

/** `edited` keeps these source formats; anything else was re-encoded as JPEG. */
const KEPT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * Which part feeds the viewer for a photo, and the rotation already baked into
 * its pixels (so the CSS turns can be derived). Small originals are uploaded
 * without a reduced rendition; a rotated photo always has one (rotation
 * re-renders it), so falling back to `original` only happens for unrotated
 * photos.
 */
export function viewerPart(file: AlbumFile): {
  type: "reduced" | "edited" | "original";
  rotation: Rotation;
} {
  const rotation = file.rotation ?? 0;
  if (file.reduced !== undefined) return { type: "reduced", rotation };
  if (file.edited !== undefined && rotation !== 0) return { type: "edited", rotation };
  return { type: "original", rotation: 0 };
}

/**
 * Which part a download saves. Videos also carry an `original` (their poster
 * frame), so the video comes first; a rotated photo downloads as its full-res
 * re-encode unless the untouched `original` is asked for explicitly.
 */
export function downloadPart(
  file: AlbumFile,
  photo: "rotated" | "original" = "rotated",
): PartType {
  if (file.originalVideo !== undefined) return "originalVideo";
  if (file.original === undefined) return "unsupportedFile";
  const isRotated = (file.rotation ?? 0) !== 0 && file.edited !== undefined;
  return photo === "rotated" && isRotated ? "edited" : "original";
}

/** File name to save a downloaded part under: only `edited` may change the format. */
export function downloadFileName(type: PartType, fileName: string): string {
  return type === "edited" ? editedFileName(fileName) : fileName;
}

/** File name for a downloaded `edited` part: non JPEG/PNG/WebP sources were re-encoded as JPEG. */
export function editedFileName(fileName: string): string {
  const extension = /\.([^.]*)$/.exec(fileName);
  if (extension && KEPT_EXTENSIONS.has(extension[1].toLowerCase())) return fileName;
  return `${extension ? fileName.slice(0, extension.index) : fileName}.jpg`;
}
