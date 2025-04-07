import express from "express";
import dotenv from "dotenv";
import { createBuilder, success, initRpc } from "@cuple/server";
import { z } from "zod";
import { ImageService } from "./services/ImageService";

dotenv.config();

const app = express();
const port = 3001;
app.use(express.json({ limit: "2mb" }));
const builder = createBuilder(app);
const imageService = new ImageService();
const routes = {
  getAlbum: builder
    .querySchema(
      z.object({
        id: z.string(),
      }),
    )
    .get(async ({ data }) => {
      const albumMap = await imageService.readAlbum(data.query.id);
      return success({
        albumMap,
      });
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
      const file = await imageService.getFile(
        data.query.albumId,
        data.query.id,
        data.query.type,
        data.query.name,
      );
      return success({
        file,
      });
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
      await imageService.createAlbum(data.body);
      return success({});
    }),
  addMetaData: builder
    .bodySchema(
      z.object({
        albumID: z.string(),
        metaData: z.string(),
      }),
    )
    .post(async ({ data }) => {
      await imageService.addMetaData(data.body.albumID, data.body.metaData);
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
