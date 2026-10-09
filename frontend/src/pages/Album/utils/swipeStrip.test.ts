import { describe, expect, it } from "vitest";
import { stripOffset, SWIPE_PX, swipeDecision } from "./swipeStrip";

const both = { canGoPrev: true, canGoNext: true };
const onlyNext = { canGoPrev: false, canGoNext: true };
const onlyPrev = { canGoPrev: true, canGoNext: false };

describe("stripOffset", () => {
  it("follows the finger towards an existing neighbour", () => {
    expect(stripOffset(120, both)).toBe(120);
    expect(stripOffset(-120, both)).toBe(-120);
    expect(stripOffset(-120, onlyNext)).toBe(-120);
    expect(stripOffset(120, onlyPrev)).toBe(120);
  });

  it("resists past an edge without a neighbour", () => {
    expect(stripOffset(120, onlyNext)).toBe(40);
    expect(stripOffset(-120, onlyPrev)).toBe(-40);
  });

  it("is 0 at rest", () => {
    expect(stripOffset(0, both)).toBe(0);
    expect(stripOffset(0, onlyNext)).toBe(0);
  });
});

describe("swipeDecision", () => {
  it("commits to the next photo after a long enough swipe left", () => {
    expect(swipeDecision(-SWIPE_PX, both)).toBe(1);
    expect(swipeDecision(-200, both)).toBe(1);
  });

  it("commits to the previous photo after a long enough swipe right", () => {
    expect(swipeDecision(SWIPE_PX, both)).toBe(-1);
  });

  it("snaps back after a short swipe", () => {
    expect(swipeDecision(-(SWIPE_PX - 1), both)).toBe(0);
    expect(swipeDecision(SWIPE_PX - 1, both)).toBe(0);
    expect(swipeDecision(0, both)).toBe(0);
  });

  it("snaps back when there is no neighbour in that direction", () => {
    expect(swipeDecision(-200, onlyPrev)).toBe(0);
    expect(swipeDecision(200, onlyNext)).toBe(0);
  });
});
