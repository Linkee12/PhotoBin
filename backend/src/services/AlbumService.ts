import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  Batch,
  EncryptedEntry,
  FilePart,
  Metadata,
  MetadataService,
} from "./MetadataService";
import { PartType, partTypeSchema } from "../utils/zod";

const DEFAULT_ALBUMS_ROOT = path.resolve("./albums");
/** Album lifetime (`ALBUM_TTL_MS`). */
export const DEFAULT_ALBUM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Age at which an edit lock is considered abandoned (`EDIT_LOCK_TTL_MS`). */
export const DEFAULT_EDIT_LOCK_TTL_MS = 10 * 60 * 1000;
/** Age at which an unfinalized upload directory is deleted (`ORPHAN_TTL_MS`). */
export const DEFAULT_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;
const METADATA_FILE = "metadata.json";
/** Parts uploaded through the binary route are stored as raw bytes with this suffix. */
const RAW_SUFFIX = ".bin";

export type UploadedParts = {
  parts: Partial<Record<PartType, string[]>>;
  finalized: boolean;
};

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
  private _orphanTtlMs: number;
  constructor(
    private _metadataService: MetadataService,
    private _ttlMs: number = DEFAULT_ALBUM_TTL_MS,
    options: { albumsRoot?: string; editLockTtlMs?: number; orphanTtlMs?: number } = {},
  ) {
    this._albumsRoot = options.albumsRoot ?? DEFAULT_ALBUMS_ROOT;
    this._editLockTtlMs = options.editLockTtlMs ?? DEFAULT_EDIT_LOCK_TTL_MS;
    this._orphanTtlMs = options.orphanTtlMs ?? DEFAULT_ORPHAN_TTL_MS;
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
  finalizeFile(
    albumId: string,
    fileMetadata: Metadata["files"][0],
    batch?: Batch & { batchId: string },
  ) {
    this._metadataService.addFile(albumId, fileMetadata, batch);
  }
  renameBatch(albumId: string, batchId: string, name: EncryptedEntry) {
    this._metadataService.renameBatch(albumId, batchId, name);
  }
  /**
   * Legacy JSON transport: the part arrives base64-encoded and is stored as
   * base64 text under `<partName>`. Kept for clients that still use the RPC route.
   * With `editId` the part lands in the file's edit staging dir instead of the live dir.
   */
  async uploadFilePart(params: {
    fileType: string;
    albumId: string;
    fileId: string;
    partName: string;
    encryptedFile: string;
    editId?: string | undefined;
  }) {
    const filePath = await this._preparePartPath(params, params.partName);
    await fs.writeFile(filePath, params.encryptedFile);
  }
  /**
   * Binary transport: raw bytes are stored as-is under `<partName>.bin`.
   * The suffix lets the read path tell the two on-disk formats apart.
   * With `editId` the part lands in the file's edit staging dir instead of the live dir.
   */
  async uploadFilePartRaw(params: {
    fileType: string;
    albumId: string;
    fileId: string;
    partName: string;
    bytes: Buffer;
    editId?: string | undefined;
  }) {
    const filePath = await this._preparePartPath(params, params.partName + RAW_SUFFIX);
    await fs.writeFile(filePath, params.bytes);
  }
  /** Returns the part as base64 text regardless of how it is stored. */
  /**
   * Lists the part names already stored for a file, grouped by part type, so a
   * client can resume an interrupted upload. Both on-disk layouts are
   * recognised (`<n>.bin` raw and legacy base64 `<n>`); the numeric part name
   * is returned either way. Missing directories yield `{}`.
   */
  async getUploadedParts(albumId: string, fileId: string): Promise<UploadedParts> {
    const finalized = this._metadataService
      .get(albumId)
      .files.some((file) => file.fileId === fileId);
    const parts: UploadedParts["parts"] = {};
    const fileDir = this._safePath(albumId, fileId);
    for (const entry of await this._readdirOrEmpty(fileDir)) {
      const type = partTypeSchema.safeParse(entry.name);
      if (!entry.isDirectory() || !type.success) continue;
      const names = await this._readdirOrEmpty(
        this._safePath(albumId, fileId, type.data),
      );
      const found = new Set<string>();
      for (const part of names) {
        if (!part.isFile()) continue;
        const partName = part.name.endsWith(RAW_SUFFIX)
          ? part.name.slice(0, -RAW_SUFFIX.length)
          : part.name;
        if (/^\d+$/.test(partName)) found.add(partName);
      }
      parts[type.data] = [...found];
    }
    return { parts, finalized };
  }
  /** Returns the part as base64 text regardless of how it is stored. */
  async getFile(albumId: string, fileId: string, type: string, name: string) {
    const raw = await this._readRawPart(albumId, fileId, type, name);
    if (raw !== undefined) return raw.toString("base64");
    return await fs.readFile(this._safePath(albumId, fileId, type, name), {
      encoding: "utf8",
    });
  }
  /** Returns the part as raw bytes regardless of how it is stored. */
  async getFileBytes(albumId: string, fileId: string, type: string, name: string) {
    const raw = await this._readRawPart(albumId, fileId, type, name);
    if (raw !== undefined) return raw;
    const base64 = await fs.readFile(this._safePath(albumId, fileId, type, name), {
      encoding: "utf8",
    });
    return Buffer.from(base64, "base64");
  }

  async deleteImages(albumId: string, imageIds: string[]) {
    for (const imageId of imageIds) {
      await this._deleteImage(albumId, imageId);
    }
  }
  /**
   * Deletes expired albums and, inside live albums, file directories that were
   * never finalized (not referenced by metadata.json) and have not been written
   * to for `orphanTtlMs`. The mtime check keeps in-progress uploads alive.
   */
  async cleanStorage(
    ttlMs: number = this._ttlMs,
    orphanTtlMs: number = this._orphanTtlMs,
  ) {
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
        } else if (s.isDirectory()) {
          await this._cleanOrphans(dir, now, orphanTtlMs);
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

  private async _cleanOrphans(albumId: string, now: number, orphanTtlMs: number) {
    const known = new Set(this._metadataService.get(albumId).files.map((f) => f.fileId));
    const entries = await this._readdirOrEmpty(this._safePath(albumId));
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === METADATA_FILE || known.has(entry.name)) {
        continue;
      }
      try {
        const lastWrite = await this._lastWriteMs(albumId, entry.name);
        if (now - lastWrite > orphanTtlMs) {
          await fs.rm(this._safePath(albumId, entry.name), {
            recursive: true,
            force: true,
          });
          console.log(`cleanStorage: removed orphaned upload ${albumId}/${entry.name}`);
        }
      } catch (err) {
        console.error(`cleanStorage: failed to inspect ${albumId}/${entry.name}`, err);
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

  /**
   * Resolves (and creates) the directory a part is written to: the live
   * `<type>` dir, or the edit staging dir when `editId` is given.
   */
  private async _preparePartPath(
    params: {
      albumId: string;
      fileId: string;
      fileType: string;
      editId?: string | undefined;
    },
    name: string,
  ) {
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
    return this._safePath(dir, name);
  }
  private async _readRawPart(
    albumId: string,
    fileId: string,
    type: string,
    name: string,
  ) {
    try {
      return await fs.readFile(this._safePath(albumId, fileId, type, name + RAW_SUFFIX));
    } catch (err) {
      if (isEnoent(err)) return undefined;
      throw err;
    }
  }

  /**
   * Newest mtime of the file directory and its part-type subdirectories. A
   * directory's mtime only changes when direct children are added, so the
   * subdirectories are what reflect the last uploaded chunk.
   */
  private async _lastWriteMs(albumId: string, fileId: string) {
    const fileDir = this._safePath(albumId, fileId);
    let latest = (await fs.stat(fileDir)).mtimeMs;
    for (const entry of await this._readdirOrEmpty(fileDir)) {
      if (!entry.isDirectory()) continue;
      const s = await fs.stat(this._safePath(albumId, fileId, entry.name));
      latest = Math.max(latest, s.mtimeMs);
    }
    return latest;
  }

  private async _readdirOrEmpty(dir: string) {
    try {
      return await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
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
