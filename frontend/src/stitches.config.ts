import { createStitches } from "@stitches/react";

export const { styled, keyframes } = createStitches({
  media: {
    portrait: "(orientation: portrait)",
    landscape: "(orientation: landscape)",
  },
});
