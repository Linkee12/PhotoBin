import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCoalescer, isStale, reconnectDelay, STALE_MS } from "./liveUpdates";

describe("reconnectDelay", () => {
  it("backs off from 1 s, doubling, capped at 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(reconnectDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});

describe("isStale", () => {
  it("is stale once nothing was heard for longer than STALE_MS", () => {
    expect(isStale(0, STALE_MS)).toBe(false);
    expect(isStale(0, STALE_MS + 1)).toBe(true);
  });
});

describe("createCoalescer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once after a burst goes quiet", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(300, 2000, run);
    coalescer.schedule();
    vi.advanceTimersByTime(200);
    coalescer.schedule();
    vi.advanceTimersByTime(299);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not starve under a steady stream: runs at least every maxWait", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(300, 1000, run);
    for (let t = 0; t < 2500; t += 100) {
      coalescer.schedule();
      vi.advanceTimersByTime(100);
    }
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("cancel drops a pending run", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(300, 1000, run);
    coalescer.schedule();
    coalescer.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });
});
