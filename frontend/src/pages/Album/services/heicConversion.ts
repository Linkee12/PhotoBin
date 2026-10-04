import type { CanvasService } from "./CanvasService";
import { mimeTypeOf } from "../../../utils/mimeType";

const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const JPEG_QUALITY = 0.92;
/**
 * Longest edge of a JPEG drawn by the browser's own HEIC decoder (Safari).
 * iOS refuses canvases over 16.7 megapixels; 4096 × 4096 is exactly that.
 */
const NATIVE_MAX_EDGE = 4096;

/** JPEG copies made here; their bytes are not reproducible, so they are never resumed. */
const convertedCopies = new WeakSet<File>();

export function isConvertedCopy(file: File): boolean {
  return convertedCopies.has(file);
}

function typeOf(file: File): string {
  return file.type || mimeTypeOf(file.name);
}

export function isHeic(file: File): boolean {
  return HEIC_TYPES.has(typeOf(file));
}

/** `IMG_0001.HEIC` → `IMG_0001` */
function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Puts a JPEG copy in front of every HEIC file, which most browsers cannot
 * show. The HEIC itself is still uploaded and becomes the JPEG's attached file
 * (same base name, see `groupFiles`). A HEIC that already comes with a picked
 * image of the same name, or that cannot be decoded, is left alone.
 */
export async function withJpegCopies(
  files: readonly File[],
  canvasService: CanvasService,
): Promise<File[]> {
  const pickedImages = new Set(
    files
      .filter((file) => typeOf(file).startsWith("image/") && !isHeic(file))
      .map((file) => stem(file.name).toLowerCase()),
  );
  const result: File[] = [];
  for (const file of files) {
    if (isHeic(file) && !pickedImages.has(stem(file.name).toLowerCase())) {
      try {
        result.push(await toJpeg(file, canvasService));
      } catch (e) {
        console.warn(`[upload] could not convert ${file.name} to JPEG`, e);
      }
    }
    result.push(file);
  }
  return result;
}

async function toJpeg(file: File, canvasService: CanvasService): Promise<File> {
  const jpeg = await nativeJpeg(file, canvasService).catch(() => libheifJpeg(file));
  const copy = new File([jpeg], `${stem(file.name)}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
  convertedCopies.add(copy);
  return copy;
}

/** Safari decodes HEIC itself; elsewhere this rejects and libheif takes over. */
async function nativeJpeg(file: File, canvasService: CanvasService): Promise<Blob> {
  const loaded = await canvasService.load(file);
  try {
    return await loaded.resize({
      maxEdge: NATIVE_MAX_EDGE,
      mimeType: "image/jpeg",
      quality: JPEG_QUALITY,
    }).blob;
  } finally {
    loaded.release();
  }
}

/** libheif compiled to wasm, a ~3 MB chunk loaded only when a HEIC needs it. */
async function libheifJpeg(file: File): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: JPEG_QUALITY });
}
