import type fs from "fs";

export type Metadata = {
  albumId: string;
  albumName: { value: string; iv: string };
  files: {
    fileName: {
      value: string;
      iv: string;
    };
    date: {
      value: string;
      iv: string;
    };
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number; original: number; thumbnail: number };
  }[];
};

const DEFAULT_METADATA = (albumId: string): Metadata => ({
  albumId,
  albumName: { value: "", iv: "" },
  files: [],
});

const METADATA_PATH = (albumId: string) => `./albums/${albumId}/metadata.json`;

export class MetadataService {
  constructor(
    private _fs: Pick<typeof fs, "existsSync" | "readFileSync" | "writeFileSync">,
  ) {}
  get(albumId: string): Metadata {
    const fileExists = this._fs.existsSync(METADATA_PATH(albumId));
    if (fileExists) {
      return JSON.parse(this._fs.readFileSync(METADATA_PATH(albumId), "utf8"));
    } else {
      return DEFAULT_METADATA(albumId);
    }
  }
  save(albumId: string, metadata: Metadata) {
    this._fs.writeFileSync(METADATA_PATH(albumId), JSON.stringify(metadata));
  }
  addFile(albumId: string, file: Metadata["files"][0]) {
    const current = this.get(albumId);
    current.files.push(file);
    this.save(albumId, current);
  }
  removeFile(albumId: string, fileId: string) {
    const current = this.get(albumId);
    current.files = current.files.filter((file) => file.fileId !== fileId);
    this.save(albumId, current);
  }
  async renameAlbum(albumId: string, newTitle: { value: string; iv: string }) {
    const current = this.get(albumId);
    current.albumName = newTitle;
    this.save(albumId, current);
  }
}
