/**
 * Asks before the page is closed or reloaded until the returned release is
 * called. For work that a reload would throw away (an upload, an import, a
 * save to Google Photos).
 */
export function guardUnload(): () => void {
  const warn = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Legacy browsers (e.g. Chrome < 119) only show the prompt when returnValue is set.
    e.returnValue = true;
  };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}
