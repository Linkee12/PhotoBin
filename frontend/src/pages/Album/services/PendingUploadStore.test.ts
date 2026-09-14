import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendingUploadStore } from "./PendingUploadStore";

const ALBUM = "album-1";
const KEY = "photobin:pendingUploads:" + ALBUM;
const entry = { value: "x", iv: "" };
const batch = { batchId: "b1", name: entry, createdAt: 5 };
const record = (extra: Record<string, unknown> = {}) => ({
  fingerprint: "a.jpg|1|image/jpeg|1",
  fileId: "f1",
  createdAt: Date.now(),
  fileName: entry,
  date: entry,
  parts: { original: { iv: "", chunkCount: 1 } },
  ...extra,
});

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
});

describe("PendingUploadStore", () => {
  it("round-trips a record with its batch", () => {
    const store = new PendingUploadStore(ALBUM);
    store.save(record({ batch }));
    expect(store.find(record().fingerprint)?.batch).toEqual(batch);
  });

  it("returns a record written before batches existed without a batch", () => {
    storage.set(KEY, JSON.stringify([record()]));
    const found = new PendingUploadStore(ALBUM).find(record().fingerprint);
    expect(found).toBeDefined();
    expect(found?.batch).toBeUndefined();
  });

  it("drops a malformed batch instead of sending it to the server", () => {
    storage.set(KEY, JSON.stringify([record({ batch: { batchId: "b1" } })]));
    const found = new PendingUploadStore(ALBUM).find(record().fingerprint);
    expect(found).toBeDefined();
    expect(found?.batch).toBeUndefined();
  });

  it("ignores records with a broken shape", () => {
    storage.set(
      KEY,
      JSON.stringify([record({ parts: "nope" }), record({ fileName: 1 })]),
    );
    expect(new PendingUploadStore(ALBUM).find(record().fingerprint)).toBeUndefined();
  });
});
