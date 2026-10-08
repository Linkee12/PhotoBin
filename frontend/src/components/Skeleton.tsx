import { keyframes, styled } from "../stitches.config";

const shimmer = keyframes({
  "0%": { backgroundPosition: "100% 0" },
  "100%": { backgroundPosition: "-100% 0" },
});

/**
 * A placeholder block with a slow light sweep, for content that is loading.
 * Size it like what it stands for; `prefers-reduced-motion` keeps it still.
 */
export const Skeleton = styled("div", {
  borderRadius: "0.5rem",
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.06) 75%)",
  backgroundSize: "200% 100%",
  animation: `${shimmer} 1.6s ease-in-out infinite`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});
