import { createStitches } from "@stitches/react";

/**
 * Layout breakpoints.
 *
 * `narrow` is the phone-in-portrait layout: single column, bottom-sheet menu.
 * `wide` is everything else: desktops of any orientation (including tall /
 * rotated monitors) and phones held in landscape.
 *
 * The two queries are complementary, so exactly one of them matches at any
 * viewport. Orientation alone is not enough because a tall desktop monitor
 * also reports `(orientation: portrait)`.
 */
export const NARROW_MAX_WIDTH_PX = 699;

export const { styled, keyframes } = createStitches({
  media: {
    narrow: `(max-width: ${NARROW_MAX_WIDTH_PX}px) and (orientation: portrait)`,
    wide: `(min-width: ${NARROW_MAX_WIDTH_PX + 1}px), (orientation: landscape)`,
  },
});
