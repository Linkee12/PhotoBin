const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  zip: "application/zip",
};

/**
 * The media type a file name implies, "" when unknown. Decrypted blobs carry
 * no type of their own, and Safari will neither play an untyped video blob nor
 * offer to save an untyped download to Photos.
 */
export function mimeTypeOf(fileName: string): string {
  const extension = /\.([^.]*)$/.exec(fileName)?.[1].toLowerCase();
  return (extension && BY_EXTENSION[extension]) ?? "";
}
