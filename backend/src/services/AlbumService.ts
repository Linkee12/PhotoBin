import fs from "node:fs/promises";
import path from "node:path";
import { Metadata, MetadataService } from "./MetadataService";

const ALBUMS_ROOT = path.resolve("./albums");
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** Parts uploaded through the binary route are stored as raw bytes with this suffix. */
const RAW_SUFFIX = ".bin";

function safeAlbumPath(...segments: string[]) {
  const resolved = path.resolve(ALBUMS_ROOT, ...segments);
  if (resolved !== ALBUMS_ROOT && !resolved.startsWith(ALBUMS_ROOT + path.sep)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

export class AlbumService {
  constructor(
    private _metadataService: MetadataService,
    private _ttlMs: number = ONE_MONTH_MS,
  ) {}
  getMetaData(albumId: string) {
    return this._metadataService.get(albumId);
  }
  async getExpiresAt(albumId: string): Promise<number | null> {
    try {
      const s = await fs.stat(safeAlbumPath(albumId));
      return Math.floor(s.birthtimeMs + this._ttlMs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async rename(albumId: string, newTitle: { value: string; iv: string }) {
    const dir = safeAlbumPath(albumId);
    const isExist = await this._checkDirectoryExists(dir);
    if (!isExist) await fs.mkdir(dir, { recursive: true });
    this._metadataService.renameAlbum(albumId, newTitle);
  }
  finalizeFile(albumId: string, fileMetadata: Metadata["files"][0]) {
    this._metadataService.addFile(albumId, fileMetadata);
  }
  /**
   * Legacy JSON transport: the part arrives base64-encoded and is stored as
   * base64 text under `<partName>`. Kept for clients that still use the RPC route.
   */
  async uploadFilePart(params: {
    fileType: string;
    albumId: string;
    fileId: string;
    partName: string;
    encryptedFile: string;
  }) {
    const filePath = await this._preparePartPath(
      params.albumId,
      params.fileId,
      params.fileType,
      params.partName,
    );
    await fs.writeFile(filePath, params.encryptedFile);
  }
  /**
   * Binary transport: raw bytes are stored as-is under `<partName>.bin`.
   * The suffix lets the read path tell the two on-disk formats apart.
   */
  async uploadFilePartRaw(params: {
    fileType: string;
    albumId: string;
    fileId: string;
    partName: string;
    bytes: Buffer;
  }) {
    const filePath = await this._preparePartPath(
      params.albumId,
      params.fileId,
      params.fileType,
      params.partName + RAW_SUFFIX,
    );
    await fs.writeFile(filePath, params.bytes);
  }
  /** Returns the part as base64 text regardless of how it is stored. */
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const raw = await this._readRawPart(albumId, fileId, type, name);
    if (raw !== undefined) return raw.toString("base64");
    return await fs.readFile(safeAlbumPath(albumId, fileId, type, name), {
      encoding: "utf8",
    });
  }
  /** Returns the part as raw bytes regardless of how it is stored. */
  async getFileBytes(albumId: string, fileId: string, type: string, name: string) {
    const raw = await this._readRawPart(albumId, fileId, type, name);
    if (raw !== undefined) return raw;
    const base64 = await fs.readFile(safeAlbumPath(albumId, fileId, type, name), {
      encoding: "utf8",
    });
    return Buffer.from(base64, "base64");
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  async cleanStorage(ttlMs: number = ONE_MONTH_MS) {
    let directions: string[];
    try {
      directions = await fs.readdir(ALBUMS_ROOT);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    const now = Date.now();
    for (const dir of directions) {
      try {
        const albumPath = safeAlbumPath(dir);
        const s = await fs.stat(albumPath);
        if (now - s.birthtimeMs > ttlMs) {
          await this._deleteDir(dir);
        }
      } catch (err) {
        console.error(`cleanStorage: failed to inspect ${dir}`, err);
      }
    }
  }

  private async _preparePartPath(
    albumId: string,
    fileId: string,
    fileType: string,
    name: string,
  ) {
    await fs.mkdir(safeAlbumPath(albumId, fileId, fileType), { recursive: true });
    return safeAlbumPath(albumId, fileId, fileType, name);
  }
  private async _readRawPart(
    albumId: string,
    fileId: string,
    type: string,
    name: string,
  ) {
    try {
      return await fs.readFile(safeAlbumPath(albumId, fileId, type, name + RAW_SUFFIX));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw err;
    }
  }
  private async _deleteImage(albumId: string, imageId: string) {
    await fs.rm(safeAlbumPath(albumId, imageId), {
      recursive: true,
      force: true,
    });
    this._metadataService.removeFile(albumId, imageId);
  }
  private async _deleteDir(albumId: string) {
    await fs.rm(safeAlbumPath(albumId), {
      recursive: true,
      force: true,
    });
  }
  private async _checkDirectoryExists(path: string) {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
