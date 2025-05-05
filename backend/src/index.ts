import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc } from "@cuple/server";
import { z } from "zod";
import { AlbumService } from "./services/AlbumService";
import { fileMetadataSchema, metadataSchema } from "./utils/zod";
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
        id: z.string(),
      }),
    )
    .get(async ({ data }) => {
      const metadata = albumService.getMetaData(data.query.id);
      return success({ metadata });
    }),
  getPartOfImage: builder
    .querySchema(
      z.object({
        albumId: z.string(),
        id: z.string(),
        type: z.string(),
        name: z.string(),
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
        fileType: z.string(),
        albumId: z.string(),
        fileId: z.string(),
        partName: z.string(),
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
        albumId: z.string(),
        albumName: metadataSchema.shape.albumName,
      }),
    )
    .post(async ({ data }) => {
      albumService.rename(data.body.albumId, data.body.albumName);
      return success({
        message: "File name been uploaded successfully!",
      });
    }),
  finalizeFile: builder
    .bodySchema(
      z.object({
        albumId: z.string(),
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
    .bodySchema(z.object({ albumId: z.string(), ids: z.array(z.string()) }))
    .delete(async ({ data }) => {
      albumService.deleteImages(data.body.albumId, data.body.ids);
      return success({});
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
