import { useCallback, useEffect, useRef, useState } from "react";

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DRAG_THRESHOLD_PX = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const WHEEL_SENSITIVITY = 0.0015;

export type ZoomTransform = { scale: number; tx: number; ty: number };

type Point = { x: number; y: number };

type UseZoomPanOptions = {
  /** Whenever this value changes the zoom is reset to 1x. */
  resetKey: unknown;
  /** While false the zoom is reset to 1x (e.g. modal closed). */
  enabled: boolean;
};

const IDENTITY: ZoomTransform = { scale: 1, tx: 0, ty: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Zoom / pan behaviour for a full screen image.
 *
 * The transform is meant to be applied to the image element as
 * `translate(tx, ty) scale(scale)` with the default (centered) transform origin,
 * while the pointer handlers are attached to a full screen wrapper element.
 */
export function useZoomPan({ resetKey, enabled }: UseZoomPanOptions) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [transform, setTransformState] = useState<ZoomTransform>(IDENTITY);
  const transformRef = useRef<ZoomTransform>(IDENTITY);

  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; mid: Point } | null>(null);
  const downPosition = useRef<Point | null>(null);
  const downOnImage = useRef(false);
  const dragged = useRef(false);
  const lastTap = useRef<{ time: number; point: Point } | null>(null);

  const setTransform = useCallback((next: ZoomTransform) => {
    transformRef.current = next;
    setTransformState(next);
  }, []);

  const clampTransform = useCallback((next: ZoomTransform): ZoomTransform => {
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const wrapper = wrapperRef.current;
    const image = imageRef.current;
    if (!wrapper || !image) return { scale, tx: 0, ty: 0 };
    // offsetWidth/Height ignore CSS transforms, so this is the layout size at 1x.
    const maxTx = Math.max(0, (image.offsetWidth * scale - wrapper.clientWidth) / 2);
    const maxTy = Math.max(0, (image.offsetHeight * scale - wrapper.clientHeight) / 2);
    return {
      scale,
      tx: clamp(next.tx, -maxTx, maxTx),
      ty: clamp(next.ty, -maxTy, maxTy),
    };
  }, []);

  /** Zooms to `nextScale` keeping the image point under `point` fixed on screen. */
  const zoomAround = useCallback(
    (point: Point, nextScale: number, base: ZoomTransform = transformRef.current) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
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
    setTransform(IDENTITY);
  }, [setTransform]);

  useEffect(() => {
    reset();
  }, [resetKey, enabled, reset]);

  const toLocal = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }, []);

  // React registers wheel listeners as passive, so preventDefault has to go through
  // a native listener.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      zoomAround(toLocal(e), transformRef.current.scale * factor);
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [enabled, toLocal, zoomAround]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const point = toLocal(e);
      pointers.current.set(e.pointerId, point);
      if (pointers.current.size === 1) {
        downPosition.current = point;
        downOnImage.current = e.target === imageRef.current;
        dragged.current = false;
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { distance: distance(a, b), mid: midpoint(a, b) };
        dragged.current = true;
      }
    },
    [toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const previous = pointers.current.get(e.pointerId);
      if (!previous) return;
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
      }
    },
    [clampTransform, setTransform, toLocal, zoomAround],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size > 0 || e.type === "pointercancel") return;

      if (dragged.current) {
        lastTap.current = null;
        return;
      }

      // Double tap / double click detection, works for touch and mouse alike.
      const point = toLocal(e);
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
    [toLocal, zoomAround],
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
    imageRef,
    transform,
    isZoomed: transform.scale > 1,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClick,
    },
  };
}
