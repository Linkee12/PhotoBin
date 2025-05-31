import { base64ToArrayBuffer, base64toUint8Array } from "../../../utils/base64";
import { importKey } from "../../../utils/key";

export class CryptoService {
  async _decryptImage(cryptedImg: ArrayBuffer, key: string, base64Iv: string) {
    const iv = base64toUint8Array(base64Iv);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      cryptedImg,
    );
  }

  async _decryptText(text: string, key: string, base64Iv: string) {
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
}
