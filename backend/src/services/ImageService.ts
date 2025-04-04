import fs from "node:fs";
export class ImageService {
  createAlbum(file: {
    name: string;
    albumID: string;
    uuid: string;
    file: string;
    fileName: string;
  }) {
    this._createDirectory(file.albumID + "/" + file.uuid + "/" + file.name);
    this._saveFile(
      file.albumID + "/" + file.uuid + "/" + file.name,
      file.file,
      file.fileName,
    );
  }

  private _createDirectory(folder: string) {
    try {
      const folderName = "./albums/" + folder;
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName, { recursive: true });
      }
    } catch (err) {
      console.error(err);
    }
  }
  private _saveFile(route: string, file: string, fileName: string) {
    const path = "./albums/" + route + "/" + fileName;
    fs.writeFile(path, file, function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("The file was saved!");
    });
  }
}
