import { base64ToArrayBuffer, base64toUint8Array } from "../../../utils/base64";
import { importKey } from "../../../utils/key";

function randomIv() {
  return crypto.getRandomValues(new Uint8Array(12));
}

export class CryptoService {
  async decryptImage(cryptedImg: ArrayBuffer, key: string, base64Iv: string) {
    const iv = base64toUint8Array(base64Iv);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
  }

  async decryptText(text: string, key: string, base64Iv: string) {
    if (text.length === 0) return "";
    const buffer = base64ToArrayBuffer(text);
    const iv = base64toUint8Array(base64Iv);
    const decoder = new TextDecoder();
    const arraybuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      buffer,
    );
    return decoder.decode(arraybuffer);
  }
  /**
   * Encrypts a file with AES-GCM. Pass `iv` to reproduce the exact ciphertext
   * of an earlier run (resumed uploads); omit it to get a fresh random IV.
   */
  async encryptImage(file: File | Blob, key: string, iv: Uint8Array = randomIv()) {
    const buffer = await file.arrayBuffer();
    const cryptedImg = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      buffer,
    );
    return { cryptedImg, iv };
  }
  async encrypString(text: string, key: string, iv: Uint8Array = randomIv()) {
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);
    const encryptedText = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      encodedText,
    );
    return { encryptedText, iv };
  }
}
