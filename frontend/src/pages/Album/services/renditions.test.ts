import { describe, expect, it } from "vitest";
import { AlbumFile, downloadPart, editedFileName, viewerPart } from "./renditions";

const entry = { value: "", iv: "" };
const part = { iv: "", chunkCount: 1 };
const file = (extra: Partial<AlbumFile>): AlbumFile => ({
  fileId: "f",
  fileName: entry,
  date: entry,
  ...extra,
});

describe("viewerPart", () => {
  it("prefers reduced, carrying the stored rotation", () => {
    expect(viewerPart(file({ original: part, reduced: part, rotation: 1 }))).toEqual({
      type: "reduced",
      rotation: 1,
    });
  });
  it("falls back to edited only for rotated photos", () => {
    expect(viewerPart(file({ original: part, edited: part, rotation: 2 }))).toEqual({
      type: "edited",
      rotation: 2,
    });
    expect(viewerPart(file({ original: part, edited: part, rotation: 0 }))).toEqual({
      type: "original",
      rotation: 0,
    });
  });
  it("shows the untouched original otherwise", () => {
    expect(viewerPart(file({ original: part }))).toEqual({
      type: "original",
      rotation: 0,
    });
  });
});

describe("downloadPart", () => {
  it("takes the video before its poster frame", () => {
    expect(downloadPart(file({ original: part, originalVideo: part }))).toBe(
      "originalVideo",
    );
  });
  it("takes the rotated re-encode unless the original is asked for", () => {
    const rotated = file({ original: part, edited: part, rotation: 3 });
    expect(downloadPart(rotated)).toBe("edited");
    expect(downloadPart(rotated, "original")).toBe("original");
    expect(downloadPart(file({ original: part, edited: part, rotation: 0 }))).toBe(
      "original",
    );
  });
  it("is the raw file for unsupported files", () => {
    expect(downloadPart(file({ unsupportedFile: part }))).toBe("unsupportedFile");
  });
});

describe("editedFileName", () => {
  it("keeps names the edit kept the format of", () => {
    expect(editedFileName("a.JPG")).toBe("a.JPG");
    expect(editedFileName("a.png")).toBe("a.png");
    expect(editedFileName("a.webp")).toBe("a.webp");
  });
  it("re-encoded sources become .jpg", () => {
    expect(editedFileName("a.gif")).toBe("a.jpg");
    expect(editedFileName("a.b.tiff")).toBe("a.b.jpg");
    expect(editedFileName("noext")).toBe("noext.jpg");
  });
});
