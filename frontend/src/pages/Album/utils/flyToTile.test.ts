import { describe, expect, it } from "vitest";
import { shownPicture } from "./flyToTile";

const SCREEN = { left: 0, top: 0, width: 400, height: 800 };

describe("shownPicture", () => {
  it("is the contained frame of the photo, centred in the image box", () => {
    expect(shownPicture(SCREEN, { width: 3000, height: 2000 }, 0)).toEqual({
      left: 0,
      top: 400 - 400 / 3,
      width: 400,
      height: 800 / 3,
    });
  });

  it("follows a zoomed (larger, shifted) image box", () => {
    const zoomed = { left: -200, top: -400, width: 800, height: 1600 };
    expect(shownPicture(zoomed, { width: 1000, height: 2000 }, 0)).toEqual({
      left: -200,
      top: -400,
      width: 800,
      height: 1600,
    });
  });

  it("gives the unrotated frame of a quarter-turned photo, around the same centre", () => {
    // The element (the whole screen, 400×800) turned a quarter: its bounds are 800×400.
    const turnedBox = { left: -200, top: 200, width: 800, height: 400 };
    expect(shownPicture(turnedBox, { width: 3000, height: 2000 }, 1)).toEqual({
      left: 0,
      top: 400 - 400 / 3,
      width: 400,
      height: 800 / 3,
    });
  });
});
