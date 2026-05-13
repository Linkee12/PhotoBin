import fs from "node:fs/promises";
import path from "node:path";
import { Metadata, MetadataService } from "./MetadataService";

const ALBUMS_ROOT = path.resolve("./albums");

function safeAlbumPath(...segments: string[]) {
  const resolved = path.resolve(ALBUMS_ROOT, ...segments);
  if (resolved !== ALBUMS_ROOT && !resolved.startsWith(ALBUMS_ROOT + path.sep)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

export class AlbumService {
  constructor(private _metadataService: MetadataService) {}
  getMetaData(albumId: string) {
    return this._metadataService.get(albumId);
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
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = safeAlbumPath(albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  async cleanStorage() {
    const directions = await fs.readdir(ALBUMS_ROOT);
    const now = Date.now();
    for (const dir of directions) {
      const albumPath = safeAlbumPath(dir);
      const s = await fs.stat(albumPath);
      if (now - s.birthtimeMs > 600000) {
        await this._deleteDir(dir);
      }
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
