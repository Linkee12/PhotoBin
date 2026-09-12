/**
 * Small localStorage records that let an interrupted upload be resumed after a
 * reload. Only IVs, ids and encrypted metadata strings are stored – never file
 * bytes. Records are keyed per album and matched to files by fingerprint.
 */

export type ResumablePartType = "original" | "originalVideo" | "unsupportedFile";

export type EncryptedEntry = { iv: string; value: string };

export type PendingUpload = {
  fingerprint: string;
  fileId: string;
  createdAt: number;
  fileName: EncryptedEntry;
  date: EncryptedEntry;
  /** Only parts whose plaintext is the file itself (byte-identical across sessions). */
  parts: Partial<Record<ResumablePartType, { iv: string; chunkCount: number }>>;
};

const KEY_PREFIX = "photobin:pendingUploads:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function fileFingerprint(file: File) {
  return `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
}

export class PendingUploadStore {
  constructor(private _albumId: string) {}

  find(fingerprint: string): PendingUpload | undefined {
    return this._read().find((r) => r.fingerprint === fingerprint);
  }

  save(record: PendingUpload) {
    const rest = this._read().filter((r) => r.fingerprint !== record.fingerprint);
    this._write([...rest, record]);
  }

  remove(fileId: string) {
    this._write(this._read().filter((r) => r.fileId !== fileId));
  }

  private _key() {
    return KEY_PREFIX + this._albumId;
  }

  private _read(): PendingUpload[] {
    try {
      const raw = localStorage.getItem(this._key());
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter(
        (r): r is PendingUpload =>
          typeof r === "object" &&
          r !== null &&
          typeof r.fingerprint === "string" &&
          typeof r.fileId === "string" &&
          typeof r.createdAt === "number" &&
          now - r.createdAt < MAX_AGE_MS,
      );
    } catch {
      return [];
    }
  }

  private _write(records: PendingUpload[]) {
    try {
      if (records.length === 0) localStorage.removeItem(this._key());
      else localStorage.setItem(this._key(), JSON.stringify(records));
    } catch (e) {
      console.warn("[upload] could not persist pending upload", e);
    }
  }
}
