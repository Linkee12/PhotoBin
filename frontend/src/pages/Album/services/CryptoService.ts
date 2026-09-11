import { base64ToArrayBuffer, base64toUint8Array } from "../../../utils/base64";
import { importKey } from "../../../utils/key";

/**
 * Encrypts/decrypts album data with AES-GCM.
 *
 * When `key` is `null` the album is in plain (unencrypted) mode and every
 * method is a passthrough: bytes are returned as-is and the iv is empty.
 * The decision is made on `key === null` only, never on an empty iv, so an
 * encrypted album opened without its key fails loudly instead of showing garbage.
 */
export class CryptoService {
  async decryptImage(cryptedImg: ArrayBuffer, key: string | null, base64Iv: string) {
    if (key === null) return cryptedImg;
    const iv = base64toUint8Array(base64Iv);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
  }

  async decryptText(text: string, key: string | null, base64Iv: string) {
    if (text.length === 0) return "";
    const buffer = base64ToArrayBuffer(text);
    const decoder = new TextDecoder();
    if (key === null) return decoder.decode(buffer);
    const iv = base64toUint8Array(base64Iv);
    const arraybuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      buffer,
    );
    return decoder.decode(arraybuffer);
  }
  async encryptImage(file: File | Blob, key: string | null) {
    const buffer = await file.arrayBuffer();
    if (key === null) return { cryptedImg: buffer, iv: new Uint8Array(0) };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptedImg = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      buffer,
    );
    return { cryptedImg, iv };
  }
  async encrypString(text: string, key: string | null) {
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);
    if (key === null) {
      return { encryptedText: encodedText.buffer, iv: new Uint8Array(0) };
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedText = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      encodedText,
    );
    return { encryptedText, iv };
  }
}
