import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc, apiResponse } from "@cuple/server";
import { z } from "zod";
import { AlbumService, EditInProgressError } from "./services/AlbumService";
import {
  editPatchSchema,
  fileMetadataSchema,
  metadataSchema,
  partNameSchema,
  partTypeSchema,
  uuidSchema,
} from "./utils/zod";
import { MetadataService } from "./services/MetadataService";
import fs from "fs";
dotenv.config();

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const albumTtlMs = Number(process.env["ALBUM_TTL_MS"]) || ONE_MONTH_MS;
const cleanupIntervalMs = Number(process.env["CLEANUP_INTERVAL_MS"]) || ONE_HOUR_MS;
const editLockTtlMs = Number(process.env["EDIT_LOCK_TTL_MS"]) || TEN_MINUTES_MS;

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));
const builder = createBuilder(app);
const metadataService = new MetadataService(fs);
const albumService = new AlbumService(metadataService, albumTtlMs, { editLockTtlMs });
const routes = {
  getAlbumMetadata: builder
    .querySchema(
      z.object({
        id: uuidSchema,
      }),
    )
    .get(async ({ data }) => {
      const metadata = albumService.getMetaData(data.query.id);
      const expiresAt = await albumService.getExpiresAt(data.query.id);
      return success({ metadata, expiresAt });
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
      await albumService.uploadFilePart(data.body);
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
      }),
    )
    .post(async ({ data }) => {
      albumService.finalizeFile(data.body.albumId, data.body.fileMetadata);
      return success({
        message: "File has been uploaded successfully!",
      });
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
  albumService.cleanStorage(albumTtlMs).catch((err) => {
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
