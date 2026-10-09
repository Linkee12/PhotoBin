/**
 * Pure parts of the long-press range selection (`hooks/useLongPressSelect`):
 * which tiles lie between two ids, and how fast the page scrolls when the
 * finger is held near the top or bottom of the viewport.
 */

/** Tiles from `a` to `b` in `order`, both included, whichever comes first; empty when either is missing. */
export function rangeBetween(order: readonly string[], a: string, b: string): string[] {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 || j < 0) return [];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}

type AutoScrollOptions = {
  /** Share of the viewport height, at each end, that scrolls. */
  zone?: number;
  /** Pixels per frame at the very edge. */
  maxPxPerFrame?: number;
};

/**
 * Pixels to scroll this frame for a finger at viewport `y`: negative (up) in
 * the top zone, positive (down) in the bottom zone, growing linearly from
 * nothing at the zone's inner edge to `maxPxPerFrame` at the screen edge.
 */
export function autoScrollSpeed(
  y: number,
  viewportHeight: number,
  { zone = 0.1, maxPxPerFrame = 24 }: AutoScrollOptions = {},
): number {
  const edge = viewportHeight * zone;
  if (edge <= 0) return 0;
  const depth = Math.max(edge - y, y - (viewportHeight - edge)) / edge;
  if (depth <= 0) return 0;
  const direction = y < viewportHeight / 2 ? -1 : 1;
  return direction * Math.min(1, depth) * maxPxPerFrame;
}
