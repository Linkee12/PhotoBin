import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AlbumNotFoundError, AlbumService } from "./AlbumService";
import { MetadataService } from "./MetadataService";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

let root: string;
let metadataService: MetadataService;
let albumService: AlbumService;
let albumId: string;

function albumPath(...segments: string[]) {
  return path.join(root, albumId, ...segments);
}

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "photobin-albums-"));
  metadataService = new MetadataService(fs, root);
  albumService = new AlbumService(metadataService, ONE_MONTH_MS, { albumsRoot: root });
  albumId = randomUUID();
});

afterEach(async () => {
  await fsp.rm(root, { recursive: true, force: true });
});

describe("createAlbum", () => {
  it("creates the album directory with default metadata", async () => {
    await albumService.createAlbum(albumId);
    expect(fs.existsSync(albumPath("metadata.json"))).toBe(true);
    const metadata = metadataService.get(albumId);
    expect(metadata.albumId).toBe(albumId);
    expect(metadata.albumName.value).toBe("");
    expect(metadata.files).toEqual([]);
  });

  it("leaves an existing album's metadata untouched", async () => {
    await albumService.createAlbum(albumId);
    await albumService.rename(albumId, { value: "holiday", iv: "aXY=" });
    await albumService.createAlbum(albumId);
    expect(metadataService.get(albumId).albumName.value).toBe("holiday");
  });
});

describe("exists", () => {
  it("is false for an unknown album and true once created", async () => {
    expect(await albumService.exists(albumId)).toBe(false);
    await albumService.createAlbum(albumId);
    expect(await albumService.exists(albumId)).toBe(true);
  });
});

describe("deleteAlbum", () => {
  it("removes the album directory", async () => {
    await albumService.createAlbum(albumId);
    await fsp.mkdir(albumPath(randomUUID(), "original"), { recursive: true });
    await albumService.deleteAlbum(albumId);
    expect(fs.existsSync(albumPath())).toBe(false);
    expect(await albumService.exists(albumId)).toBe(false);
  });

  it("resolves when the album does not exist", async () => {
    await expect(albumService.deleteAlbum(albumId)).resolves.toBeUndefined();
  });
});

describe("writes into a deleted album", () => {
  const fileId = randomUUID();
  const part = { iv: "aXY=", chunkCount: 1 };

  beforeEach(async () => {
    await albumService.createAlbum(albumId);
    await albumService.deleteAlbum(albumId);
  });

  it("rejects a raw part and creates no directory", async () => {
    await expect(
      albumService.uploadFilePartRaw({
        albumId,
        fileId,
        fileType: "original",
        partName: "0",
        bytes: Buffer.from("BYTES"),
      }),
    ).rejects.toBeInstanceOf(AlbumNotFoundError);
    expect(fs.existsSync(albumPath())).toBe(false);
  });

  it("rejects a legacy part and creates no directory", async () => {
    await expect(
      albumService.uploadFilePart({
        albumId,
        fileId,
        fileType: "original",
        partName: "0",
        encryptedFile: "QllURVM=",
      }),
    ).rejects.toBeInstanceOf(AlbumNotFoundError);
    expect(fs.existsSync(albumPath())).toBe(false);
  });

  it("rejects a finalize and writes no metadata", async () => {
    await expect(
      albumService.finalizeFile(albumId, {
        fileId,
        fileName: { value: "", iv: "" },
        date: { value: "", iv: "" },
        original: part,
      }),
    ).rejects.toBeInstanceOf(AlbumNotFoundError);
    expect(fs.existsSync(albumPath())).toBe(false);
  });

  it("still lets rename bring the album into existence", async () => {
    await albumService.rename(albumId, { value: "back", iv: "" });
    expect(await albumService.exists(albumId)).toBe(true);
    expect(metadataService.get(albumId).albumName.value).toBe("back");
  });
});
