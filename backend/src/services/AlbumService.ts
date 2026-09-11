import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FilePart, Metadata, MetadataService } from "./MetadataService";

const DEFAULT_ALBUMS_ROOT = path.resolve("./albums");
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

const EDIT_LOCK = ".edit-lock";
const EDIT_STAGING_PREFIX = ".edit-";
const OLD_SUFFIX = ".old";
const EDITABLE_PART_TYPES = ["edited", "reduced", "thumbnail"] as const;
type EditablePartType = (typeof EDITABLE_PART_TYPES)[number];

export type EditPatch = {
  rotation: 0 | 1 | 2 | 3;
  edited?: FilePart | undefined;
  reduced: FilePart;
  thumbnail: FilePart;
};

type EditLock = { editId: string; startedAt: number };

export class EditInProgressError extends Error {
  readonly code = "EDIT_IN_PROGRESS";
  constructor() {
    super("Someone is editing this photo");
    this.name = "EditInProgressError";
  }
}

function isEnoent(err: unknown) {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
function isEexist(err: unknown) {
  return (err as NodeJS.ErrnoException).code === "EEXIST";
}

export class AlbumService {
  private _albumsRoot: string;
  private _editLockTtlMs: number;
  constructor(
    private _metadataService: MetadataService,
    private _ttlMs: number = ONE_MONTH_MS,
    options: { albumsRoot?: string; editLockTtlMs?: number } = {},
  ) {
    this._albumsRoot = options.albumsRoot ?? DEFAULT_ALBUMS_ROOT;
    this._editLockTtlMs = options.editLockTtlMs ?? TEN_MINUTES_MS;
  }
  getMetaData(albumId: string) {
    return this._metadataService.get(albumId);
  }
  async getExpiresAt(albumId: string): Promise<number | null> {
    try {
      const s = await fs.stat(this._safePath(albumId));
      return Math.floor(s.birthtimeMs + this._ttlMs);
    } catch (err) {
      if (isEnoent(err)) return null;
      throw err;
    }
  }
  async rename(albumId: string, newTitle: { value: string; iv: string }) {
    const dir = this._safePath(albumId);
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
    editId?: string | undefined;
  }) {
    let dir: string;
    if (params.editId !== undefined) {
      if (!this._isEditablePartType(params.fileType)) {
        throw new Error(`Part type "${params.fileType}" cannot be edited`);
      }
      await this._assertLockHeld(params.albumId, params.fileId, params.editId);
      dir = this._stagingPath(
        params.albumId,
        params.fileId,
        params.editId,
        params.fileType,
      );
    } else {
      dir = this._safePath(params.albumId, params.fileId, params.fileType);
    }
    await fs.mkdir(dir, { recursive: true });
    const filePath = this._safePath(dir, params.partName);
    await fs.writeFile(filePath, params.encryptedFile);
  }
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const filePath = this._safePath(albumId, fileId, type, name);
    return await fs.readFile(filePath, { encoding: "utf8" });
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  async cleanStorage(ttlMs: number = this._ttlMs) {
    let directions: string[];
    try {
      directions = await fs.readdir(this._albumsRoot);
    } catch (err) {
      if (isEnoent(err)) return;
      throw err;
    }
    const now = Date.now();
    for (const dir of directions) {
      try {
        const albumPath = this._safePath(dir);
        const s = await fs.stat(albumPath);
        if (now - s.birthtimeMs > ttlMs) {
          await this._deleteDir(dir);
        }
      } catch (err) {
        console.error(`cleanStorage: failed to inspect ${dir}`, err);
      }
    }
    await this.collectEditGarbage();
  }

  // ---------------------------------------------------------------------------
  // Edit lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Acquires the per-file edit lock. Throws EditInProgressError when a fresh
   * lock is held by someone else; a stale lock is taken over.
   */
  async beginEdit(albumId: string, fileId: string): Promise<{ editId: string }> {
    const file = this._metadataService
      .get(albumId)
      .files.find((f) => f.fileId === fileId);
    if (!file) throw new Error("File not found");
    if (!file.original || file.originalVideo)
      throw new Error("Only images can be edited");

    const lockPath = this._safePath(albumId, fileId, EDIT_LOCK);
    const editId = randomUUID();
    const lock: EditLock = { editId, startedAt: Date.now() };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // "wx" makes the create exclusive, so two concurrent begins can't both win.
        await fs.writeFile(lockPath, JSON.stringify(lock), { flag: "wx" });
        return { editId };
      } catch (err) {
        if (!isEexist(err)) throw err;
        const existing = await this._readLock(albumId, fileId);
        if (existing && !this._isStale(existing.startedAt))
          throw new EditInProgressError();
        if (existing) await this._removeStaging(albumId, fileId, existing.editId);
        await fs.rm(lockPath, { force: true });
      }
    }
    throw new EditInProgressError();
  }

  /**
   * Atomically swaps every staged part dir into place, then writes metadata,
   * then releases the lock. Crash between steps is repaired by collectEditGarbage.
   */
  async commitEdit(albumId: string, fileId: string, editId: string, patch: EditPatch) {
    await this._assertLockHeld(albumId, fileId, editId);
    const stagingDir = this._stagingPath(albumId, fileId, editId);

    const staged = new Set<string>();
    try {
      for (const entry of await fs.readdir(stagingDir)) staged.add(entry);
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
    for (const type of EDITABLE_PART_TYPES) {
      if (patch[type] !== undefined && !staged.has(type)) {
        throw new Error(`Part "${type}" is in the patch but was not uploaded`);
      }
    }

    for (const type of staged) {
      if (!this._isEditablePartType(type)) continue;
      await this._swapIn(albumId, fileId, editId, type);
    }

    const metadataPatch: Partial<Metadata["files"][0]> = {
      rotation: patch.rotation,
      reduced: patch.reduced,
      thumbnail: patch.thumbnail,
      edited: patch.rotation === 0 ? undefined : patch.edited,
    };
    if (patch.rotation === 0) {
      await fs.rm(this._safePath(albumId, fileId, "edited"), {
        recursive: true,
        force: true,
      });
    }
    this._metadataService.updateFile(albumId, fileId, metadataPatch);

    await this._removeStaging(albumId, fileId, editId);
    await fs.rm(this._safePath(albumId, fileId, EDIT_LOCK), { force: true });
  }

  /** Drops the staging dir and, when it belongs to `editId`, the lock. Idempotent. */
  async abortEdit(albumId: string, fileId: string, editId: string) {
    await this._removeStaging(albumId, fileId, editId);
    const lock = await this._readLock(albumId, fileId);
    if (lock?.editId === editId) {
      await fs.rm(this._safePath(albumId, fileId, EDIT_LOCK), { force: true });
    }
  }

  /**
   * Repairs the edit-related file system state for every file:
   *  - removes stale (or, with `all`, every) lock and staging dir,
   *  - resolves leftover `<type>.old` dirs from an interrupted commit.
   */
  async collectEditGarbage(options: { all?: boolean } = {}) {
    let albumIds: string[];
    try {
      albumIds = await fs.readdir(this._albumsRoot);
    } catch (err) {
      if (isEnoent(err)) return;
      throw err;
    }
    for (const albumId of albumIds) {
      let fileIds: string[];
      try {
        fileIds = await this._listSubdirs(this._safePath(albumId));
      } catch (err) {
        console.error(`collectEditGarbage: failed to read ${albumId}`, err);
        continue;
      }
      for (const fileId of fileIds) {
        try {
          await this._collectFileGarbage(albumId, fileId, options.all === true);
        } catch (err) {
          console.error(`collectEditGarbage: failed on ${albumId}/${fileId}`, err);
        }
      }
    }
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async _collectFileGarbage(albumId: string, fileId: string, all: boolean) {
    const fileDir = this._safePath(albumId, fileId);
    const entries = await fs.readdir(fileDir, { withFileTypes: true });
    const lock = all ? null : await this._readLock(albumId, fileId);
    const liveEditId = lock && !this._isStale(lock.startedAt) ? lock.editId : null;

    for (const entry of entries) {
      const name = entry.name;
      if (name === EDIT_LOCK) {
        if (liveEditId === null)
          await fs.rm(this._safePath(fileDir, name), { force: true });
      } else if (name.startsWith(EDIT_STAGING_PREFIX) && entry.isDirectory()) {
        const editId = name.slice(EDIT_STAGING_PREFIX.length);
        if (editId === liveEditId) continue;
        const stat = await fs.stat(this._safePath(fileDir, name));
        if (all || this._isStale(stat.mtimeMs)) {
          await fs.rm(this._safePath(fileDir, name), { recursive: true, force: true });
        }
      } else if (name.endsWith(OLD_SUFFIX) && entry.isDirectory()) {
        const type = name.slice(0, -OLD_SUFFIX.length);
        const oldPath = this._safePath(fileDir, name);
        if (await this._checkDirectoryExists(this._safePath(fileDir, type))) {
          await fs.rm(oldPath, { recursive: true, force: true });
        } else {
          await fs.rename(oldPath, this._safePath(fileDir, type));
        }
      }
    }
  }

  private async _swapIn(
    albumId: string,
    fileId: string,
    editId: string,
    type: EditablePartType,
  ) {
    const live = this._safePath(albumId, fileId, type);
    const old = this._safePath(albumId, fileId, type + OLD_SUFFIX);
    const staged = this._stagingPath(albumId, fileId, editId, type);
    await fs.rm(old, { recursive: true, force: true });
    try {
      await fs.rename(live, old);
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
    await fs.rename(staged, live);
    await fs.rm(old, { recursive: true, force: true });
  }

  private async _assertLockHeld(albumId: string, fileId: string, editId: string) {
    const lock = await this._readLock(albumId, fileId);
    if (!lock || lock.editId !== editId || this._isStale(lock.startedAt)) {
      throw new Error("Edit lock is not held by this editId");
    }
  }

  private async _readLock(albumId: string, fileId: string): Promise<EditLock | null> {
    try {
      const raw = await fs.readFile(this._safePath(albumId, fileId, EDIT_LOCK), "utf8");
      const parsed = JSON.parse(raw) as Partial<EditLock>;
      if (typeof parsed.editId !== "string" || typeof parsed.startedAt !== "number") {
        return null;
      }
      return { editId: parsed.editId, startedAt: parsed.startedAt };
    } catch (err) {
      if (isEnoent(err) || err instanceof SyntaxError) return null;
      throw err;
    }
  }

  private _isStale(timestampMs: number) {
    return Date.now() - timestampMs > this._editLockTtlMs;
  }

  private _isEditablePartType(type: string): type is EditablePartType {
    return (EDITABLE_PART_TYPES as readonly string[]).includes(type);
  }

  private _stagingPath(
    albumId: string,
    fileId: string,
    editId: string,
    ...rest: string[]
  ) {
    return this._safePath(albumId, fileId, EDIT_STAGING_PREFIX + editId, ...rest);
  }

  private async _removeStaging(albumId: string, fileId: string, editId: string) {
    await fs.rm(this._stagingPath(albumId, fileId, editId), {
      recursive: true,
      force: true,
    });
  }

  private async _listSubdirs(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  private _safePath(...segments: string[]) {
    const resolved = path.resolve(this._albumsRoot, ...segments);
    if (
      resolved !== this._albumsRoot &&
      !resolved.startsWith(this._albumsRoot + path.sep)
    ) {
      throw new Error("Path traversal blocked");
    }
    return resolved;
  }

  private async _deleteImage(albumId: string, imageId: string) {
    await fs.rm(this._safePath(albumId, imageId), {
      recursive: true,
      force: true,
    });
    this._metadataService.removeFile(albumId, imageId);
  }
  private async _deleteDir(albumId: string) {
    await fs.rm(this._safePath(albumId), {
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
