import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MetadataService } from "./MetadataService";

let root: string;
let service: MetadataService;
let albumId: string;

const entry = (value: string) => ({ value, iv: "" });
const file = (fileId: string, batchId?: string) => ({
  fileId,
  fileName: entry("a.jpg"),
  date: entry("01/01"),
  ...(batchId === undefined ? {} : { batchId }),
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "photobin-batches-"));
  service = new MetadataService(fs, root);
  albumId = randomUUID();
  fs.mkdirSync(path.join(root, albumId));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("upload batches", () => {
  it("creates the batch together with the first finalized file", () => {
    const batchId = randomUUID();
    service.addFile(albumId, file(randomUUID(), batchId), {
      batchId,
      name: entry("RedMonkey"),
      createdAt: 1,
    });
    expect(service.get(albumId).batches).toEqual({
      [batchId]: { name: entry("RedMonkey"), createdAt: 1 },
    });
  });

  it("keeps a renamed batch when a later file of the same batch finalizes", () => {
    const batchId = randomUUID();
    const batch = { batchId, name: entry("RedMonkey"), createdAt: 1 };
    service.addFile(albumId, file(randomUUID(), batchId), batch);
    service.renameBatch(albumId, batchId, entry("Holiday"));
    service.addFile(albumId, file(randomUUID(), batchId), batch);
    expect(service.get(albumId).batches?.[batchId]).toEqual({
      name: entry("Holiday"),
      createdAt: 1,
    });
    expect(service.get(albumId).files).toHaveLength(2);
  });

  it("leaves albums without batches untouched", () => {
    service.addFile(albumId, file(randomUUID()));
    expect(service.get(albumId).batches).toBeUndefined();
  });

  it("refuses to rename an unknown batch", () => {
    expect(() => service.renameBatch(albumId, randomUUID(), entry("x"))).toThrow(
      /not found/,
    );
  });
});
