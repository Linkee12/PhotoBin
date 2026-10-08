export type RefreshCounts = {
  /** Thumbnails redone with the whole frame. */
  refreshed: number;
  /** Skipped because someone was editing (rotating) the photo. */
  busy: number;
  failed: number;
};

/** What the progress toast says when a thumbnail refresh is over. */
export function refreshSummary(counts: RefreshCounts): { text: string; ok: boolean } {
  const { refreshed, busy, failed } = counts;
  if (refreshed === 0 && busy === 0 && failed === 0) {
    return { text: "All thumbnails are up to date", ok: true };
  }
  const parts = [`Refreshed ${refreshed} thumbnail${refreshed === 1 ? "" : "s"}`];
  if (busy > 0) parts.push(`${busy} skipped (being edited)`);
  if (failed > 0) parts.push(`${failed} failed`);
  return { text: parts.join(" · "), ok: failed === 0 };
}
