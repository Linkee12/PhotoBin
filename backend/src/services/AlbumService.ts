import fs from "node:fs/promises";
import path from "node:path";
import { Metadata, MetadataService } from "./MetadataService";

export class AlbumService {
  constructor(private _metadataService: MetadataService) {}
  getMetaData(albumId: string) {
    return this._metadataService.get(albumId);
  }
  rename(albumId: string, newTitle: { value: string; iv: string }) {
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
  private async _deleteImage(albumId: string, imageId: string) {
    await fs.rm(path.join("./albums/", albumId, imageId), {
      recursive: true,
      force: true,
    });
    this._metadataService.removeFile(albumId, imageId);
  }
  private async _createDirectory(folder: string) {
    try {
      const folderName = "./albums/" + folder;
      await fs.mkdir(folderName, { recursive: true });
    } catch (err) {
      console.error(err);
    }
  }
}
