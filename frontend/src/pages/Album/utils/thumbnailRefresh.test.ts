import { describe, expect, it } from "vitest";
import { refreshSummary } from "./thumbnailRefresh";

describe("refreshSummary", () => {
  it("says so when there was nothing to redo", () => {
    expect(refreshSummary({ refreshed: 0, busy: 0, failed: 0 })).toEqual({
      text: "All thumbnails are up to date",
      ok: true,
    });
  });

  it("counts what was redone, with the right plural", () => {
    expect(refreshSummary({ refreshed: 1, busy: 0, failed: 0 }).text).toBe(
      "Refreshed 1 thumbnail",
    );
    expect(refreshSummary({ refreshed: 12, busy: 0, failed: 0 }).text).toBe(
      "Refreshed 12 thumbnails",
    );
  });

  it("names what was left out, and is not ok when something failed", () => {
    expect(refreshSummary({ refreshed: 3, busy: 1, failed: 0 })).toEqual({
      text: "Refreshed 3 thumbnails · 1 skipped (being edited)",
      ok: true,
    });
    expect(refreshSummary({ refreshed: 0, busy: 0, failed: 2 })).toEqual({
      text: "Refreshed 0 thumbnails · 2 failed",
      ok: false,
    });
  });
});
