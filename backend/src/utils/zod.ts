import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const partTypeSchema = z.enum([
  "original",
  "reduced",
  "thumbnail",
  "originalVideo",
  "unsupportedFile",
]);
export const partNameSchema = z.string().regex(/^\d+$/, "partName must be numeric");

export const fileMetadataSchema = z.object({
  fileId: uuidSchema,
  fileName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  date: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  original: z
    .object({
      iv: z.string(),
      chunkCount: z.number(),
    })
    .optional(),
  reduced: z
    .object({
      iv: z.string(),
      chunkCount: z.number(),
    })
    .optional(),
  thumbnail: z
    .object({
      iv: z.string(),
      chunkCount: z.number(),
    })
    .optional(),
  originalVideo: z
    .object({
      iv: z.string(),
      chunkCount: z.number(),
    })
    .optional(),
  unsupportedFile: z
    .object({
      iv: z.string(),
      chunkCount: z.number(),
    })
    .optional(),
});

export const metadataSchema = z.object({
  albumId: uuidSchema,
  albumName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  files: z.array(fileMetadataSchema),
});
