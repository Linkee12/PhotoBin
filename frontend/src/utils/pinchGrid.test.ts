import { describe, expect, it } from "vitest";
import {
  clampColumns,
  containRect,
  gridLayout,
  lerpRect,
  pinchStep,
  TILE_ASPECT,
} from "./pinchGrid";

describe("gridLayout", () => {
  it("lays tiles out row by row with gap and tile margin", () => {
    const { rects, height } = gridLayout({
      left: 10,
      top: 100,
      width: 320,
      gap: 20,
      margin: 5,
      columns: 2,
      count: 3,
    });
    // cell = (320 - 20) / 2 = 150; tile fills the cell, 3:2 → 100 tall.
    expect(rects[0]).toEqual({ left: 10, top: 105, width: 150, height: 100 });
    expect(rects[1]).toEqual({ left: 180, top: 105, width: 150, height: 100 });
    // Row pitch = tile height + 2 * margin + gap = 130.
    expect(rects[2]).toEqual({ left: 10, top: 235, width: 150, height: 100 });
    // Two rows: 2 * (100 + 10) + 20.
    expect(height).toBe(240);
  });

  it("has zero height for no tiles", () => {
    const { rects, height } = gridLayout({
      left: 0,
      top: 0,
      width: 300,
      gap: 10,
      margin: 0,
      columns: 3,
      count: 0,
    });
    expect(rects).toEqual([]);
    expect(height).toBe(0);
  });

  it("uses the tile aspect ratio", () => {
    const { rects } = gridLayout({
      left: 0,
      top: 0,
      width: 300,
      gap: 0,
      margin: 0,
      columns: 1,
      count: 1,
    });
    expect(rects[0].height).toBeCloseTo(300 / TILE_ASPECT);
  });
});

describe("pinchStep", () => {
  it("is idle at ratio 1", () => {
    expect(pinchStep(1)).toEqual({ direction: 0, progress: 0 });
  });
  it("pinching out goes to fewer columns, full at 1.5x", () => {
    expect(pinchStep(1.25)).toEqual({ direction: -1, progress: 0.5 });
    expect(pinchStep(1.5)).toEqual({ direction: -1, progress: 1 });
    expect(pinchStep(3)).toEqual({ direction: -1, progress: 1 });
  });
  it("pinching in goes to more columns, full at 2/3", () => {
    const half = pinchStep(1 - 1 / 6);
    expect(half.direction).toBe(1);
    expect(half.progress).toBeCloseTo(0.5);
    expect(pinchStep(2 / 3).progress).toBeCloseTo(1);
    expect(pinchStep(0.1)).toEqual({ direction: 1, progress: 1 });
  });
});

describe("clampColumns", () => {
  it("allows at least one column and at most what fits the minimum tile", () => {
    // (620 + 20) / (120 + 20) = 4.57 → 4
    expect(clampColumns(9, { width: 620, gap: 20 })).toBe(4);
    expect(clampColumns(0, { width: 620, gap: 20 })).toBe(1);
    expect(clampColumns(3, { width: 620, gap: 20 })).toBe(3);
  });
  it("never goes below one column on a tiny container", () => {
    expect(clampColumns(2, { width: 50, gap: 20 })).toBe(1);
  });
});

describe("containRect", () => {
  it("fits a landscape picture to the viewport width, centred", () => {
    expect(containRect({ width: 400, height: 200 }, { width: 200, height: 200 })).toEqual(
      {
        left: 0,
        top: 50,
        width: 200,
        height: 100,
      },
    );
  });
  it("fits a portrait picture to the viewport height, centred", () => {
    expect(containRect({ width: 100, height: 400 }, { width: 200, height: 200 })).toEqual(
      {
        left: 75,
        top: 0,
        width: 50,
        height: 200,
      },
    );
  });
});

describe("lerpRect", () => {
  it("interpolates every edge", () => {
    const a = { left: 0, top: 0, width: 100, height: 100 };
    const b = { left: 100, top: 50, width: 200, height: 300 };
    expect(lerpRect(a, b, 0.5)).toEqual({ left: 50, top: 25, width: 150, height: 200 });
  });
});
