/**
 * Pure geometry behind the pinch-to-resize gesture of the album grid: where
 * every tile would sit at another column count, how far a pinch has
 * progressed towards that step, and the bounds of the column ladder.
 */

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Width / height of every tile (`AlbumItem`'s `aspectRatio: 3/2`). */
export const TILE_ASPECT = 3 / 2;
/** Narrowest tile the ladder may go down to; bounds the column count. */
export const MIN_TILE_PX = 120;
/** Pinch ratio at which a pinch-out reaches the next step (fewer columns). */
const PINCH_OUT_FULL = 1.5;
/** Pinch ratio at which a pinch-in reaches the next step (more columns). */
const PINCH_IN_FULL = 2 / 3;

type GridLayoutInput = {
  /** Left edge and top of the grid's content box (any coordinate space). */
  left: number;
  top: number;
  /** Width of the grid's content box. */
  width: number;
  /** Gap between grid cells (rows and columns alike). */
  gap: number;
  /** Margin of each tile inside its cell; it adds to the row height. */
  margin: number;
  columns: number;
  count: number;
};

/**
 * Positions of `count` tiles in a `repeat(columns, 1fr)` grid whose tiles fill
 * their cell horizontally and keep `TILE_ASPECT`, plus the grid's height.
 */
export function gridLayout(input: GridLayoutInput): { rects: Rect[]; height: number } {
  const { left, top, width, gap, margin, columns, count } = input;
  const cell = (width - (columns - 1) * gap) / columns;
  const tileHeight = cell / TILE_ASPECT;
  const rowPitch = tileHeight + 2 * margin + gap;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const column = i % columns;
    rects.push({
      left: left + column * (cell + gap),
      top: top + margin + row * rowPitch,
      width: cell,
      height: tileHeight,
    });
  }
  const rows = Math.ceil(count / columns);
  const height = rows === 0 ? 0 : rows * rowPitch - gap;
  return { rects, height };
}

/**
 * How far a pinch of `ratio` (current finger distance / distance at start) has
 * moved towards the next step: `direction` -1 wants fewer columns (bigger
 * tiles, pinch out), +1 wants more (pinch in), 0 is no movement.
 */
export function pinchStep(ratio: number): { direction: -1 | 0 | 1; progress: number } {
  if (ratio > 1) {
    return { direction: -1, progress: Math.min(1, (ratio - 1) / (PINCH_OUT_FULL - 1)) };
  }
  if (ratio < 1) {
    return { direction: 1, progress: Math.min(1, (1 - ratio) / (1 - PINCH_IN_FULL)) };
  }
  return { direction: 0, progress: 0 };
}

/** Keeps `columns` between one and as many `MIN_TILE_PX` tiles as fit `width`. */
export function clampColumns(columns: number, grid: { width: number; gap: number }) {
  const max = Math.max(1, Math.floor((grid.width + grid.gap) / (MIN_TILE_PX + grid.gap)));
  return Math.min(max, Math.max(1, columns));
}

/** The rect of `picture` drawn `object-fit: contain` and centred in `box`. */
export function containRect(picture: Size, box: Size): Rect {
  const scale = Math.min(box.width / picture.width, box.height / picture.height);
  const width = picture.width * scale;
  const height = picture.height * scale;
  return {
    left: (box.width - width) / 2,
    top: (box.height - height) / 2,
    width,
    height,
  };
}

export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    left: from.left + (to.left - from.left) * t,
    top: from.top + (to.top - from.top) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}
