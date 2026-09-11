import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const partTypeSchema = z.enum([
  "original",
  "reduced",
  "thumbnail",
  "originalVideo",
  "unsupportedFile",
  "edited",
]);
/** Part types that may be replaced through the edit lifecycle. */
export const editablePartTypeSchema = z.enum(["edited", "reduced", "thumbnail"]);
export const rotationSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export const filePartSchema = z.object({
  iv: z.string(),
  chunkCount: z.number(),
});
export const partNameSchema = z.string().regex(/^\d+$/, "partName must be numeric");
export type PartType = z.infer<typeof partTypeSchema>;

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
  rotation: rotationSchema.optional(),
  edited: filePartSchema.optional(),
});

export const editPatchSchema = z.object({
  rotation: rotationSchema,
  edited: filePartSchema.optional(),
  reduced: filePartSchema,
  thumbnail: filePartSchema,
});

export const metadataSchema = z.object({
  albumId: uuidSchema,
  albumName: z.object({
    value: z.string(),
    iv: z.string(),
  }),
  files: z.array(fileMetadataSchema),
});
