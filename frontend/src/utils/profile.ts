/** `?profile` in the URL turns on per-stage timing logs and the gesture overlay. */
export function isProfiling(): boolean {
  return new URLSearchParams(window.location.search).has("profile");
}
