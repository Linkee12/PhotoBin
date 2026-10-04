import { describe, expect, it } from "vitest";
import {
  AlbumFile,
  downloadPart,
  editedFileName,
  partMimeType,
  viewerPart,
} from "./renditions";

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

describe("partMimeType", () => {
  it("types full files by their name", () => {
    const video = file({ original: part, originalVideo: part });
    expect(partMimeType(video, "originalVideo", "clip.MOV")).toBe("video/quicktime");
    expect(partMimeType(file({}), "unsupportedFile", "IMG.HEIC")).toBe("image/heic");
    expect(partMimeType(file({ original: part }), "original", "a.png")).toBe("image/png");
  });
  it("types a video's poster frame and a re-encoded edit as JPEG", () => {
    const video = file({ original: part, originalVideo: part });
    expect(partMimeType(video, "original", "clip.mov")).toBe("image/jpeg");
    expect(partMimeType(file({ original: part }), "edited", "a.gif")).toBe("image/jpeg");
  });
  it("leaves canvas renditions untyped", () => {
    expect(partMimeType(file({ original: part }), "reduced", "a.png")).toBe("");
  });
});
