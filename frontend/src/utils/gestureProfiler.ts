/**
 * Diagnostics for pointer gestures, enabled with `?profile` in the URL.
 *
 * While a gesture is active it counts pointer events and transform paints,
 * measures the browser's own frame cadence with a free-running rAF loop and
 * the time spent in the event handlers, and once a second prints the numbers to
 * the console and to a small overlay in the top left corner (readable on a phone
 * without remote debugging). Everything is a no-op unless enabled.
 */
export type GestureProfiler = {
  enabled: boolean;
  /** Call at the start of a pointer event handler; the returned function at its end. */
  event(): () => void;
  /** Call from the rAF that writes the transform. */
  paint(): void;
  /** Call when the gesture starts / ends (first finger down, last finger up). */
  gesture(active: boolean, info?: string): void;
};

const NOOP: GestureProfiler = {
  enabled: false,
  event: () => () => {},
  paint: () => {},
  gesture: () => {},
};

export function createGestureProfiler(label: string): GestureProfiler {
  if (!new URLSearchParams(window.location.search).has("profile")) return NOOP;

  let overlay: HTMLPreElement | null = null;
  let events = 0;
  let paints = 0;
  let frames = 0;
  let handlerMs = 0;
  let worstHandlerMs = 0;
  let worstFrameGapMs = 0;
  let lastFrame = 0;
  let windowStart = 0;
  let loop: number | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let info = "";

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("pre");
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "1000",
      margin: "0",
      padding: "4px 6px",
      font: "11px/1.3 monospace",
      color: "#0f0",
      background: "rgba(0,0,0,0.7)",
      pointerEvents: "none",
      whiteSpace: "pre",
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function resetWindow(now: number) {
    events = paints = frames = 0;
    handlerMs = worstHandlerMs = worstFrameGapMs = 0;
    windowStart = now;
  }

  function tick(now: number) {
    loop = requestAnimationFrame(tick);
    frames++;
    if (lastFrame) worstFrameGapMs = Math.max(worstFrameGapMs, now - lastFrame);
    lastFrame = now;
  }

  function report() {
    const now = performance.now();
    const seconds = (now - windowStart) / 1000;
    // A tap ends within a few ms; per-second rates from such a window are noise.
    if (seconds < 0.25) return;
    const line =
      `[${label}] ${info}\n` +
      `events/s ${(events / seconds).toFixed(0)}  paints/s ${(paints / seconds).toFixed(0)}  rAF/s ${(frames / seconds).toFixed(0)}\n` +
      `worst frame gap ${worstFrameGapMs.toFixed(0)}ms  handler avg ${(events ? handlerMs / events : 0).toFixed(2)}ms  worst ${worstHandlerMs.toFixed(1)}ms`;
    console.log(line);
    ensureOverlay().textContent = line;
    resetWindow(now);
  }

  return {
    enabled: true,
    event() {
      const start = performance.now();
      return () => {
        const ms = performance.now() - start;
        events++;
        handlerMs += ms;
        worstHandlerMs = Math.max(worstHandlerMs, ms);
      };
    },
    paint() {
      paints++;
    },
    gesture(active, nextInfo) {
      if (nextInfo !== undefined) info = nextInfo;
      if (active && loop === null) {
        lastFrame = 0;
        resetWindow(performance.now());
        loop = requestAnimationFrame(tick);
        interval = setInterval(report, 1000);
        ensureOverlay().textContent = `[${label}] ${info}\ngesture started`;
      } else if (!active && loop !== null) {
        report();
        cancelAnimationFrame(loop);
        loop = null;
        if (interval !== null) clearInterval(interval);
        interval = null;
      }
    },
  };
}
