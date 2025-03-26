export default async function encryptImage(file: File | Blob, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  const cryptedImg = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer,
  );
  return { cryptedImg, iv };
}
