export type Size = { width: number; height: number };

/** `size` scaled down so its longer edge is at most `maxEdge`; unchanged without a cap. */
export function fitWithin(size: Size, maxEdge: number | undefined): Size {
  const longest = Math.max(size.width, size.height);
  if (maxEdge === undefined || longest <= maxEdge) return size;
  return scaled(size, maxEdge / longest);
}

/**
 * The smallest size of `size`'s aspect ratio that covers `box`: the whole
 * frame, nothing cropped, and at least as large as the box in both
 * directions, so a tile can crop it with CSS without losing sharpness. Never
 * enlarges; `maxEdge` caps the longer edge of very long panoramas.
 */
export function coverSize(size: Size, box: Size, maxEdge?: number): Size {
  const scale = Math.min(1, Math.max(box.width / size.width, box.height / size.height));
  return fitWithin(scaled(size, scale), maxEdge);
}

function scaled(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
