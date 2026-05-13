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

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));
const builder = createBuilder(app);
const metadataService = new MetadataService(fs);
const albumService = new AlbumService(metadataService);
const routes = {
  getAlbumMetadata: builder
    .querySchema(
      z.object({
        id: uuidSchema,
      }),
    )
    .get(async ({ data }) => {
      const metadata = albumService.getMetaData(data.query.id);
      return success({ metadata });
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
