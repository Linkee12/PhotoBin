import { clamp } from "../../../utils/geometry";

/** Lifting the fingers with the picture smaller than this closes the viewer. */
export const PINCH_CLOSE_SCALE = 0.8;
/** Lifting above it: the picture springs back to 1x and the backdrop to black this fast. */
export const PINCH_SETTLE_MS = 200;

/**
 * How far a pinch that started at 1x has gone towards closing the viewer:
 * 0 at 1x (and above), 1 at `closeScale` (and below), linear in between. The
 * viewer fades its backdrop and buttons by this much while the fingers are down.
 */
export function closeProgress(scale: number, closeScale = PINCH_CLOSE_SCALE): number {
  return clamp((1 - scale) / (1 - closeScale), 0, 1);
}
