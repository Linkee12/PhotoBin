import type fs from "fs";
import path from "node:path";

const ALBUMS_ROOT = path.resolve("./albums");

function safeMetadataPath(albumId: string) {
  const resolved = path.resolve(ALBUMS_ROOT, albumId, "metadata.json");
  if (!resolved.startsWith(ALBUMS_ROOT + path.sep)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

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
    original?: { iv: string; chunkCount: number } | undefined;
    reduced?: { iv: string; chunkCount: number } | undefined;
    thumbnail?: { iv: string; chunkCount: number } | undefined;
    originalVideo?: { iv: string; chunkCount: number } | undefined;
    unsupportedFile?: { iv: string; chunkCount: number } | undefined;
  }[];
};

const DEFAULT_METADATA = (albumId: string): Metadata => ({
  albumId,
  albumName: { value: "", iv: "" },
  files: [],
});

export class MetadataService {
  constructor(
    private _fs: Pick<typeof fs, "existsSync" | "readFileSync" | "writeFileSync">,
  ) {}
  get(albumId: string): Metadata {
    const metadataPath = safeMetadataPath(albumId);
    const fileExists = this._fs.existsSync(metadataPath);
    if (fileExists) {
      return JSON.parse(this._fs.readFileSync(metadataPath, "utf8"));
    } else {
      return DEFAULT_METADATA(albumId);
    }
  }
  save(albumId: string, metadata: Metadata) {
    this._fs.writeFileSync(safeMetadataPath(albumId), JSON.stringify(metadata));
  }
  addFile(albumId: string, file: Metadata["files"][0]) {
    const current = this.get(albumId);
    // Idempotent: a retried finalize must not duplicate the entry.
    current.files = current.files.filter((f) => f.fileId !== file.fileId);
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
