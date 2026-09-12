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
/**
 * From this width on, the album toolbar (HISTORY/DATE, DOWNLOAD ALL, ADD PHOTO)
 * is a shelf sharing its row with the first group's header, which gets the
 * left third of it. Below this width the toolbar is the bottom sheet of the
 * phone layout, whatever the orientation: the header and the buttons are never
 * stacked on separate rows.
 */
export const TOOLBAR_INLINE_MIN_WIDTH_PX = 1280;
export const TOOLBAR_INLINE_QUERY = `(min-width: ${TOOLBAR_INLINE_MIN_WIDTH_PX}px)`;

export const { styled, keyframes } = createStitches({
  media: {
    narrow: `(max-width: ${NARROW_MAX_WIDTH_PX}px) and (orientation: portrait)`,
    wide: `(min-width: ${NARROW_MAX_WIDTH_PX + 1}px), (orientation: landscape)`,
    toolbarInline: TOOLBAR_INLINE_QUERY,
    toolbarStacked: `(max-width: ${TOOLBAR_INLINE_MIN_WIDTH_PX - 1}px)`,
  },
});
