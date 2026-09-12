/**
 * Small localStorage records that let an interrupted upload be resumed after a
 * reload. Only IVs, ids and encrypted metadata strings are stored – never file
 * bytes. Records are keyed per album and matched to files by fingerprint.
 */

export type ResumablePartType = "original" | "originalVideo" | "unsupportedFile";

export type EncryptedEntry = { iv: string; value: string };

/** The upload batch a file belongs to; `name` is encrypted once per batch. */
export type UploadBatch = { batchId: string; name: EncryptedEntry; createdAt: number };

export type PendingUpload = {
  fingerprint: string;
  fileId: string;
  createdAt: number;
  fileName: EncryptedEntry;
  date: EncryptedEntry;
  /** Kept so a resumed file lands in the batch it was originally picked with. */
  batch?: UploadBatch;
  /** Only parts whose plaintext is the file itself (byte-identical across sessions). */
  parts: Partial<Record<ResumablePartType, { iv: string; chunkCount: number }>>;
};

const KEY_PREFIX = "photobin:pendingUploads:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isEncryptedEntry(v: unknown): v is EncryptedEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as EncryptedEntry).iv === "string" &&
    typeof (v as EncryptedEntry).value === "string"
  );
}

function isBatch(v: unknown): v is UploadBatch {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as UploadBatch).batchId === "string" &&
    typeof (v as UploadBatch).createdAt === "number" &&
    isEncryptedEntry((v as UploadBatch).name)
  );
}

function isRecord(v: unknown): v is PendingUpload {
  if (typeof v !== "object" || v === null) return false;
  const r = v as PendingUpload;
  return (
    typeof r.fingerprint === "string" &&
    typeof r.fileId === "string" &&
    typeof r.createdAt === "number" &&
    isEncryptedEntry(r.fileName) &&
    isEncryptedEntry(r.date) &&
    typeof r.parts === "object" &&
    r.parts !== null
  );
}

/**
 * Records written by builds without upload batches have no `batch`, and a
 * corrupt one would make `finalizeFile` reject the whole file. Either way the
 * resumed file joins the batch it is picked with now.
 */
function upgrade(r: PendingUpload): PendingUpload {
  if (r.batch === undefined || isBatch(r.batch)) return r;
  return { ...r, batch: undefined };
}

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
      const records: PendingUpload[] = [];
      for (const r of parsed) {
        if (!isRecord(r) || now - r.createdAt >= MAX_AGE_MS) continue;
        records.push(upgrade(r));
      }
      return records;
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
