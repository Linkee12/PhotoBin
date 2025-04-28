import { z } from "zod";

export const fileMetadataSchema = z.object({
  fileName: z.string(),
  fileId: z.string(),
  originalIv: z.string(),
  reducedIv: z.string(),
  thumbnailIv: z.string(),
  chunks: z.object({
    reduced: z.number(),
    original: z.number(),
    thumbnail: z.number(),
  }),
});

export const metadataSchema = z.object({
  albumId: z.string(),
  albumName: z.string(),
  files: z.array(fileMetadataSchema),
});
