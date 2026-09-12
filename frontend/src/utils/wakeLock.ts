/**
 * Keeps the screen awake while a long task runs. Feature-detected; never throws.
 * The lock is dropped by the browser when the tab is hidden, so it is
 * re-requested when the page becomes visible again.
 */
export function acquireWakeLock(): () => void {
  if (!("wakeLock" in navigator)) return () => {};
  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  const request = async () => {
    if (released || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
    } catch (e) {
      console.warn("[wakeLock] request failed", e);
    }
  };
  const onVisibilityChange = () => {
    request().catch(() => {});
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  request().catch(() => {});

  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
