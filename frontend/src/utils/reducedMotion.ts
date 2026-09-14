/** Whether the user asked for less motion; animations are skipped, not slowed. */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
