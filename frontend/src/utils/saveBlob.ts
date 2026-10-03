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

/**
 * iOS WebKit (every iOS browser) ignores a download that a recent tap did not
 * start, and zipping outlasts the tap; elsewhere a late download is fine.
 */
export function needsTapToSave(): boolean {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const activation = (navigator as { userActivation?: UserActivation }).userActivation;
  return !activation?.isActive;
}
