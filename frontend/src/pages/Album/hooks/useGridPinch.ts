import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  clampColumns,
  containRect,
  gridLayout,
  lerpRect,
  pinchStep,
  Rect,
  TILE_ASPECT,
} from "../../../utils/pinchGrid";

/** Progress a pinch must reach when the fingers lift for the step to commit. */
const COMMIT_PROGRESS = 0.5;
const COMMIT_MS = 150;
const SNAP_BACK_MS = 200;
/** Tiles drawn further than this many viewport heights off screen are not transformed. */
const ANIMATED_SCREENS = 1;
/** Above the tiles and below the anchored tile while it grows to full screen. */
const OVERLAY_Z_INDEX = 5;

type Point = { x: number; y: number };
type Direction = -1 | 1;

type TileState = {
  el: HTMLElement;
  id: string;
  /** Layout rect (document coordinates), where the tile sits without a transform. */
  current: Rect;
};

type SectionState = {
  images: HTMLElement;
  current: Rect;
  tiles: TileState[];
};

/** Everything measured when the second finger lands; fixed for the gesture. */
type Gesture = {
  startDistance: number;
  columns: number;
  minColumns: number;
  maxColumns: number;
  gap: number;
  scrollY: number;
  viewport: { width: number; height: number };
  sections: SectionState[];
  /** The tile under the fingers, whose centre stays put while the grid reflows. */
  anchor: TileState;
  /** Target layouts, computed on first use per direction. */
  targets: Map<Direction, Target>;
  direction: Direction | 0;
  progress: number;
};

type Target =
  | {
      kind: "columns";
      columns: number;
      /** Per section: its grid height and each tile's rect at the new column count. */
      heights: number[];
      rects: Rect[][];
    }
  | { kind: "fullscreen"; rect: Rect };

type Options = {
  enabled: boolean;
  /** Current column count; `null` while the CSS auto layout is still in charge. */
  columns: number | null;
  /** `scrollTop` keeps the anchored tile where the gesture left it once the grid is relaid. */
  onCommit: (columns: number, scrollTop: number) => void;
  onOpen: (fileId: string) => void;
};

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function documentRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    width: r.width,
    height: r.height,
  };
}

function center(r: Rect): Point {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function contains(r: Rect, p: Point) {
  return (
    p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height
  );
}

/**
 * Column count of the CSS auto layout: the resolved track list of a grid
 * (`"240px 240px 240px"`), or one for the single column flex layout.
 */
function measuredColumns(images: HTMLElement): number {
  const style = getComputedStyle(images);
  if (style.display !== "grid") return 1;
  const tracks = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, tracks.length);
}

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Two-finger pinch over the album grid steps the column count one at a time:
 * pinching in adds a column, pinching out removes one, and pinching out at a
 * single column opens the photo under the fingers full screen. While the
 * fingers move, every tile near the viewport is drawn (with a transform) part
 * of the way between its place in the current layout and its place in the
 * next, anchored on the tile under the fingers; each section's grid height
 * follows so the sections below slide along. Lifting the fingers past half
 * way commits the step, otherwise the tiles slide back.
 *
 * Attach `handlers` and `ref` to the element containing every section, mark
 * each section's grid with `data-images` and each tile with `data-tile=<id>`,
 * and render the `overlayRef` element (fixed, full screen) inside the same
 * element for the full screen step.
 */
export function useGridPinch(options: Options) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pointers = useRef(new Map<number, Point>());
  /** A pinch just happened: the click the lifting fingers produce must not open a tile. */
  const swallowClick = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const settle = useRef<number | null>(null);

  /** Draws the gesture at its current direction and progress. */
  const paint = useCallback(() => {
    frame.current = null;
    const g = gesture.current;
    if (!g) return;
    const target = g.direction === 0 ? null : targetFor(g, g.direction);
    const overlay = overlayRef.current;
    if (target?.kind === "fullscreen") {
      if (overlay) overlay.style.opacity = String(g.progress);
      paintFullscreen(g, target, g.progress);
    } else {
      if (overlay) overlay.style.opacity = "0";
      paintColumns(g, target, target === null ? 0 : g.progress);
    }
  }, []);

  const schedulePaint = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

  const clear = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (settle.current !== null) cancelAnimationFrame(settle.current);
    settle.current = null;
    if (overlayRef.current) overlayRef.current.style.opacity = "0";
    if (!g) return;
    for (const section of g.sections) {
      section.images.style.height = "";
      for (const tile of section.tiles) {
        tile.el.style.transform = "";
        tile.el.style.zIndex = "";
      }
    }
  }, []);

  /** Animates `progress` to `to`, then runs `done`. */
  const animateTo = useCallback(
    (to: number, ms: number, done: () => void) => {
      const g = gesture.current;
      if (!g) return;
      if (reduceMotion() || ms === 0) {
        g.progress = to;
        paint();
        done();
        return;
      }
      const from = g.progress;
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / ms);
        const eased = 1 - (1 - t) * (1 - t);
        g.progress = from + (to - from) * eased;
        paint();
        if (t < 1) settle.current = requestAnimationFrame(tick);
        else {
          settle.current = null;
          done();
        }
      };
      settle.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const clearAfterSettle = useCallback(() => {
    settle.current = null;
    clear();
  }, [clear]);

  const finish = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    const target = g.direction === 0 ? null : targetFor(g, g.direction);
    if (target === null || g.progress < COMMIT_PROGRESS) {
      animateTo(0, SNAP_BACK_MS, clear);
      return;
    }
    animateTo(1, COMMIT_MS, () => {
      if (target.kind === "fullscreen") {
        // Keep the grown tile and the dark overlay on screen until the modal
        // (opaque, above both) has painted, so the handoff does not blink.
        optionsRef.current.onOpen(g.anchor.id);
        settle.current = requestAnimationFrame(() => {
          settle.current = requestAnimationFrame(clearAfterSettle);
        });
        return;
      }
      // After the real relayout the anchored tile sits at its target rect;
      // scroll so it stays where the gesture left it (centred where it was).
      const scrollTop = g.scrollY + anchorScrollDelta(g, target);
      clear();
      optionsRef.current.onCommit(target.columns, scrollTop);
    });
  }, [animateTo, clear, clearAfterSettle]);

  const begin = useCallback((a: Point, b: Point) => {
    const container = containerRef.current;
    if (!container) return;
    const scrollY = window.scrollY;
    const mid = { x: (a.x + b.x) / 2 + window.scrollX, y: (a.y + b.y) / 2 + scrollY };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const sections: SectionState[] = [];
    let gap = 0;
    let anchor: TileState | null = null;
    for (const images of container.querySelectorAll<HTMLElement>("[data-images]")) {
      const tiles: TileState[] = [];
      for (const el of images.querySelectorAll<HTMLElement>("[data-tile]")) {
        const current = documentRect(el);
        const tile: TileState = { el, id: el.dataset.tile ?? "", current };
        if (anchor === null && contains(current, mid)) anchor = tile;
        tiles.push(tile);
      }
      if (tiles.length > 0) gap = parseFloat(getComputedStyle(images).rowGap) || 0;
      sections.push({ images, current: documentRect(images), tiles });
    }
    const first = sections.find((s) => s.tiles.length > 0);
    if (!first) return;
    // Without a tile under the fingers, anchor on the nearest one on screen.
    if (anchor === null) anchor = nearestTile(sections, mid);
    if (anchor === null) return;

    const width = first.current.width;
    const columns = optionsRef.current.columns ?? measuredColumns(first.images);
    const maxColumns = clampColumns(Infinity, { width, gap });
    gesture.current = {
      startDistance: distance(a, b),
      columns,
      minColumns: 1,
      maxColumns,
      gap,
      scrollY,
      viewport,
      sections,
      anchor,
      targets: new Map(),
      direction: 0,
      progress: 0,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!optionsRef.current.enabled || e.pointerType !== "touch") return;
      // A new touch: the pinch's click, if any, has been and gone.
      if (pointers.current.size === 0) swallowClick.current = false;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (
        pointers.current.size === 2 &&
        gesture.current === null &&
        settle.current === null
      ) {
        const [a, b] = [...pointers.current.values()];
        begin(a, b);
        swallowClick.current = gesture.current !== null;
      }
    },
    [begin],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g || pointers.current.size < 2 || settle.current !== null) return;
      const [a, b] = [...pointers.current.values()];
      const step = pinchStep(distance(a, b) / g.startDistance);
      g.direction = step.direction;
      g.progress = step.progress;
      schedulePaint();
    },
    [schedulePaint],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      if (!g || settle.current !== null) return;
      if (e.type === "pointercancel") {
        g.progress = 0;
        animateTo(0, SNAP_BACK_MS, clear);
        return;
      }
      // The step is decided when the first of the two fingers lifts.
      finish();
    },
    [animateTo, clear, finish],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  useEffect(() => clear, [clear]);

  return {
    ref: containerRef,
    overlayRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}

/** The anchored tile grows towards the full screen rect; nothing else moves. */
function paintFullscreen(
  g: Gesture,
  target: Extract<Target, { kind: "fullscreen" }>,
  p: number,
) {
  for (const section of g.sections) {
    section.images.style.height = "";
    for (const tile of section.tiles) {
      if (tile !== g.anchor) tile.el.style.transform = "";
    }
  }
  const anchor = g.anchor;
  const goal = { ...target.rect, top: target.rect.top + g.scrollY };
  applyRect(anchor, lerpRect(anchor.current, goal, p));
  anchor.el.style.zIndex = String(OVERLAY_Z_INDEX + 1);
  window.scrollTo({ top: g.scrollY, behavior: "auto" });
}

/**
 * Every tile is drawn `p` of the way to its place at the target column count
 * and each grid's height follows, so later sections slide along. The page is
 * scrolled so the anchored tile's centre stays put — that moves the bands
 * with the tiles, which a transform on the tiles alone would not. Tiles that
 * end up far off screen are left untransformed. A `null` target restores the
 * plain layout.
 */
function paintColumns(
  g: Gesture,
  target: Extract<Target, { kind: "columns" }> | null,
  p: number,
) {
  g.anchor.el.style.zIndex = "";
  if (target === null) {
    for (const section of g.sections) {
      section.images.style.height = "";
      for (const tile of section.tiles) tile.el.style.transform = "";
    }
    window.scrollTo({ top: g.scrollY, behavior: "auto" });
    return;
  }
  const scrollTop = g.scrollY + anchorScrollDelta(g, target) * p;
  const near = {
    left: 0,
    top: scrollTop - g.viewport.height * ANIMATED_SCREENS,
    width: g.viewport.width,
    height: g.viewport.height * (1 + 2 * ANIMATED_SCREENS),
  };
  // Animating a grid's height moves every section below it, and with them the
  // layout positions the tiles' transforms are measured from.
  let drift = 0;
  g.sections.forEach((section, s) => {
    const delta = (target.heights[s] - section.current.height) * p;
    section.images.style.height = `${section.current.height + delta}px`;
    section.tiles.forEach((tile, t) => {
      const rect = lerpRect(tile.current, target.rects[s][t], p);
      if (overlaps(rect, near)) applyRect(tile, rect, drift);
      else if (tile.el.style.transform !== "") tile.el.style.transform = "";
    });
    drift += delta;
  });
  window.scrollTo({ top: scrollTop, behavior: "auto" });
}

/** How far the page must scroll for the anchored tile's centre to stay put at `target`. */
function anchorScrollDelta(g: Gesture, target: Extract<Target, { kind: "columns" }>) {
  return center(anchorRect(g, target)).y - center(g.anchor.current).y;
}

function overlaps(a: Rect, b: Rect) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function nearestTile(sections: SectionState[], point: Point): TileState | null {
  let best: TileState | null = null;
  let bestDistance = Infinity;
  for (const section of sections) {
    for (const tile of section.tiles) {
      const d = distance(center(tile.current), point);
      if (d < bestDistance) {
        bestDistance = d;
        best = tile;
      }
    }
  }
  return best;
}

/** The target layout one step in `direction`, or `null` when the ladder ends there. */
function targetFor(g: Gesture, direction: Direction): Target | null {
  const cached = g.targets.get(direction);
  if (cached) return cached;
  const columns = g.columns + direction;
  let target: Target;
  if (columns < g.minColumns) {
    // Pinching out at one column: the anchored tile grows to full screen.
    const box = containRect({ width: TILE_ASPECT, height: 1 }, g.viewport);
    target = { kind: "fullscreen", rect: box };
  } else if (columns > g.maxColumns) {
    return null;
  } else {
    const heights: number[] = [];
    const rects: Rect[][] = [];
    // A section's grid starts where the sections above it end, so a change in
    // their heights moves it down (or up) by that much.
    let drift = 0;
    for (const section of g.sections) {
      const layout = gridLayout({
        left: section.current.left,
        top: section.current.top + drift,
        width: section.current.width,
        gap: g.gap,
        // The explicit layout has no tile margin (see `Images`' `explicit` variant).
        margin: 0,
        columns,
        count: section.tiles.length,
      });
      heights.push(layout.height);
      rects.push(layout.rects);
      drift += layout.height - section.current.height;
    }
    target = { kind: "columns", columns, heights, rects };
  }
  g.targets.set(direction, target);
  return target;
}

/** Where the anchored tile lands in a column `target` (before the anchoring shift). */
function anchorRect(g: Gesture, target: Extract<Target, { kind: "columns" }>): Rect {
  for (let s = 0; s < g.sections.length; s++) {
    const t = g.sections[s].tiles.indexOf(g.anchor);
    if (t >= 0) return target.rects[s][t];
  }
  return g.anchor.current;
}

/**
 * Draws `tile` at `rect` (document coordinates) with a transform from its
 * layout position, which sits `drift` below where it was measured.
 */
function applyRect(tile: TileState, rect: Rect, drift = 0) {
  const { current } = tile;
  const scaleX = rect.width / current.width;
  const scaleY = rect.height / current.height;
  const dx = rect.left - current.left;
  const dy = rect.top - (current.top + drift);
  tile.el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
}
