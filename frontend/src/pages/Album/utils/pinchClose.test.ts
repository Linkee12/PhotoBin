import { describe, expect, it } from "vitest";
import { closeProgress, PINCH_CLOSE_SCALE } from "./pinchClose";

describe("closeProgress", () => {
  it("is 0 at 1x and above", () => {
    expect(closeProgress(1)).toBe(0);
    expect(closeProgress(1.5)).toBe(0);
  });

  it("is 1 at the close scale and below", () => {
    expect(closeProgress(PINCH_CLOSE_SCALE)).toBe(1);
    expect(closeProgress(0.4)).toBe(1);
  });

  it("is linear in between", () => {
    expect(closeProgress(0.9)).toBeCloseTo(0.5);
    expect(closeProgress(0.95, 0.9)).toBeCloseTo(0.5);
  });
});
