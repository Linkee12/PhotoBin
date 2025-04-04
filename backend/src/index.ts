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
  sayHi: builder
    .querySchema(
      z.object({
        name: z.string().min(2),
      }),
    )
    .get(async ({ data }) => {
      return success({
        message: `Hi ${data.query.name}!`,
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
      imageService.createAlbum(data.body);
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
