/** Horizontal drag at 1x, in px, that counts as a swipe to the next / previous photo. */
export const SWIPE_PX = 60;
/** How long the strip takes to arrive at the neighbour (or back) once the finger lifts. */
export const SWIPE_ANIMATION_MS = 200;
/** Past an edge with no neighbour the strip follows the finger this much slower. */
const EDGE_RESISTANCE = 3;

export type SwipeEdges = { canGoPrev: boolean; canGoNext: boolean };

/**
 * Where the swipe strip (current picture flanked by its neighbours) sits for a
 * finger that travelled `dx` px: it follows the finger towards a neighbour and
 * rubber-bands past an edge that has none.
 */
export function stripOffset(dx: number, { canGoPrev, canGoNext }: SwipeEdges): number {
  const towardsNeighbour = dx > 0 ? canGoPrev : canGoNext;
  return towardsNeighbour ? dx : dx / EDGE_RESISTANCE;
}

/**
 * What lifting the finger after `dx` px does: `1` goes to the next photo (swipe
 * left), `-1` to the previous one, `0` snaps back — a short swipe, or one towards
 * an edge without a neighbour.
 */
export function swipeDecision(
  dx: number,
  { canGoPrev, canGoNext }: SwipeEdges,
): -1 | 0 | 1 {
  if (dx <= -SWIPE_PX && canGoNext) return 1;
  if (dx >= SWIPE_PX && canGoPrev) return -1;
  return 0;
}
