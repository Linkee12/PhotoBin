import { describe, expect, it } from "vitest";
import { coverSize, fitWithin } from "./imageSize";

const TILE = { width: 300, height: 200 };

describe("coverSize", () => {
  it("keeps a 3:2 photo at the tile size", () => {
    expect(coverSize({ width: 6000, height: 4000 }, TILE)).toEqual(TILE);
  });

  it("keeps the whole frame of a portrait photo, at least as large as the tile", () => {
    expect(coverSize({ width: 3000, height: 4000 }, TILE)).toEqual({
      width: 300,
      height: 400,
    });
  });

  it("keeps the whole frame of a wide photo", () => {
    expect(coverSize({ width: 4000, height: 1000 }, TILE)).toEqual({
      width: 800,
      height: 200,
    });
  });

  it("caps the longer edge of a panorama", () => {
    expect(coverSize({ width: 20000, height: 1000 }, TILE, 900)).toEqual({
      width: 900,
      height: 45,
    });
  });

  it("never enlarges a small image", () => {
    expect(coverSize({ width: 120, height: 90 }, TILE)).toEqual({
      width: 120,
      height: 90,
    });
  });
});

describe("fitWithin", () => {
  it("caps the longer edge, keeping the aspect ratio", () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 2560)).toEqual({
      width: 2560,
      height: 1920,
    });
  });

  it("leaves a small image and a missing cap alone", () => {
    expect(fitWithin({ width: 800, height: 600 }, 2560)).toEqual({
      width: 800,
      height: 600,
    });
    expect(fitWithin({ width: 8000, height: 6000 }, undefined)).toEqual({
      width: 8000,
      height: 6000,
    });
  });
});
