/** Server heartbeat is 25 s: hearing nothing for this long means the connection is dead. */
export const STALE_MS = 60_000;
const FIRST_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;

/** Wait before reconnect attempt `failures` (0-based): 1 s, 2 s, 4 s … 30 s. */
export function reconnectDelay(failures: number) {
  return Math.min(FIRST_RECONNECT_MS * 2 ** failures, MAX_RECONNECT_MS);
}

/** Whether a stream last heard from at `lastHeardAt` should be given up at `now`. */
export function isStale(lastHeardAt: number, now: number) {
  return now - lastHeardAt > STALE_MS;
}

/**
 * Turns a burst of `schedule()` calls into one `run`: `delayMs` after the
 * last call, but no later than `maxWaitMs` after the first, so a steady
 * stream (someone uploading a hundred photos) still refreshes along the way.
 */
export function createCoalescer(delayMs: number, maxWaitMs: number, run: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstAt: number | undefined;
  function fire() {
    timer = undefined;
    firstAt = undefined;
    run();
  }
  return {
    schedule() {
      const now = Date.now();
      firstAt ??= now;
      clearTimeout(timer);
      timer = setTimeout(fire, Math.min(delayMs, firstAt + maxWaitMs - now));
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      firstAt = undefined;
    },
  };
}
