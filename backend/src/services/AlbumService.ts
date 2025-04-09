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
    const filePath = path.join("./albums/", albumId, "metadata.json");
    const raw = await fs.readFile(filePath, { encoding: "utf8" });
    return await JSON.parse(raw);
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = path.join("./albums/", albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }
  async addMetaData(albumId: string, metaData: string) {
    await fs.writeFile(path.join("./albums/", albumId, "/metadata.json"), metaData);
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
}

type Metadata = {
  albumId: string;
  albumName: string;
  files: {
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
  }[];
};
