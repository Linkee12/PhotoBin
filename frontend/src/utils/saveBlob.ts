import { mimeTypeOf } from "./mimeType";

/**
 * Chromium starts the download asynchronously; revoking right away can make
 * the blob fetch fail. Revoke once the download has certainly begun.
 */
const REVOKE_DELAY_MS = 60_000;

/** Hands `blob` to the browser as a download named `name`. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export type SavedFile = { blob: Blob; name: string };

/** Every iOS browser is WebKit; iPadOS presents itself as a Mac with touch. */
function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Saves `files`. On iOS they go through the share sheet, whose "Save Image" /
 * "Save Video" put photos in the Photos app and "Save to Files" takes the
 * rest; an `<a download>` there only ever reaches the Files app, and not at
 * all for some blobs. Must run within a tap (see `needsTapToSave`).
 */
export async function saveFiles(files: SavedFile[]): Promise<void> {
  if (files.length === 0) return;
  if (isIOS()) {
    const shared = files.map(
      ({ blob, name }) => new File([blob], name, { type: blob.type || mimeTypeOf(name) }),
    );
    if (navigator.canShare?.({ files: shared })) {
      try {
        await navigator.share({ files: shared });
      } catch (e) {
        // Closing the sheet is the user's choice, not a failure.
        if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
      }
      return;
    }
  }
  for (const { blob, name } of files) saveBlob(blob, name);
}

/**
 * iOS WebKit (every iOS browser) ignores a download or share that a recent tap
 * did not start, and preparing the file outlasts the tap; elsewhere a late
 * download is fine.
 */
export function needsTapToSave(): boolean {
  if (!isIOS()) return false;
  const activation = (navigator as { userActivation?: UserActivation }).userActivation;
  return !activation?.isActive;
}
