import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { batchUpsertSchema, fileMetadataSchema, uuidSchema } from "./zod";

const entry = { value: "", iv: "" };

describe("finalizeFile body schema", () => {
  // `z.object` strips unknown keys silently: a server without these fields
  // would drop the batch and every file would land in "Earlier uploads".
  it("keeps batchId on the file and the batch upsert", () => {
    const batchId = randomUUID();
    const body = z.object({
      albumId: uuidSchema,
      fileMetadata: fileMetadataSchema,
      batch: batchUpsertSchema.optional(),
    });
    const parsed = body.parse({
      albumId: randomUUID(),
      fileMetadata: { fileId: randomUUID(), fileName: entry, date: entry, batchId },
      batch: { batchId, name: entry, createdAt: 1 },
    });
    expect(parsed.fileMetadata.batchId).toBe(batchId);
    expect(parsed.batch).toEqual({ batchId, name: entry, createdAt: 1 });
  });
});
