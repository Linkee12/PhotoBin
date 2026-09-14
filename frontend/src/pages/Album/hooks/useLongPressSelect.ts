import {
  MouseEvent as ReactMouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { autoScrollSpeed, rangeBetween } from "../utils/rangeSelect";
import { distance, Point } from "../../../utils/geometry";

/** How long a still finger must rest on a tile before it selects it. */
const LONG_PRESS_MS = 450;
/** A finger drifting further than this before the press fires is a scroll, not a press. */
const MOVE_TOLERANCE_PX = 8;
const VIBRATE_MS = 10;

type Options = {
  /** The element containing every `[data-tile]`; the gesture is delegated to it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Every tile in grid order, so a range is "from the anchor to the finger". */
  tileIds: readonly string[];
  enabled: boolean;
  isSelected: (id: string) => boolean;
  onSelect: (ids: string[]) => void;
  onDeselect: (ids: string[]) => void;
  /** The press ended: the click its release produces must not open or toggle the tile. */
  swallowNextClick: () => void;
};

type Press = {
  pointerId: number;
  /** The tile pressed; one end of the range for the whole gesture. */
  anchor: string;
  start: Point;
  last: Point;
  /** Pending until the timer fires; `null` afterwards. */
  timer: number | null;
  fired: boolean;
  /** Tiles the gesture currently has in its range (in tile order). */
  range: string[];
  /** Tiles that were already selected when the range reached them: they stay selected when it leaves. */
  kept: Set<string>;
};

/**
 * Long press on a tile selects it (entering selection mode); keeping the
 * finger down and dragging then selects every tile between the pressed one
 * and the one under the finger, in grid order, recomputed on every move —
 * tiles the range leaves are deselected again unless they were selected
 * before. A finger held near the top or bottom of the viewport scrolls the
 * page in that direction, faster the closer to the edge, and the range
 * follows the tile that scrolls under the still finger.
 *
 * Touch pointers only (mouse users have the hover checkbox); a second finger
 * cancels the press so the pinch gesture wins. The click after the release
 * goes to `swallowNextClick` (`useSwallowNextClick`); `onContextMenu` keeps
 * the browser's long-press menu away while a press is on — put it on the
 * container.
 */
export function useLongPressSelect(options: Options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const press = useRef<Press | null>(null);

  useEffect(() => {
    const container = options.containerRef.current;
    if (!options.enabled || !container) return;
    let frame: number | null = null;

    const cancel = () => {
      const p = press.current;
      press.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (!p) return;
      if (p.timer !== null) clearTimeout(p.timer);
      if (container.hasPointerCapture(p.pointerId)) {
        container.releasePointerCapture(p.pointerId);
      }
    };

    /** Extends or shrinks the range to the tile under the finger. */
    const follow = () => {
      const p = press.current;
      if (!p?.fired) return;
      const target = document
        .elementFromPoint(p.last.x, p.last.y)
        ?.closest<HTMLElement>("[data-tile]")?.dataset.tile;
      if (target === undefined) return;
      const { tileIds, isSelected, onSelect, onDeselect } = optionsRef.current;
      const next = rangeBetween(tileIds, p.anchor, target);
      if (next.length === 0) return;
      const nextSet = new Set(next);
      const rangeSet = new Set(p.range);
      const left = p.range.filter((id) => !nextSet.has(id) && !p.kept.has(id));
      const entered = next.filter((id) => !rangeSet.has(id));
      for (const id of entered) if (isSelected(id)) p.kept.add(id);
      p.range = next;
      if (left.length > 0) onDeselect(left);
      if (entered.length > 0) onSelect(entered);
    };

    const tick = () => {
      frame = null;
      const p = press.current;
      if (!p?.fired) return;
      const speed = autoScrollSpeed(p.last.y, window.innerHeight);
      if (speed !== 0) {
        window.scrollBy(0, speed);
        follow();
      }
      frame = requestAnimationFrame(tick);
    };

    const fire = () => {
      const p = press.current;
      if (!p) return;
      p.timer = null;
      p.fired = true;
      navigator.vibrate?.(VIBRATE_MS);
      // From here on the container gets every move and the release, wherever
      // the finger goes.
      container.setPointerCapture(p.pointerId);
      if (optionsRef.current.isSelected(p.anchor)) p.kept.add(p.anchor);
      p.range = [p.anchor];
      optionsRef.current.onSelect([p.anchor]);
      frame = requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (press.current) {
        // A second finger: the pinch takes over; what is selected stays.
        cancel();
        return;
      }
      if (!e.isPrimary) return;
      const anchor = (e.target as Element | null)?.closest<HTMLElement>("[data-tile]")
        ?.dataset.tile;
      if (anchor === undefined) return;
      const start = { x: e.clientX, y: e.clientY };
      press.current = {
        pointerId: e.pointerId,
        anchor,
        start,
        last: start,
        timer: window.setTimeout(fire, LONG_PRESS_MS),
        fired: false,
        range: [],
        kept: new Set(),
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      p.last = { x: e.clientX, y: e.clientY };
      if (p.fired) follow();
      else if (distance(p.start, p.last) > MOVE_TOLERANCE_PX) cancel();
    };

    const onPointerEnd = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.fired) optionsRef.current.swallowNextClick();
      cancel();
    };

    // The container allows vertical panning (the page scrolls under one
    // finger). Once the press has fired the finger is dragging the range, so
    // the browser must not turn its movement into a scroll — which only a
    // cancelable touchmove can veto; a pointer event cannot.
    const onTouchMove = (e: TouchEvent) => {
      if (press.current?.fired && e.cancelable) e.preventDefault();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerEnd);
    container.addEventListener("pointercancel", onPointerEnd);
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      cancel();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerEnd);
      container.removeEventListener("pointercancel", onPointerEnd);
      container.removeEventListener("touchmove", onTouchMove);
    };
  }, [options.enabled, options.containerRef]);

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (press.current) e.preventDefault();
  }, []);

  return { onContextMenu };
}
