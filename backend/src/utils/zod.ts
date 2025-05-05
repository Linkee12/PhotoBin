import { z } from "zod";

export const fileMetadataSchema = z.object({
  fileName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
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
  albumName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  files: z.array(fileMetadataSchema),
});
