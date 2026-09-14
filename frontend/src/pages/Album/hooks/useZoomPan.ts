import { useCallback, useEffect, useRef, useState } from "react";
import { createGestureProfiler } from "../utils/gestureProfiler";
import { closeProgress, PINCH_CLOSE_SCALE, PINCH_SETTLE_MS } from "../utils/pinchClose";
import { stripOffset, SWIPE_ANIMATION_MS, swipeDecision } from "../utils/swipeStrip";
import { clamp, distance, midpoint, Point } from "../../../utils/geometry";
import { prefersReducedMotion } from "../../../utils/reducedMotion";

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const WHEEL_SENSITIVITY = 0.0015;
/** A pinch may shrink the picture this far below 1x before the fingers lift. */
const PINCH_OUT_MIN_SCALE = 0.4;

export type ZoomTransform = { scale: number; tx: number; ty: number };

type UseZoomPanOptions = {
  /** Whenever this value changes the zoom is reset to 1x. */
  resetKey: unknown;
  /** While false the zoom is reset to 1x (e.g. modal closed). */
  enabled: boolean;
  /**
   * Whether wheel, pinch and double tap change the scale (default true). When
   * false a pinch is swallowed — the wrapper's `touch-action: none` keeps the
   * page from zooming — and the only gesture left is the drag that swipes.
   */
  zoomable?: boolean;
  /**
   * Size of the picture as drawn at 1x, when it differs from the plain
   * `object-fit: contain` box of the image (e.g. the image is rotated by an
   * inner transform of its own). Defaults to `drawnSize(image)`.
   */
  pictureSize?: (image: HTMLImageElement) => { width: number; height: number };
  /** Whether a swipe has somewhere to go (default true); an edge without a neighbour resists. */
  canGoPrev?: boolean;
  canGoNext?: boolean;
  /**
   * A horizontal drag at 1x: the swipe strip belongs `offset` px to the right.
   * While the finger moves it follows at once; when it lifts, `animate` asks
   * for the ride to the neighbour (one wrapper width away) or back to 0.
   */
  onSwipeOffset?: (offset: number, animate: boolean) => void;
  /**
   * The strip has arrived at the neighbour (`SWIPE_ANIMATION_MS` after the
   * animated `onSwipeOffset`, at once with reduced motion): show that photo now.
   */
  onSwipe?: (direction: 1 | -1) => void;
  /**
   * A pinch that started at 1x is shrinking the picture: `t` grows from 0 (1x)
   * to 1 (`PINCH_CLOSE_SCALE`), one call per move. Once the fingers lift without
   * closing it is called with 0 and `animate` (the picture springs back).
   */
  onPinchProgress?: (t: number, animate: boolean) => void;
  /** The fingers lifted after pinching the picture well below 1x. */
  onPinchClose?: () => void;
};

const IDENTITY: ZoomTransform = { scale: 1, tx: 0, ty: 0 };

function toCss({ scale, tx, ty }: ZoomTransform) {
  return `translate(${tx}px, ${ty}px) scale(${scale})`;
}

/**
 * Size of the picture actually drawn inside an `object-fit: contain` image at 1x.
 * `offsetWidth/Height` is the layout box (which may be larger than the picture),
 * so the drawn size is derived from the intrinsic aspect ratio instead.
 */
export function drawnSize(image: HTMLImageElement) {
  const boxWidth = image.offsetWidth;
  const boxHeight = image.offsetHeight;
  const { naturalWidth, naturalHeight } = image;
  if (!naturalWidth || !naturalHeight || !boxWidth || !boxHeight) {
    return { width: boxWidth, height: boxHeight };
  }
  const ratio = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  return { width: naturalWidth * ratio, height: naturalHeight * ratio };
}

/**
 * Zoom / pan behaviour for a full screen image.
 *
 * The transform is written straight to the target element's `style.transform`
 * (as `translate(tx, ty) scale(scale)` with the default, centered, transform
 * origin) from a single coalesced animation frame, so pointer / wheel events never
 * go through React state. Only `isZoomed` is React state and it changes only when
 * the scale crosses 1x. The pointer handlers are meant for a full screen wrapper.
 *
 * At 1x a horizontal drag is a swipe: `onSwipeOffset` moves the caller's strip
 * of neighbouring pictures, `onSwipe` switches the photo once the strip has
 * arrived. A pinch that begins at 1x may shrink the picture below 1x
 * to close the viewer (`onPinchProgress` / `onPinchClose`).
 *
 * `imageRef` is the `<img>` that is measured; `targetRef` is the element that
 * receives the transform. Leave `targetRef` unattached to transform the image
 * itself, or attach it to a layer around the image when the image carries a
 * transform of its own (rotation) that must not be overwritten.
 */
export function useZoomPan({
  resetKey,
  enabled,
  zoomable = true,
  pictureSize,
  canGoPrev = true,
  canGoNext = true,
  onSwipeOffset,
  onSwipe,
  onPinchProgress,
  onPinchClose,
}: UseZoomPanOptions) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  // The latest options, readable from the stable handlers below.
  const latest = {
    pictureSize,
    zoomable,
    edges: { canGoPrev, canGoNext },
    onSwipeOffset,
    onSwipe,
    onPinchProgress,
    onPinchClose,
  };
  const options = useRef(latest);
  options.current = latest;
  const measure = useCallback(
    (image: HTMLImageElement) => (options.current.pictureSize ?? drawnSize)(image),
    [],
  );
  const transformRef = useRef<ZoomTransform>(IDENTITY);
  const frame = useRef<number | null>(null);
  const profiler = useRef(createGestureProfiler("zoom")).current;
  const [isZoomed, setIsZoomed] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  // `atRest`: the pinch began at 1x (or below it, i.e. inside an earlier at-rest
  // pinch whose finger was lifted and put down again), so it may shrink the
  // picture to close the viewer.
  const pinch = useRef<{ distance: number; mid: Point; atRest: boolean } | null>(null);
  const downPosition = useRef<Point | null>(null);
  const downOnImage = useRef(false);
  const dragged = useRef(false);
  /** Horizontal travel of the drag at 1x that moves the swipe strip; null outside one. */
  const swipeDx = useRef<number | null>(null);
  /** The strip is on its way to the neighbour; the photo switches when this fires. */
  const swipeCommit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ time: number; point: Point } | null>(null);

  const paint = useCallback(() => {
    frame.current = null;
    const target = targetRef.current ?? imageRef.current;
    if (!target) return;
    const css = toCss(transformRef.current);
    if (target.style.transform !== css) target.style.transform = css;
    profiler.paint();
  }, [profiler]);

  const schedulePaint = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

  const setTransform = useCallback(
    (next: ZoomTransform) => {
      const wasZoomed = transformRef.current.scale > 1;
      transformRef.current = next;
      const zoomed = next.scale > 1;
      if (zoomed !== wasZoomed) setIsZoomed(zoomed);
      schedulePaint();
    },
    [schedulePaint],
  );

  /** Only a pinch that began at 1x may shrink the picture below 1x (to close). */
  const minScale = () => (pinch.current?.atRest ? PINCH_OUT_MIN_SCALE : MIN_SCALE);

  const clampTransform = useCallback(
    (next: ZoomTransform): ZoomTransform => {
      const scale = clamp(next.scale, minScale(), MAX_SCALE);
      const wrapper = wrapperRef.current;
      const image = imageRef.current;
      if (!wrapper || !image) return { scale, tx: 0, ty: 0 };
      const picture = measure(image);
      const maxTx = Math.max(0, (picture.width * scale - wrapper.clientWidth) / 2);
      const maxTy = Math.max(0, (picture.height * scale - wrapper.clientHeight) / 2);
      return {
        scale,
        tx: clamp(next.tx, -maxTx, maxTx),
        ty: clamp(next.ty, -maxTy, maxTy),
      };
    },
    [measure],
  );

  /** Zooms to `nextScale` keeping the image point under `point` fixed on screen. */
  const zoomAround = useCallback(
    (point: Point, nextScale: number, base: ZoomTransform = transformRef.current) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const scale = clamp(nextScale, minScale(), MAX_SCALE);
      const ratio = scale / base.scale;
      const dx = point.x - wrapper.clientWidth / 2;
      const dy = point.y - wrapper.clientHeight / 2;
      setTransform(
        clampTransform({
          scale,
          tx: dx - (dx - base.tx) * ratio,
          ty: dy - (dy - base.ty) * ratio,
        }),
      );
    },
    [clampTransform, setTransform],
  );

  /** Puts the transform target on a short transition (spring back) or takes it off. */
  const setSettling = useCallback((settling: boolean) => {
    const target = targetRef.current ?? imageRef.current;
    if (!target) return;
    target.style.transition =
      settling && !prefersReducedMotion()
        ? `transform ${PINCH_SETTLE_MS}ms ease-out`
        : "";
  }, []);

  const reset = useCallback(() => {
    pointers.current.clear();
    pinch.current = null;
    lastTap.current = null;
    dragged.current = false;
    downOnImage.current = false;
    swipeDx.current = null;
    if (swipeCommit.current !== null) clearTimeout(swipeCommit.current);
    swipeCommit.current = null;
    setSettling(false);
    setTransform(IDENTITY);
  }, [setSettling, setTransform]);

  useEffect(() => {
    reset();
  }, [resetKey, enabled, reset]);

  // The transform target may be (re)mounted after the transform was last painted
  // (the zoom layer is not rendered for an unsupported file, so it is a fresh
  // element after switching from one to a photo), so make sure it carries the
  // current transform after every commit. This is a cheap string comparison.
  useEffect(() => {
    paint();
  });

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (swipeCommit.current !== null) clearTimeout(swipeCommit.current);
    };
  }, []);

  const toLocal = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }, []);

  /**
   * Whether `point` (wrapper local) is over the drawn picture. The image element
   * covers the whole wrapper (letterbox included), so the element under the pointer
   * says nothing about that.
   */
  const isOnPicture = useCallback(
    (point: Point) => {
      const wrapper = wrapperRef.current;
      const image = imageRef.current;
      if (!wrapper || !image) return false;
      const { scale, tx, ty } = transformRef.current;
      const picture = measure(image);
      const halfWidth = (picture.width * scale) / 2;
      const halfHeight = (picture.height * scale) / 2;
      const centerX = wrapper.clientWidth / 2 + tx;
      const centerY = wrapper.clientHeight / 2 + ty;
      return (
        Math.abs(point.x - centerX) <= halfWidth &&
        Math.abs(point.y - centerY) <= halfHeight
      );
    },
    [measure],
  );

  // React registers wheel listeners as passive, so preventDefault has to go through
  // a native, non-passive listener. The wrapper is mounted for the hook's whole
  // life (every kind of file renders inside it), so the ref is set by the time
  // this effect runs.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setSettling(false);
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      zoomAround(toLocal(e), transformRef.current.scale * factor);
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [enabled, zoomable, setSettling, toLocal, zoomAround]);

  /** A second finger (or a cancel) interrupts the swipe: the strip snaps back. */
  const cancelSwipe = useCallback(() => {
    if (swipeDx.current === null) return;
    swipeDx.current = null;
    options.current.onSwipeOffset?.(0, true);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // The strip is still travelling to the neighbour; that photo is next.
      if (swipeCommit.current !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const point = toLocal(e);
      pointers.current.set(e.pointerId, point);
      if (profiler.enabled && pointers.current.size === 1) {
        const image = imageRef.current;
        profiler.gesture(
          true,
          `${e.pointerType} img ${image?.naturalWidth ?? 0}x${image?.naturalHeight ?? 0} dpr ${window.devicePixelRatio}`,
        );
      }
      if (pointers.current.size === 1) {
        setSettling(false);
        downPosition.current = point;
        downOnImage.current = isOnPicture(point);
        dragged.current = false;
      } else if (pointers.current.size === 2) {
        cancelSwipe();
        const [a, b] = [...pointers.current.values()];
        pinch.current = {
          distance: distance(a, b),
          mid: midpoint(a, b),
          atRest: transformRef.current.scale <= 1,
        };
        dragged.current = true;
      }
    },
    [cancelSwipe, isOnPicture, profiler, setSettling, toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const previous = pointers.current.get(e.pointerId);
      if (!previous) return;
      const done = profiler.event();
      const point = toLocal(e);
      pointers.current.set(e.pointerId, point);

      if (
        !dragged.current &&
        downPosition.current &&
        distance(downPosition.current, point) > DRAG_THRESHOLD_PX
      ) {
        dragged.current = true;
      }

      const current = transformRef.current;
      if (pointers.current.size >= 2 && pinch.current) {
        // A pinch on something that cannot zoom is swallowed (the page never zooms).
        if (!options.current.zoomable) {
          done();
          return;
        }
        const [a, b] = [...pointers.current.values()];
        const next = { ...pinch.current, distance: distance(a, b), mid: midpoint(a, b) };
        const scale = current.scale * (next.distance / pinch.current.distance);
        const base = {
          ...current,
          tx: current.tx + (next.mid.x - pinch.current.mid.x),
          ty: current.ty + (next.mid.y - pinch.current.mid.y),
        };
        pinch.current = next;
        zoomAround(next.mid, scale, base);
        if (next.atRest) {
          options.current.onPinchProgress?.(
            closeProgress(transformRef.current.scale),
            false,
          );
        }
      } else if (pointers.current.size === 1 && current.scale > 1 && dragged.current) {
        setTransform(
          clampTransform({
            ...current,
            tx: current.tx + (point.x - previous.x),
            ty: current.ty + (point.y - previous.y),
          }),
        );
      } else if (
        pointers.current.size === 1 &&
        current.scale === 1 &&
        dragged.current &&
        downPosition.current
      ) {
        // Swipe at 1x: the strip follows the finger sideways.
        swipeDx.current = point.x - downPosition.current.x;
        options.current.onSwipeOffset?.(
          stripOffset(swipeDx.current, options.current.edges),
          false,
        );
      }
      done();
    },
    [clampTransform, profiler, setTransform, toLocal, zoomAround],
  );

  /** The last finger of a drag or pinch lifted: settle the picture, close or swipe. */
  const endGesture = useCallback(() => {
    const { scale } = transformRef.current;
    if (scale < 1) {
      // Pinched below 1x: well below closes the viewer, otherwise spring back.
      setSettling(true);
      setTransform(IDENTITY);
      if (scale <= PINCH_CLOSE_SCALE) options.current.onPinchClose?.();
      else options.current.onPinchProgress?.(0, true);
    } else if (swipeDx.current !== null) {
      const { edges, onSwipeOffset, onSwipe } = options.current;
      const direction = swipeDecision(swipeDx.current, edges);
      swipeDx.current = null;
      // The strip rides one screen to the neighbour, or back to the middle.
      onSwipeOffset?.(-direction * (wrapperRef.current?.clientWidth ?? 0), true);
      if (direction === 0 || !onSwipe) return;
      // The strip is on its way to the neighbour; switch when it has arrived.
      if (prefersReducedMotion()) {
        onSwipe(direction);
      } else {
        swipeCommit.current = setTimeout(() => {
          swipeCommit.current = null;
          onSwipe(direction);
        }, SWIPE_ANIMATION_MS);
      }
    }
  }, [setSettling, setTransform]);

  /** Double tap / double click detection, works for touch and mouse alike. */
  const onTap = useCallback(
    (point: Point) => {
      const now = Date.now();
      const previousTap = lastTap.current;
      if (
        previousTap &&
        now - previousTap.time < DOUBLE_TAP_MS &&
        distance(previousTap.point, point) < DOUBLE_TAP_DISTANCE_PX
      ) {
        lastTap.current = null;
        if (!options.current.zoomable) return;
        const zoomed = transformRef.current.scale > 1;
        zoomAround(point, zoomed ? MIN_SCALE : DOUBLE_TAP_SCALE);
      } else {
        lastTap.current = { time: now, point };
      }
    },
    [zoomAround],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size > 0) return;
      profiler.gesture(false);
      if (e.type === "pointercancel") {
        // A cancelled gesture may leave the picture below 1x or the strip pushed sideways.
        cancelSwipe();
        if (transformRef.current.scale < 1) {
          setTransform(IDENTITY);
          options.current.onPinchProgress?.(0, false);
        }
        return;
      }

      if (dragged.current) {
        lastTap.current = null;
        endGesture();
      } else {
        onTap(toLocal(e));
      }
    },
    [cancelSwipe, endGesture, onTap, profiler, setTransform, toLocal],
  );

  /**
   * Swallows the click that follows a drag/pinch or a click on the image itself,
   * so only genuine clicks on the backdrop bubble up (e.g. to close the modal).
   */
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current || downOnImage.current) e.stopPropagation();
  }, []);

  return {
    wrapperRef,
    targetRef,
    imageRef,
    isZoomed,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClick,
    },
  };
}
