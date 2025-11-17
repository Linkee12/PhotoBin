import fs from "node:fs/promises";
import path from "node:path";
import { Metadata, MetadataService } from "./MetadataService";

export class AlbumService {
  constructor(private _metadataService: MetadataService) {}
  getMetaData(albumId: string) {
    return this._metadataService.get(albumId);
  }
  async rename(albumId: string, newTitle: { value: string; iv: string }) {
    const path = "./albums/" + albumId;
    const isExist = await this._checkDirectoryExists(path);
    if (!isExist) this._createDirectory(albumId);
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
    const dir = params.albumId + "/" + params.fileId + "/" + params.fileType;
    await this._createDirectory(dir);
    const path = "./albums/" + dir + "/" + params.partName;
    await fs.writeFile(path, params.encryptedFile);
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = path.join("./albums/", albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  async cleanStorage() {
    const directions = await fs.readdir("./albums");
    const now = Date.now();
    for (const dir of directions) {
      const s = await fs.stat("./albums/" + dir);
      if (now - s.birthtimeMs > 600000) {
        this._deleteDir(dir);
      }
    }
  }

  private async _createDirectory(folder: string) {
    try {
      const folderName = "./albums/" + folder;
      await fs.mkdir(folderName, { recursive: true });
    } catch (err) {
      console.error(err);
    }
  }
  private async _deleteImage(albumId: string, imageId: string) {
    await fs.rm(path.join("./albums/", albumId, imageId), {
      recursive: true,
      force: true,
    });
    this._metadataService.removeFile(albumId, imageId);
  }
  private async _deleteDir(albumId: string) {
    await fs.rm(path.join("./albums/", albumId), {
      recursive: true,
      force: true,
    });
    console.log("deleted");
  }
  private async _checkDirectoryExists(path: string) {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch (err) {
      return false;
      throw err;
    }
  }
}
