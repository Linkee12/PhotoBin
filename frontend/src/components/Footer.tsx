import { styled } from "../stitches.config";

/** The footer's height; the page reserves it as bottom padding so the footer never covers content. */
export const FOOTER_HEIGHT = "4rem";

/**
 * Sits at the very bottom of a `position: relative` page, even when the page
 * is shorter than the viewport. Children are centred.
 */
export const Footer = styled("footer", {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: FOOTER_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
});
