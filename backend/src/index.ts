import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc } from "@cuple/server";
import { z } from "zod";
import { AlbumService } from "./services/AlbumService";
import {
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
const albumTtlMs = Number(process.env["ALBUM_TTL_MS"]) || ONE_MONTH_MS;
const cleanupIntervalMs = Number(process.env["CLEANUP_INTERVAL_MS"]) || ONE_HOUR_MS;

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));

const builder = createBuilder(app);
const metadataService = new MetadataService(fs);
const albumService = new AlbumService(metadataService, albumTtlMs);

// Binary part transport: chunks travel as application/octet-stream instead of
// base64 inside JSON (no +33% wire bytes, no base64/JSON CPU on either side).
// Ciphertext is bytes too, so encrypted albums use it as well.
const partParamsSchema = z.object({
  albumId: uuidSchema,
  fileId: uuidSchema,
  type: partTypeSchema,
  part: partNameSchema,
});
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
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
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

app.listen(port, () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});

function runCleanup() {
  albumService.cleanStorage(albumTtlMs).catch((err) => {
    console.error("Scheduled cleanup failed:", err);
  });
}

runCleanup();
setInterval(runCleanup, cleanupIntervalMs).unref();
