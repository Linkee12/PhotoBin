import { describe, expect, it } from "vitest";
import { mimeTypeOf } from "./mimeType";

describe("mimeTypeOf", () => {
  it("maps known extensions, ignoring case", () => {
    expect(mimeTypeOf("IMG_0001.MOV")).toBe("video/quicktime");
    expect(mimeTypeOf("a.b.heic")).toBe("image/heic");
    expect(mimeTypeOf("photo.jpeg")).toBe("image/jpeg");
  });
  it("is empty for unknown or missing extensions", () => {
    expect(mimeTypeOf("raw.CR3")).toBe("");
    expect(mimeTypeOf("README")).toBe("");
    expect(mimeTypeOf("trailing.")).toBe("");
  });
});
