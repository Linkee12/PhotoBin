import { arrayBufferToBase64, base64ToArrayBuffer } from "./base64";

const ALGO = { name: "AES-GCM", length: 256 };
const EXTRACTABLE = true;
const USAGES = ["encrypt", "decrypt"] as const;

export async function genKey(): Promise<string> {
  const cryptoKey = await crypto.subtle.generateKey(ALGO, EXTRACTABLE, USAGES);
  const key = await crypto.subtle.exportKey("raw", cryptoKey);
  return arrayBufferToBase64(key);
}

export async function importKey(from: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(from),
    ALGO,
    EXTRACTABLE,
    USAGES,
  );
}
