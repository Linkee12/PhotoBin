import fs from "node:fs/promises";
import path from "node:path";
export class AlbumService {
  async createAlbum(file: {
    name: string;
    albumID: string;
    uuid: string;
    file: string;
    fileName: string;
  }) {
    await this._createDirectory(file.albumID + "/" + file.uuid + "/" + file.name);
    await this._saveFile(
      file.albumID + "/" + file.uuid + "/" + file.name,
      file.file,
      file.fileName,
    );
  }
  async getMetaData(albumId: string): Promise<Metadata> {
    // eslint-disable-next-line sonarjs/no-duplicate-string
    const filePath = path.join("./albums/", albumId, "metadata.json");
    const raw = await fs.readFile(filePath, { encoding: "utf8" });
    return await JSON.parse(raw);
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = path.join("./albums/", albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }
  async addMetaData(albumId: string, metaData: string) {
    await this._saveFile(albumId, metaData, "metadata.json");
  }
  async deleteImage(albumId: string, imageId: string) {
    await fs.rm(path.join("./albums/", albumId, imageId), {
      recursive: true,
      force: true,
    });
    await this.editMetaData(albumId, imageId);
  }
  private async _createDirectory(folder: string) {
    try {
      const folderName = "./albums/" + folder;
      await fs.mkdir(folderName, { recursive: true });
    } catch (err) {
      console.error(err);
    }
  }

  private async _saveFile(route: string, file: string, fileName: string) {
    const path = "./albums/" + route + "/" + fileName;
    await fs.writeFile(path, file);
  }
  private async editMetaData(albumId: string, imageId: string) {
    const filePath = path.join("./albums/", albumId, "metadata.json");
    const raw = await fs.readFile(filePath, { encoding: "utf8" });
    const metadata: Metadata = JSON.parse(raw);

    const updatedFiles = metadata.files.filter((file) => !imageId.includes(file.fileId));

    const newMetadata: Metadata = {
      ...metadata,
      files: updatedFiles,
    };

    this.addMetaData(albumId, JSON.stringify(newMetadata));
  }
}

type Metadata = {
  albumId: string;
  albumName: string;
  files: {
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number; original: number };
  }[];
};
