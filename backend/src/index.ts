import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc, apiResponse } from "@cuple/server";
import { z } from "zod";
import {
  AlbumNotFoundError,
  AlbumService,
  DEFAULT_ALBUM_TTL_MS,
  DEFAULT_EDIT_LOCK_TTL_MS,
  DEFAULT_ORPHAN_TTL_MS,
  EditInProgressError,
} from "./services/AlbumService";
import {
  batchUpsertSchema,
  editPatchSchema,
  encryptedEntrySchema,
  fileMetadataSchema,
  metadataSchema,
  partNameSchema,
  partTypeSchema,
  uploadedPartsQuerySchema,
  uuidSchema,
} from "./utils/zod";
import { MetadataService } from "./services/MetadataService";
import fs from "fs";
dotenv.config();

const ONE_HOUR_MS = 60 * 60 * 1000;
const albumTtlMs = Number(process.env["ALBUM_TTL_MS"]) || DEFAULT_ALBUM_TTL_MS;
const orphanTtlMs = Number(process.env["ORPHAN_TTL_MS"]) || DEFAULT_ORPHAN_TTL_MS;
const cleanupIntervalMs = Number(process.env["CLEANUP_INTERVAL_MS"]) || ONE_HOUR_MS;
const editLockTtlMs = Number(process.env["EDIT_LOCK_TTL_MS"]) || DEFAULT_EDIT_LOCK_TTL_MS;

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));

const builder = createBuilder(app);
const metadataService = new MetadataService(fs);
const albumService = new AlbumService(metadataService, albumTtlMs, {
  editLockTtlMs,
  orphanTtlMs,
});

// Binary part transport: chunks travel as application/octet-stream instead of
// base64 inside JSON (no +33% wire bytes, no base64/JSON CPU on either side).
// Ciphertext is bytes too, so encrypted albums use it as well.
const partParamsSchema = z.object({
  albumId: uuidSchema,
  fileId: uuidSchema,
  type: partTypeSchema,
  part: partNameSchema,
});
/** `?editId=<uuid>` routes a PUT into the file's edit staging dir (see AlbumService.beginEdit). */
const partQuerySchema = z.object({ editId: uuidSchema.optional() });
const PART_ROUTE = "/parts/:albumId/:fileId/:type/:part";
const MAX_PART_BYTES = 8 * 1024 * 1024;
function parsePartParams(params: unknown) {
  const parsed = partParamsSchema.safeParse(params);
  return parsed.success ? parsed.data : undefined;
}
app.put(
  PART_ROUTE,
  express.raw({ type: "application/octet-stream", limit: MAX_PART_BYTES }),
  async (req, res, next) => {
    try {
      const params = parsePartParams(req.params);
      if (params === undefined) {
        res.status(400).json({ message: "Invalid part path" });
        return;
      }
      const query = partQuerySchema.safeParse(req.query);
      if (!query.success) {
        res.status(400).json({ message: "Invalid editId" });
        return;
      }
      if (!Buffer.isBuffer(req.body)) {
        res.status(415).json({ message: "Expected application/octet-stream body" });
        return;
      }
      await albumService.uploadFilePartRaw({
        albumId: params.albumId,
        fileId: params.fileId,
        fileType: params.type,
        partName: params.part,
        bytes: req.body,
        editId: query.data.editId,
      });
      res.status(204).end();
    } catch (err) {
      if (err instanceof AlbumNotFoundError) {
        res.status(404).json({ message: err.message, code: err.code });
        return;
      }
      next(err);
    }
  },
);
/** The cuple-shaped 404 for writes into an album that does not exist. */
function albumNotFound(err: AlbumNotFoundError) {
  return apiResponse("not-found", 404, { message: err.message, code: err.code });
}
app.get(PART_ROUTE, async (req, res, next) => {
  try {
    const params = parsePartParams(req.params);
    if (params === undefined) {
      res.status(400).json({ message: "Invalid part path" });
      return;
    }
    const bytes = await albumService.getFileBytes(
      params.albumId,
      params.fileId,
      params.type,
      params.part,
    );
    // A `?v=<iv>` URL identifies the exact ciphertext (a replaced part gets a
    // new iv, hence a new URL), so the browser may cache it for good. Without
    // it (plain albums) the response must be revalidated; express's ETag turns
    // an unchanged part into a bodiless 304.
    const versioned = typeof req.query["v"] === "string" && req.query["v"].length > 0;
    res.set(
      "Cache-Control",
      versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
    );
    res.type("application/octet-stream").send(bytes);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).end();
      return;
    }
    next(err);
  }
});
const routes = {
  getAlbumMetadata: builder
    .querySchema(
      z.object({
        id: uuidSchema,
      }),
    )
    .get(async ({ data }) => {
      if (!(await albumService.exists(data.query.id))) {
        return apiResponse("not-found", 404, { message: "Album not found" });
      }
      const metadata = albumService.getMetaData(data.query.id);
      const expiresAt = await albumService.getExpiresAt(data.query.id);
      return success({ metadata, expiresAt });
    }),
  createAlbum: builder
    .bodySchema(z.object({ albumId: uuidSchema }))
    .post(async ({ data }) => {
      await albumService.createAlbum(data.body.albumId);
      return success({});
    }),
  deleteAlbum: builder
    .bodySchema(z.object({ albumId: uuidSchema }))
    .delete(async ({ data }) => {
      await albumService.deleteAlbum(data.body.albumId);
      return success({});
    }),
  getPartOfImage: builder
    .querySchema(
      z.object({
        albumId: uuidSchema,
        id: uuidSchema,
        type: partTypeSchema,
        name: partNameSchema,
      }),
    )
    .get(async ({ data }) => {
      const file = await albumService.getFile(
        data.query.albumId,
        data.query.id,
        data.query.type,
        data.query.name,
      );
      return success({ file });
    }),
  getUploadedParts: builder
    .querySchema(uploadedPartsQuerySchema)
    .get(async ({ data }) => {
      const uploaded = await albumService.getUploadedParts(
        data.query.albumId,
        data.query.fileId,
      );
      return success(uploaded);
    }),
  uploadFilePart: builder
    .bodySchema(
      z.object({
        fileType: partTypeSchema,
        albumId: uuidSchema,
        fileId: uuidSchema,
        partName: partNameSchema,
        encryptedFile: z.string(),
        editId: uuidSchema.optional(),
      }),
    )
    .post(async ({ data }) => {
      try {
        await albumService.uploadFilePart(data.body);
      } catch (err) {
        if (err instanceof AlbumNotFoundError) return albumNotFound(err);
        throw err;
      }
      return success({});
    }),
  editAlbumName: builder
    .bodySchema(
      z.object({
        albumId: uuidSchema,
        albumName: metadataSchema.shape.albumName,
      }),
    )
    .post(async ({ data }) => {
      await albumService.rename(data.body.albumId, data.body.albumName);
      return success({
        message: "File name been uploaded successfully!",
      });
    }),
  finalizeFile: builder
    .bodySchema(
      z.object({
        albumId: uuidSchema,
        fileMetadata: fileMetadataSchema,
        /** Upserted together with the file, so a batch exists iff one of its files finalized. */
        batch: batchUpsertSchema.optional(),
      }),
    )
    .post(async ({ data }) => {
      try {
        await albumService.finalizeFile(
          data.body.albumId,
          data.body.fileMetadata,
          data.body.batch,
        );
      } catch (err) {
        if (err instanceof AlbumNotFoundError) return albumNotFound(err);
        throw err;
      }
      return success({
        message: "File has been uploaded successfully!",
        // Echoed so a client can tell that the batch was actually recorded
        // (a server without batch support would drop the field silently).
        batchId: data.body.batch?.batchId,
      });
    }),
  renameBatch: builder
    .bodySchema(
      z.object({
        albumId: uuidSchema,
        batchId: uuidSchema,
        name: encryptedEntrySchema,
      }),
    )
    .post(async ({ data }) => {
      albumService.renameBatch(data.body.albumId, data.body.batchId, data.body.name);
      return success({});
    }),
  beginEdit: builder
    .bodySchema(z.object({ albumId: uuidSchema, fileId: uuidSchema }))
    .post(async ({ data }) => {
      try {
        const { editId } = await albumService.beginEdit(
          data.body.albumId,
          data.body.fileId,
        );
        return success({ editId });
      } catch (err) {
        if (err instanceof EditInProgressError) {
          return apiResponse("edit-in-progress", 409, {
            message: err.message,
            code: err.code,
          });
        }
        throw err;
      }
    }),
  commitEdit: builder
    .bodySchema(
      z.object({
        albumId: uuidSchema,
        fileId: uuidSchema,
        editId: uuidSchema,
        patch: editPatchSchema,
      }),
    )
    .post(async ({ data }) => {
      await albumService.commitEdit(
        data.body.albumId,
        data.body.fileId,
        data.body.editId,
        data.body.patch,
      );
      return success({});
    }),
  abortEdit: builder
    .bodySchema(z.object({ albumId: uuidSchema, fileId: uuidSchema, editId: uuidSchema }))
    .post(async ({ data }) => {
      await albumService.abortEdit(data.body.albumId, data.body.fileId, data.body.editId);
      return success({});
    }),
  deleteImages: builder
    .bodySchema(z.object({ albumId: uuidSchema, ids: z.array(uuidSchema) }))
    .delete(async ({ data }) => {
      await albumService.deleteImages(data.body.albumId, data.body.ids);
      return success({});
    }),
  ...(process.env["NODE_ENV"] === "production"
    ? {}
    : {
        forceCleanup: builder.path("/dev/force-cleanup").post(async () => {
          await albumService.cleanStorage();
          return success({ message: "Expired albums deleted" });
        }),
      }),
};

initRpc(app, {
  path: "/rpc",
  routes,
});

export type Routes = typeof routes;

const server = app.listen(port, () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});

function runCleanup() {
  albumService.cleanStorage(albumTtlMs, orphanTtlMs).catch((err) => {
    console.error("Scheduled cleanup failed:", err);
  });
}

// No edit can legitimately be in flight at startup: drop every lock/staging dir
// and repair any half-finished commit, then run the regular cleanup.
async function startupCleanup() {
  try {
    await albumService.collectEditGarbage({ all: true });
  } catch (err) {
    console.error("Startup edit garbage collection failed:", err);
  }
  runCleanup();
}
startupCleanup();
setInterval(runCleanup, cleanupIntervalMs).unref();

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down`);
  server.close();
  albumService
    .collectEditGarbage({ all: true })
    .catch((err) => console.error("Shutdown edit garbage collection failed:", err))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
