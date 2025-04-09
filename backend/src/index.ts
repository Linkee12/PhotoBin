import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc } from "@cuple/server";
import { z } from "zod";
import { AlbumService } from "./services/AlbumService";

dotenv.config();

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));
const builder = createBuilder(app);
const albumService = new AlbumService();
const routes = {
  getAlbumMetadata: builder
    .querySchema(
      z.object({
        id: z.string(),
      }),
    )
    .get(async ({ data }) => {
      const metadata = await albumService.getMetaData(data.query.id);
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
  addAlbum: builder
    .bodySchema(
      z.object({
        albumID: z.string(),
        uuid: z.string(),
        fileName: z.string(),
        name: z.string(),
        file: z.string(),
      }),
    )
    .post(async ({ data }) => {
      await albumService.createAlbum(data.body);
      return success({});
    }),
  addMetadata: builder
    .bodySchema(
      z.object({
        albumID: z.string(),
        metadata: z.string(),
      }),
    )
    .post(async ({ data }) => {
      await albumService.addMetaData(data.body.albumID, data.body.metadata);
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
