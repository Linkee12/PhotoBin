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
