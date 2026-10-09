import { keyframes, styled } from "../stitches.config";

const sweep = keyframes({
  "0%": { backgroundPosition: "100% 0" },
  "100%": { backgroundPosition: "-100% 0" },
});

/**
 * A slow light sweep over `base`, for a box whose content is still loading.
 * Spread it into a style; `prefers-reduced-motion` keeps it still.
 */
export function shimmer(base: string) {
  return {
    backgroundColor: base,
    backgroundImage:
      "linear-gradient(90deg, transparent 25%, rgba(255, 255, 255, 0.07) 50%, transparent 75%)",
    backgroundSize: "200% 100%",
    animation: `${sweep} 1.6s ease-in-out infinite`,
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
  };
}

/**
 * Stands in for text that is not known yet. Put a likely text inside: it
 * keeps the real line box (font, size, wrapping), so nothing moves when the
 * real text replaces it, but it shows only a shimmering bar.
 */
export const TextSkeleton = styled("span", {
  ...shimmer("rgba(255, 255, 255, 0.08)"),
  color: "transparent",
  borderRadius: "0.3em",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
  userSelect: "none",
});
