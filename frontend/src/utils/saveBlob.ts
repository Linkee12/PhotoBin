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
