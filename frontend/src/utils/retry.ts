/** tus-style backoff: first retry immediately, then 1s, 3s, 5s. */
export const RETRY_DELAYS_MS = [0, 1000, 3000, 5000];

/** Thrown for failures worth retrying (network errors, 5xx, unparsable responses). */
export class RetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RetryableError";
  }
}

export function isAbortError(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(id);
      reject(new DOMException("Upload cancelled", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Resolves immediately when online, otherwise waits for the next `online` event. */
export function waitForOnline(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    if (navigator.onLine) return resolve();
    function onOnline() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    function onAbort() {
      window.removeEventListener("online", onOnline);
      reject(new DOMException("Upload cancelled", "AbortError"));
    }
    window.addEventListener("online", onOnline, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `attempt`, retrying on `RetryableError` with the given delays. Anything
 * else (4xx, abort) is rethrown at once. Waits for connectivity before each retry.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  options: { signal?: AbortSignal; delays?: number[] } = {},
): Promise<T> {
  const delays = options.delays ?? RETRY_DELAYS_MS;
  for (let retry = 0; ; retry++) {
    throwIfAborted(options.signal);
    try {
      return await attempt();
    } catch (e) {
      if (!(e instanceof RetryableError) || retry >= delays.length) throw e;
      console.warn(`[upload] retry ${retry + 1}/${delays.length}:`, e.message);
      await waitForOnline(options.signal);
      await sleep(delays[retry], options.signal);
    }
  }
}
