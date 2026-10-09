import { describe, expect, it } from "vitest";
import { autoScrollSpeed, rangeBetween } from "./rangeSelect";

const order = ["a", "b", "c", "d", "e"];

describe("rangeBetween", () => {
  it("is inclusive in tile order, forwards", () => {
    expect(rangeBetween(order, "b", "d")).toEqual(["b", "c", "d"]);
  });

  it("is the same range backwards", () => {
    expect(rangeBetween(order, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("is just the tile when both ends are the same", () => {
    expect(rangeBetween(order, "c", "c")).toEqual(["c"]);
  });

  it("is empty when either end is not a tile", () => {
    expect(rangeBetween(order, "a", "zz")).toEqual([]);
    expect(rangeBetween(order, "zz", "a")).toEqual([]);
    expect(rangeBetween([], "a", "a")).toEqual([]);
  });
});

describe("autoScrollSpeed", () => {
  const height = 1000;

  it("scrolls up at full speed at the top edge", () => {
    expect(autoScrollSpeed(0, height)).toBe(-24);
  });

  it("scrolls up at half speed half way into the top zone", () => {
    expect(autoScrollSpeed(50, height)).toBe(-12);
  });

  it("does not scroll outside the zones", () => {
    expect(autoScrollSpeed(100, height)).toBe(0);
    expect(autoScrollSpeed(500, height)).toBe(0);
    expect(autoScrollSpeed(900, height)).toBe(0);
  });

  it("scrolls down at full speed at the bottom edge", () => {
    expect(autoScrollSpeed(1000, height)).toBe(24);
    expect(autoScrollSpeed(950, height)).toBe(12);
  });

  it("never exceeds the maximum past the edges", () => {
    expect(autoScrollSpeed(-40, height)).toBe(-24);
    expect(autoScrollSpeed(1040, height)).toBe(24);
  });

  it("takes its zone and speed from the options", () => {
    expect(autoScrollSpeed(0, height, { zone: 0.2, maxPxPerFrame: 10 })).toBe(-10);
    expect(autoScrollSpeed(100, height, { zone: 0.2, maxPxPerFrame: 10 })).toBe(-5);
    expect(autoScrollSpeed(150, height, { zone: 0.1, maxPxPerFrame: 10 })).toBe(0);
  });
});
