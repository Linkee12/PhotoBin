import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AlbumService, EditInProgressError } from "./AlbumService";
import { Metadata, MetadataService } from "./MetadataService";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

let root: string;
let metadataService: MetadataService;
let albumService: AlbumService;
let albumId: string;
let fileId: string;

const part = { iv: "aXY=", chunkCount: 1 };
const REDUCED_V1 = "REDUCED-v1";
const THUMB_V1 = "THUMB-v1";
const EDITED_V2 = "EDITED-v2";
const REDUCED_V2 = "REDUCED-v2";
const THUMB_V2 = "THUMB-v2";
const LOCK_FILE = ".edit-lock";
const REDUCED_OLD = "reduced.old";
const THUMBNAIL_OLD = "thumbnail.old";

function filePath(...segments: string[]) {
  return path.join(root, albumId, fileId, ...segments);
}
function exists(p: string) {
  return fs.existsSync(p);
}
async function writePart(type: string, name: string, content: string) {
  await fsp.mkdir(filePath(type), { recursive: true });
  await fsp.writeFile(filePath(type, name), content);
}
function readLock() {
  return JSON.parse(fs.readFileSync(filePath(LOCK_FILE), "utf8")) as {
    editId: string;
    startedAt: number;
  };
}
function getFile() {
  return metadataService.get(albumId).files.find((f) => f.fileId === fileId);
}

async function seedImage(extra: Partial<Metadata["files"][0]> = {}) {
  await fsp.mkdir(filePath(), { recursive: true });
  await writePart("original", "0", "ORIGINAL");
  await writePart("reduced", "0", REDUCED_V1);
  await writePart("thumbnail", "0", THUMB_V1);
  metadataService.addFile(albumId, {
    fileId,
    fileName: { value: "", iv: "" },
    date: { value: "", iv: "" },
    original: part,
    reduced: part,
    thumbnail: part,
    ...extra,
  });
}

async function stageRotation(editId: string) {
  await albumService.uploadFilePart({
    albumId,
    fileId,
    editId,
    fileType: "edited",
    partName: "0",
    encryptedFile: EDITED_V2,
  });
  await albumService.uploadFilePart({
    albumId,
    fileId,
    editId,
    fileType: "reduced",
    partName: "0",
    encryptedFile: REDUCED_V2,
  });
  await albumService.uploadFilePart({
    albumId,
    fileId,
    editId,
    fileType: "thumbnail",
    partName: "0",
    encryptedFile: THUMB_V2,
  });
}

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "photobin-albums-"));
  metadataService = new MetadataService(fs, root);
  albumService = new AlbumService(metadataService, ONE_MONTH_MS, {
    albumsRoot: root,
    editLockTtlMs: LOCK_TTL_MS,
  });
  albumId = randomUUID();
  fileId = randomUUID();
  await seedImage();
});

afterEach(async () => {
  await fsp.rm(root, { recursive: true, force: true });
});

describe("beginEdit", () => {
  it("creates a lock file with the returned editId", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    expect(exists(filePath(LOCK_FILE))).toBe(true);
    const lock = readLock();
    expect(lock.editId).toBe(editId);
    expect(Math.abs(Date.now() - lock.startedAt)).toBeLessThan(5_000);
  });

  it("rejects a second begin while a fresh lock exists", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await expect(albumService.beginEdit(albumId, fileId)).rejects.toBeInstanceOf(
      EditInProgressError,
    );
    expect(readLock().editId).toBe(editId);
  });

  it("takes over a stale lock and removes its staging dir", async () => {
    const staleId = randomUUID();
    await fsp.writeFile(
      filePath(LOCK_FILE),
      JSON.stringify({ editId: staleId, startedAt: Date.now() - LOCK_TTL_MS - 1 }),
    );
    await fsp.mkdir(filePath(`.edit-${staleId}`, "reduced"), { recursive: true });

    const { editId } = await albumService.beginEdit(albumId, fileId);
    expect(editId).not.toBe(staleId);
    expect(readLock().editId).toBe(editId);
    expect(exists(filePath(`.edit-${staleId}`))).toBe(false);
  });

  it("refuses files that are not in metadata", async () => {
    await expect(albumService.beginEdit(albumId, randomUUID())).rejects.toThrow();
  });

  it("refuses non-image files", async () => {
    const videoId = randomUUID();
    metadataService.addFile(albumId, {
      fileId: videoId,
      fileName: { value: "", iv: "" },
      date: { value: "", iv: "" },
      originalVideo: part,
      reduced: part,
      thumbnail: part,
    });
    await expect(albumService.beginEdit(albumId, videoId)).rejects.toThrow();
  });
});

describe("uploadFilePart with editId", () => {
  it("writes into the staging dir", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await stageRotation(editId);
    expect(fs.readFileSync(filePath(`.edit-${editId}`, "edited", "0"), "utf8")).toBe(
      EDITED_V2,
    );
    // live dirs untouched
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe(REDUCED_V1);
  });

  it("rejects an editId that does not match the lock", async () => {
    await albumService.beginEdit(albumId, fileId);
    await expect(
      albumService.uploadFilePart({
        albumId,
        fileId,
        editId: randomUUID(),
        fileType: "reduced",
        partName: "0",
        encryptedFile: "x",
      }),
    ).rejects.toThrow();
  });

  it("rejects original under an edit", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await expect(
      albumService.uploadFilePart({
        albumId,
        fileId,
        editId,
        fileType: "original",
        partName: "0",
        encryptedFile: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("commitEdit", () => {
  it("swaps dirs, updates metadata and clears lock + staging", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await stageRotation(editId);
    const newPart = { iv: "bmV3", chunkCount: 1 };
    await albumService.commitEdit(albumId, fileId, editId, {
      rotation: 1,
      edited: newPart,
      reduced: newPart,
      thumbnail: newPart,
    });

    expect(fs.readFileSync(filePath("edited", "0"), "utf8")).toBe(EDITED_V2);
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe(REDUCED_V2);
    expect(fs.readFileSync(filePath("thumbnail", "0"), "utf8")).toBe(THUMB_V2);
    expect(fs.readFileSync(filePath("original", "0"), "utf8")).toBe("ORIGINAL");
    expect(exists(filePath(REDUCED_OLD))).toBe(false);
    expect(exists(filePath(THUMBNAIL_OLD))).toBe(false);
    expect(exists(filePath(`.edit-${editId}`))).toBe(false);
    expect(exists(filePath(LOCK_FILE))).toBe(false);

    const file = getFile();
    expect(file?.rotation).toBe(1);
    expect(file?.edited).toEqual(newPart);
    expect(file?.reduced).toEqual(newPart);
    expect(file?.thumbnail).toEqual(newPart);
    expect(file?.original).toEqual(part);
  });

  it("with rotation 0 removes the edited dir and metadata entry", async () => {
    // first rotate to 1
    const first = await albumService.beginEdit(albumId, fileId);
    await stageRotation(first.editId);
    await albumService.commitEdit(albumId, fileId, first.editId, {
      rotation: 1,
      edited: part,
      reduced: part,
      thumbnail: part,
    });
    expect(exists(filePath("edited"))).toBe(true);

    // back to 0
    const second = await albumService.beginEdit(albumId, fileId);
    await albumService.uploadFilePart({
      albumId,
      fileId,
      editId: second.editId,
      fileType: "reduced",
      partName: "0",
      encryptedFile: "REDUCED-v3",
    });
    await albumService.uploadFilePart({
      albumId,
      fileId,
      editId: second.editId,
      fileType: "thumbnail",
      partName: "0",
      encryptedFile: "THUMB-v3",
    });
    await albumService.commitEdit(albumId, fileId, second.editId, {
      rotation: 0,
      reduced: part,
      thumbnail: part,
    });

    expect(exists(filePath("edited"))).toBe(false);
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe("REDUCED-v3");
    const file = getFile();
    expect(file?.rotation).toBe(0);
    expect(file?.edited).toBeUndefined();
    expect(exists(filePath(LOCK_FILE))).toBe(false);
  });

  it("rejects when the editId does not match the lock", async () => {
    await albumService.beginEdit(albumId, fileId);
    await expect(
      albumService.commitEdit(albumId, fileId, randomUUID(), {
        rotation: 1,
        edited: part,
        reduced: part,
        thumbnail: part,
      }),
    ).rejects.toThrow();
    expect(exists(filePath(LOCK_FILE))).toBe(true);
  });

  it("rejects when a patched part was not staged", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await expect(
      albumService.commitEdit(albumId, fileId, editId, {
        rotation: 1,
        edited: part,
        reduced: part,
        thumbnail: part,
      }),
    ).rejects.toThrow();
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe(REDUCED_V1);
  });
});

describe("abortEdit", () => {
  it("removes staging dir and lock, and is idempotent", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await stageRotation(editId);
    await albumService.abortEdit(albumId, fileId, editId);
    expect(exists(filePath(`.edit-${editId}`))).toBe(false);
    expect(exists(filePath(LOCK_FILE))).toBe(false);
    await expect(
      albumService.abortEdit(albumId, fileId, editId),
    ).resolves.toBeUndefined();
    // live data untouched
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe(REDUCED_V1);
  });

  it("does not remove a lock held by another edit", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await albumService.abortEdit(albumId, fileId, randomUUID());
    expect(readLock().editId).toBe(editId);
  });
});

describe("collectEditGarbage", () => {
  it("removes stale locks and staging dirs but keeps fresh ones", async () => {
    const staleId = randomUUID();
    await fsp.mkdir(filePath(`.edit-${staleId}`, "reduced"), { recursive: true });
    const old = new Date(Date.now() - LOCK_TTL_MS - 1000);
    await fsp.utimes(filePath(`.edit-${staleId}`), old, old);

    const { editId } = await albumService.beginEdit(albumId, fileId);
    await stageRotation(editId);

    await albumService.collectEditGarbage();

    expect(exists(filePath(`.edit-${staleId}`))).toBe(false);
    expect(exists(filePath(`.edit-${editId}`))).toBe(true);
    expect(exists(filePath(LOCK_FILE))).toBe(true);
  });

  it("removes everything when told all edits are dead (startup/shutdown)", async () => {
    const { editId } = await albumService.beginEdit(albumId, fileId);
    await stageRotation(editId);
    await albumService.collectEditGarbage({ all: true });
    expect(exists(filePath(`.edit-${editId}`))).toBe(false);
    expect(exists(filePath(LOCK_FILE))).toBe(false);
  });

  it("removes <type>.old when the live dir exists", async () => {
    await writePart(REDUCED_OLD, "0", "REDUCED-old");
    await albumService.collectEditGarbage();
    expect(exists(filePath(REDUCED_OLD))).toBe(false);
    expect(fs.readFileSync(filePath("reduced", "0"), "utf8")).toBe(REDUCED_V1);
  });

  it("restores <type>.old when the live dir is missing", async () => {
    await fsp.rename(filePath("thumbnail"), filePath(THUMBNAIL_OLD));
    await albumService.collectEditGarbage();
    expect(exists(filePath(THUMBNAIL_OLD))).toBe(false);
    expect(fs.readFileSync(filePath("thumbnail", "0"), "utf8")).toBe(THUMB_V1);
  });
});
