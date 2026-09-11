import fs from "node:fs/promises";
import path from "node:path";
import { Metadata, MetadataService } from "./MetadataService";
import { PartType, partTypeSchema } from "../utils/zod";

const ALBUMS_ROOT = path.resolve("./albums");
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const METADATA_FILE = "metadata.json";

export type UploadedParts = {
  parts: Partial<Record<PartType, string[]>>;
  finalized: boolean;
};

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
    private _orphanTtlMs: number = ONE_DAY_MS,
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
  async uploadFilePart(params: {
    fileType: string;
    albumId: string;
    fileId: string;
    partName: string;
    encryptedFile: string;
  }) {
    const dir = safeAlbumPath(params.albumId, params.fileId, params.fileType);
    await fs.mkdir(dir, { recursive: true });
    const filePath = safeAlbumPath(
      params.albumId,
      params.fileId,
      params.fileType,
      params.partName,
    );
    await fs.writeFile(filePath, params.encryptedFile);
  }
  /**
   * Lists the part names already stored for a file, grouped by part type, so a
   * client can resume an interrupted upload. Missing directories yield `{}`.
   */
  async getUploadedParts(albumId: string, fileId: string): Promise<UploadedParts> {
    const finalized = this._metadataService
      .get(albumId)
      .files.some((file) => file.fileId === fileId);
    const parts: UploadedParts["parts"] = {};
    const fileDir = safeAlbumPath(albumId, fileId);
    for (const entry of await this._readdirOrEmpty(fileDir)) {
      const type = partTypeSchema.safeParse(entry.name);
      if (!entry.isDirectory() || !type.success) continue;
      const names = await this._readdirOrEmpty(safeAlbumPath(albumId, fileId, type.data));
      parts[type.data] = names
        .filter((part) => part.isFile() && /^\d+$/.test(part.name))
        .map((part) => part.name);
    }
    return { parts, finalized };
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = safeAlbumPath(albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  /**
   * Deletes expired albums and, inside live albums, file directories that were
   * never finalized (not referenced by metadata.json) and have not been written
   * to for `orphanTtlMs`. The mtime check keeps in-progress uploads alive.
   */
  async cleanStorage(
    ttlMs: number = this._ttlMs,
    orphanTtlMs: number = this._orphanTtlMs,
  ) {
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
        } else if (s.isDirectory()) {
          await this._cleanOrphans(dir, now, orphanTtlMs);
        }
      } catch (err) {
        console.error(`cleanStorage: failed to inspect ${dir}`, err);
      }
    }
  }

  private async _cleanOrphans(albumId: string, now: number, orphanTtlMs: number) {
    const known = new Set(this._metadataService.get(albumId).files.map((f) => f.fileId));
    const entries = await this._readdirOrEmpty(safeAlbumPath(albumId));
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === METADATA_FILE || known.has(entry.name)) {
        continue;
      }
      try {
        const lastWrite = await this._lastWriteMs(albumId, entry.name);
        if (now - lastWrite > orphanTtlMs) {
          await fs.rm(safeAlbumPath(albumId, entry.name), {
            recursive: true,
            force: true,
          });
          console.log(`cleanStorage: removed orphaned upload ${albumId}/${entry.name}`);
        }
      } catch (err) {
        console.error(`cleanStorage: failed to inspect ${albumId}/${entry.name}`, err);
      }
    }
  }

  /**
   * Newest mtime of the file directory and its part-type subdirectories. A
   * directory's mtime only changes when direct children are added, so the
   * subdirectories are what reflect the last uploaded chunk.
   */
  private async _lastWriteMs(albumId: string, fileId: string) {
    const fileDir = safeAlbumPath(albumId, fileId);
    let latest = (await fs.stat(fileDir)).mtimeMs;
    for (const entry of await this._readdirOrEmpty(fileDir)) {
      if (!entry.isDirectory()) continue;
      const s = await fs.stat(safeAlbumPath(albumId, fileId, entry.name));
      latest = Math.max(latest, s.mtimeMs);
    }
    return latest;
  }

  private async _readdirOrEmpty(dir: string) {
    try {
      return await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
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
