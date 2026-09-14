import { describe, expect, it } from "vitest";
import { groupFiles } from "./groupFiles";

const entry = (value: string) => ({ value, iv: "" });
const file = (fileId: string, batchId?: string) => ({
  fileId,
  fileName: entry(`${fileId}.jpg`),
  date: entry("01/01"),
  ...(batchId === undefined ? {} : { batchId }),
});
const decodedFile = { name: "a.jpg", date: "01/01" };

function historyGroups(
  files: ReturnType<typeof file>[],
  decodedBatches: Parameters<typeof groupFiles>[0]["decodedBatches"],
) {
  return groupFiles({
    files,
    decodedFiles: Object.fromEntries(files.map((f) => [f.fileId, decodedFile])),
    decodedBatches,
    thumbnails: new Map(files.map((f) => [f.fileId, "blob:" + f.fileId])),
    view: "history",
  });
}

describe("groupFiles (history view)", () => {
  it("groups files by batch with the decoded batch name, newest batch first", () => {
    const groups = historyGroups([file("f1", "b1"), file("f2", "b2"), file("f3", "b1")], {
      b1: { name: "RedMonkey", createdAt: 1 },
      b2: { name: "BlueOwl", createdAt: 2 },
    });
    expect(groups.map((g) => [g.key, g.title, g.thumbnails.length])).toEqual([
      ["batch:b2", "BlueOwl", 1],
      ["batch:b1", "RedMonkey", 2],
    ]);
  });

  it("puts only files without a batchId into 'Earlier uploads', sorted last", () => {
    const groups = historyGroups([file("f1"), file("f2", "b1")], {
      b1: { name: "RedMonkey", createdAt: 1 },
    });
    expect(groups.map((g) => [g.key, g.title, g.batchId])).toEqual([
      ["batch:b1", "RedMonkey", "b1"],
      ["batch:earlier", "Earlier uploads", undefined],
    ]);
  });

  it("keeps a file whose batch is unknown in its own group instead of 'Earlier uploads'", () => {
    // `batchId` set but `batches` lacks the entry (or its name could not be
    // decoded): the batch identity must survive, only the name is unknown.
    const groups = historyGroups(
      [file("f1", "b1"), file("f2", "b2"), file("f3", "b1"), file("f4")],
      { b2: { name: "BlueOwl", createdAt: 2 } },
    );
    expect(groups.map((g) => [g.key, g.thumbnails.length])).toEqual([
      ["batch:b2", 1],
      ["batch:b1", 2],
      ["batch:earlier", 1],
    ]);
    const unknown = groups[1];
    expect(unknown.title).toBe("Upload b1");
    expect(unknown.meta).toBe("2 photos");
    // Nothing on the server to rename: not offered as renameable.
    expect(unknown.batchId).toBeUndefined();
  });

  it("never merges two different unknown batches", () => {
    const groups = historyGroups([file("f1", "b1"), file("f2", "b2")], {});
    expect(groups.map((g) => g.key).sort()).toEqual(["batch:b1", "batch:b2"]);
  });
});

describe("groupFiles (sidecars)", () => {
  const supported = (fileId: string, name: string, batchId = "b1") => ({
    fileId,
    fileName: entry(name),
    date: entry("01/01"),
    thumbnail: { iv: "", chunkCount: 1 },
    batchId,
  });
  const unsupported = (fileId: string, name: string, batchId = "b1") => ({
    fileId,
    fileName: entry(name),
    date: entry("01/01"),
    unsupportedFile: { iv: "", chunkCount: 1 },
    batchId,
  });
  const names = (files: { fileId: string; fileName: { value: string } }[]) =>
    Object.fromEntries(
      files.map((f) => [f.fileId, { name: f.fileName.value, date: "01/01" }]),
    );
  const group = (
    files: Parameters<typeof names>[0],
    view: "history" | "date" = "history",
  ) =>
    groupFiles({
      files: files as Parameters<typeof groupFiles>[0]["files"],
      decodedFiles: names(files),
      decodedBatches: { b1: { name: "RedMonkey", createdAt: 1 } },
      thumbnails: new Map(),
      view,
    });

  it("attaches an unsupported file to the supported file with the same basename", () => {
    const groups = group([
      unsupported("r1", "IMG_0001.CR3"),
      supported("j1", "IMG_0001.jpg"),
      unsupported("r2", "IMG_0002.CR3"),
      supported("j2", "IMG_0002.JPG"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].thumbnails.map((t) => t.id)).toEqual(["j1", "j2"]);
    expect(groups[0].thumbnails[0].sidecars).toEqual([
      { id: "r1", name: "IMG_0001.CR3" },
    ]);
    expect(groups[0].thumbnails[1].sidecars).toEqual([
      { id: "r2", name: "IMG_0002.CR3" },
    ]);
    expect(groups[0].meta).toMatch(/2 photos$/);
  });

  it("matches basenames case-insensitively and across batches, but never two supported files", () => {
    const groups = group([
      supported("j1", "photo.jpg", "b1"),
      unsupported("r1", "PHOTO.dng", "b2"),
      supported("j2", "photo.png", "b1"),
    ]);
    const tiles = groups.flatMap((g) => g.thumbnails);
    expect(tiles.map((t) => t.id)).toEqual(["j1", "j2"]);
    expect(tiles[0].sidecars.map((s) => s.id)).toEqual(["r1"]);
    expect(tiles[1].sidecars).toEqual([]);
  });

  it("keeps an unsupported file without a match as a tile of its own", () => {
    const groups = group([
      unsupported("r1", "notes.pdf"),
      supported("j1", "IMG_0001.jpg"),
    ]);
    expect(groups[0].thumbnails.map((t) => t.id)).toEqual(["r1", "j1"]);
    expect(groups[0].thumbnails[0].sidecars).toEqual([]);
  });

  it("attaches several sidecars to one tile, in upload order", () => {
    const groups = group([
      unsupported("r1", "a.cr3"),
      supported("j1", "a.jpg"),
      unsupported("r2", "a.xmp"),
    ]);
    expect(groups[0].thumbnails[0].sidecars.map((s) => s.id)).toEqual(["r1", "r2"]);
  });

  it("attaches in date view too, whatever the sidecar's own date", () => {
    const files = [supported("j1", "a.jpg"), unsupported("r1", "a.cr3")];
    const groups = groupFiles({
      files: files as Parameters<typeof groupFiles>[0]["files"],
      decodedFiles: {
        j1: { name: "a.jpg", date: "01/01" },
        r1: { name: "a.cr3", date: "02/02" },
      },
      decodedBatches: {},
      thumbnails: new Map(),
      view: "date",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].thumbnails[0].sidecars.map((s) => s.id)).toEqual(["r1"]);
  });
});
