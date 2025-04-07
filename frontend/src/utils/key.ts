const ALGO = { name: "AES-GCM", length: 256 };
const EXTRACTABLE = true;
const USAGES = ["encrypt", "decrypt"] as const;

export async function genKey(): Promise<string> {
  const cryptoKey = await crypto.subtle.generateKey(ALGO, EXTRACTABLE, USAGES);
  const key = await crypto.subtle.exportKey("raw", cryptoKey);
  return _arrayBufferToBase64(key);
}

export async function importKey(from: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    _base64ToArrayBuffer(from),
    ALGO,
    EXTRACTABLE,
    USAGES,
  );
}

export function _arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
export function _base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
