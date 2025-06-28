import { z } from "zod";

export const fileMetadataSchema = z.object({
  fileId: z.string(),
  fileName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  date: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  original: z.object({
    iv: z.string(),
    chunkCount: z.number(),
  }),
  reduced: z.object({
    iv: z.string(),
    chunkCount: z.number(),
  }),
  thumbnail: z.object({
    iv: z.string(),
    chunkCount: z.number(),
  }),
  originalVideo: z
    .object({
      slices: z.array(
        z.object({
          iv: z.string(),
          endTimeMs: z.number(),
        }),
      ),
    })
    .optional(),
});

export const metadataSchema = z.object({
  albumId: z.string(),
  albumName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  files: z.array(fileMetadataSchema),
});
