import { describe, expect, it } from "vitest";
import {
  chunk,
  countCreated,
  libraryAlbumTitle,
  mediaDownloadUrl,
  parseDuration,
  PickedMediaItem,
  pickedFileName,
  pickerWindowUrl,
} from "./googlePhotosApi";

function item(overrides: Partial<PickedMediaItem> = {}): PickedMediaItem {
  return {
    id: "abc",
    type: "PHOTO",
    mediaFile: { baseUrl: "https://lh3.googleusercontent.com/x", filename: "IMG_1.jpg" },
    ...overrides,
  };
}

describe("parseDuration", () => {
  it("reads whole and fractional seconds", () => {
    expect(parseDuration("5s", 1)).toBe(5000);
    expect(parseDuration("1.5s", 1)).toBe(1500);
  });
  it("falls back when absent or malformed", () => {
    expect(parseDuration(undefined, 42)).toBe(42);
    expect(parseDuration("5m", 42)).toBe(42);
  });
});

describe("pickerWindowUrl", () => {
  it("appends /autoclose once", () => {
    expect(pickerWindowUrl("https://photos.google.com/picker/s1")).toBe(
      "https://photos.google.com/picker/s1/autoclose",
    );
    expect(pickerWindowUrl("https://photos.google.com/picker/s1/")).toBe(
      "https://photos.google.com/picker/s1/autoclose",
    );
  });
});

describe("mediaDownloadUrl", () => {
  it("asks for the video bytes of a video, the photo bytes otherwise", () => {
    expect(mediaDownloadUrl(item({ type: "VIDEO" }))).toBe(
      "https://lh3.googleusercontent.com/x=dv",
    );
    expect(mediaDownloadUrl(item())).toBe("https://lh3.googleusercontent.com/x=d");
    expect(mediaDownloadUrl(item({ type: undefined }))).toBe(
      "https://lh3.googleusercontent.com/x=d",
    );
  });
});

describe("pickedFileName", () => {
  it("keeps Google's name and invents one when it is missing", () => {
    expect(pickedFileName(item())).toBe("IMG_1.jpg");
    expect(pickedFileName(item({ mediaFile: { baseUrl: "u", filename: " " } }))).toBe(
      "google-photos-abc",
    );
  });
});

describe("libraryAlbumTitle", () => {
  it("names an untitled album and caps the length", () => {
    expect(libraryAlbumTitle("  ")).toBe("PhotoBin");
    expect(libraryAlbumTitle(" Trip ")).toBe("Trip");
    expect(libraryAlbumTitle("x".repeat(600))).toHaveLength(500);
  });
});

describe("chunk", () => {
  it("splits into runs of at most `size`", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe("countCreated", () => {
  it("counts OK and status-less results", () => {
    expect(
      countCreated([
        { status: { code: 0 } },
        {},
        { status: { code: 3 } },
        { status: {} },
      ]),
    ).toBe(3);
  });
});
