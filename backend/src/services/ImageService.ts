import fs from "node:fs/promises";
import path from "node:path";
export class ImageService {
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

  async readAlbum(albumId: string): Promise<
    {
      imageId: string;
      original: string[];
      reduced: string[];
      thumbnail: string[];
    }[]
  > {
    const albumPath = path.join("./albums/", albumId);
    const albumEntries = await fs.readdir(albumPath);
    const images = [];
    for (const fileName of albumEntries) {
      images.push({
        imageId: fileName,
        original: await fs.readdir(path.join(albumPath, fileName, "original")),
        reduced: await fs.readdir(path.join(albumPath, fileName, "reduced")),
        thumbnail: await fs.readdir(path.join(albumPath, fileName, "thumbnail")),
      });
    }

    return images;
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = path.join("./albums/", albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }
  async addMetaData(albumId: string, metaData: string) {
    await fs.writeFile(path.join("./albums/", albumId, "/metaData.json"), metaData);
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
