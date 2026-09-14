import { styled } from "../stitches.config";

/** A turning ring (the `spin` keyframes are global, see `App.tsx`); `color` sets the bright arc. */
export const Spinner = styled("div", {
  width: "3rem",
  height: "3rem",
  color: "#DBDCD9",
  border: "5px solid rgba(255, 255, 255, 0.2)",
  borderTopColor: "currentColor",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});
