import type { CSS } from "@stitches/react";

import { ACCENT_COLOR } from "./theme";

const reducedMotion = "@media (prefers-reduced-motion: reduce)";

/**
 * Feedback every clickable element shares: a pointer cursor, smooth colour
 * changes, a press-down while active, a visible keyboard focus ring and a
 * muted disabled state. `pressableNoScale` has no press-down scale, for
 * elements that must not shrink; it still transitions `transform`, so an
 * element whose transform is written every frame (a grid tile under a pinch)
 * must override `transition` as well.
 */
export const pressableNoScale: CSS = {
  cursor: "pointer",
  transition:
    "transform 0.12s ease, opacity 0.15s ease, background-color 0.15s ease, " +
    "color 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  "-webkit-tap-highlight-color": "transparent",
  "&:focus-visible": { outline: `2px solid ${ACCENT_COLOR}`, outlineOffset: "2px" },
  "&:disabled, &[aria-disabled='true']": { cursor: "default", opacity: 0.45 },
  [reducedMotion]: { transition: "none" },
};

export const pressable: CSS = {
  ...pressableNoScale,
  "&:active:not(:disabled)": { transform: "scale(0.94)" },
  [reducedMotion]: {
    transition: "none",
    "&:active:not(:disabled)": { transform: "none" },
  },
};

/** Press feedback for elements that must keep their transform: a brief dim. */
export const pressDim: CSS = {
  "&:active": { filter: "brightness(0.8)" },
};
