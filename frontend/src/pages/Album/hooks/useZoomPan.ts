import { useCallback, useEffect, useRef, useState } from "react";
import { createGestureProfiler } from "../utils/gestureProfiler";
import { clamp, distance, midpoint, Point } from "../../../utils/geometry";

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const WHEEL_SENSITIVITY = 0.0015;
/** A pinch may shrink the picture this far below 1x before the fingers lift. */
const PINCH_OUT_MIN_SCALE = 0.4;
/** Lifting the fingers with the picture smaller than this closes the viewer. */
const PINCH_CLOSE_SCALE = 0.8;
/** Horizontal drag at 1x, in px, that counts as a swipe to the next / previous photo. */
const SWIPE_PX = 60;

export type ZoomTransform = { scale: number; tx: number; ty: number };

type UseZoomPanOptions = {
  /** Whenever this value changes the zoom is reset to 1x. */
  resetKey: unknown;
  /** While false the zoom is reset to 1x (e.g. modal closed). */
  enabled: boolean;
  /**
   * Size of the picture as drawn at 1x, when it differs from the plain
   * `object-fit: contain` box of the image (e.g. the image is rotated by an
   * inner transform of its own). Defaults to `drawnSize(image)`.
   */
  pictureSize?: (image: HTMLImageElement) => { width: number; height: number };
  /** A horizontal swipe at 1x: `1` for the next photo (swipe left), `-1` for the previous. */
  onSwipe?: (direction: 1 | -1) => void;
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
 * `imageRef` is the `<img>` that is measured; `targetRef` is the element that
 * receives the transform. Leave `targetRef` unattached to transform the image
 * itself, or attach it to a layer around the image when the image carries a
 * transform of its own (rotation) that must not be overwritten.
 */
export function useZoomPan({
  resetKey,
  enabled,
  pictureSize,
  onSwipe,
  onPinchClose,
}: UseZoomPanOptions) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const pictureSizeRef = useRef(pictureSize);
  pictureSizeRef.current = pictureSize;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const onPinchCloseRef = useRef(onPinchClose);
  onPinchCloseRef.current = onPinchClose;
  const measure = useCallback(
    (image: HTMLImageElement) => (pictureSizeRef.current ?? drawnSize)(image),
    [],
  );
  const transformRef = useRef<ZoomTransform>(IDENTITY);
  const frame = useRef<number | null>(null);
  const profiler = useRef(createGestureProfiler("zoom")).current;
  const [isZoomed, setIsZoomed] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; mid: Point } | null>(null);
  const downPosition = useRef<Point | null>(null);
  const downOnImage = useRef(false);
  const dragged = useRef(false);
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

  const clampTransform = useCallback(
    (next: ZoomTransform): ZoomTransform => {
      // While two fingers are down the picture may shrink below 1x (to close).
      const minScale = pinch.current ? PINCH_OUT_MIN_SCALE : MIN_SCALE;
      const scale = clamp(next.scale, minScale, MAX_SCALE);
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
      const minScale = pinch.current ? PINCH_OUT_MIN_SCALE : MIN_SCALE;
      const scale = clamp(nextScale, minScale, MAX_SCALE);
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

  const reset = useCallback(() => {
    pointers.current.clear();
    pinch.current = null;
    lastTap.current = null;
    dragged.current = false;
    downOnImage.current = false;
    setTransform(IDENTITY);
  }, [setTransform]);

  useEffect(() => {
    reset();
  }, [resetKey, enabled, reset]);

  // The image element may be (re)mounted after the transform was last painted
  // (e.g. switching from a video to a photo), so make sure it carries the current
  // transform after every commit. This is a cheap string comparison.
  useEffect(() => {
    paint();
  });

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
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
  // a native, non-passive listener. The wrapper can be remounted (e.g. after a
  // video was shown in between), so the element is tracked in state and the
  // listener follows it.
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const wrapperRefCallback = useCallback((el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    setWrapperEl(el);
  }, []);
  useEffect(() => {
    if (!wrapperEl || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      zoomAround(toLocal(e), transformRef.current.scale * factor);
    };
    wrapperEl.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapperEl.removeEventListener("wheel", onWheel);
  }, [wrapperEl, enabled, toLocal, zoomAround]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
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
        downPosition.current = point;
        downOnImage.current = isOnPicture(point);
        dragged.current = false;
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { distance: distance(a, b), mid: midpoint(a, b) };
        dragged.current = true;
      }
    },
    [isOnPicture, profiler, toLocal],
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
        const [a, b] = [...pointers.current.values()];
        const next = { distance: distance(a, b), mid: midpoint(a, b) };
        const scale = current.scale * (next.distance / pinch.current.distance);
        const base = {
          ...current,
          tx: current.tx + (next.mid.x - pinch.current.mid.x),
          ty: current.ty + (next.mid.y - pinch.current.mid.y),
        };
        pinch.current = next;
        zoomAround(next.mid, scale, base);
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
        downPosition.current &&
        onSwipeRef.current
      ) {
        // Swipe at 1x: the picture follows the finger sideways, unclamped.
        setTransform({ scale: 1, tx: point.x - downPosition.current.x, ty: 0 });
      }
      done();
    },
    [clampTransform, profiler, setTransform, toLocal, zoomAround],
  );

  /** The last finger of a drag or pinch lifted: settle the picture, close or swipe. */
  const endGesture = useCallback(() => {
    const { scale, tx } = transformRef.current;
    if (scale < 1) {
      // Pinched below 1x: well below closes the viewer, otherwise spring back.
      setTransform(IDENTITY);
      if (scale < PINCH_CLOSE_SCALE) onPinchCloseRef.current?.();
    } else if (scale === 1 && tx !== 0) {
      setTransform(IDENTITY);
      if (Math.abs(tx) >= SWIPE_PX) onSwipeRef.current?.(tx < 0 ? 1 : -1);
    }
  }, [setTransform]);

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
        // A cancelled gesture may leave the picture below 1x or pushed sideways.
        if (transformRef.current.scale <= 1) setTransform(IDENTITY);
        return;
      }

      if (dragged.current) {
        lastTap.current = null;
        endGesture();
      } else {
        onTap(toLocal(e));
      }
    },
    [endGesture, onTap, profiler, setTransform, toLocal],
  );

  /**
   * Swallows the click that follows a drag/pinch or a click on the image itself,
   * so only genuine clicks on the backdrop bubble up (e.g. to close the modal).
   */
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current || downOnImage.current) e.stopPropagation();
  }, []);

  return {
    wrapperRef: wrapperRefCallback,
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
