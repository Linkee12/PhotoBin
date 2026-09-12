import type fs from "fs";
import path from "node:path";

const DEFAULT_ALBUMS_ROOT = path.resolve("./albums");

function safeMetadataPath(albumsRoot: string, albumId: string) {
  const resolved = path.resolve(albumsRoot, albumId, "metadata.json");
  if (!resolved.startsWith(albumsRoot + path.sep)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

export type FilePart = { iv: string; chunkCount: number };

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
    original?: FilePart | undefined;
    reduced?: FilePart | undefined;
    thumbnail?: FilePart | undefined;
    originalVideo?: FilePart | undefined;
    unsupportedFile?: FilePart | undefined;
    /** Quarter turns clockwise applied to `original`; undefined means 0. Stored in plaintext. */
    rotation?: 0 | 1 | 2 | 3 | undefined;
    /** Full-resolution rotated re-encode of `original`; present only when rotation !== 0. */
    edited?: FilePart | undefined;
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
    private _albumsRoot: string = DEFAULT_ALBUMS_ROOT,
  ) {}
  get(albumId: string): Metadata {
    const metadataPath = safeMetadataPath(this._albumsRoot, albumId);
    const fileExists = this._fs.existsSync(metadataPath);
    if (fileExists) {
      return JSON.parse(this._fs.readFileSync(metadataPath, "utf8"));
    } else {
      return DEFAULT_METADATA(albumId);
    }
  }
  save(albumId: string, metadata: Metadata) {
    this._fs.writeFileSync(
      safeMetadataPath(this._albumsRoot, albumId),
      JSON.stringify(metadata),
    );
  }
  addFile(albumId: string, file: Metadata["files"][0]) {
    const current = this.get(albumId);
    // Idempotent: a retried finalize must not duplicate the entry.
    current.files = current.files.filter((f) => f.fileId !== file.fileId);
    current.files.push(file);
    this.save(albumId, current);
  }
  /**
   * Merges `patch` into the file entry. Keys explicitly set to `undefined`
   * are removed from the entry (e.g. dropping `edited`).
   */
  updateFile(albumId: string, fileId: string, patch: Partial<Metadata["files"][0]>) {
    const current = this.get(albumId);
    const file = current.files.find((f) => f.fileId === fileId);
    if (!file) throw new Error("File not found in metadata");
    for (const [k, v] of Object.entries(patch)) {
      const key = k as keyof Metadata["files"][0];
      if (v === undefined) delete file[key];
      else (file as Record<string, unknown>)[key] = v;
    }
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
