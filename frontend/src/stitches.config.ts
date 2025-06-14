import { createStitches } from "@stitches/react";

export const { styled } = createStitches({
  media: {
    portrait: "(orientation: portrait)",
    landscape: "(orientation: landscape)",
  },
});
