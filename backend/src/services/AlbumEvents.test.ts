import { afterEach, describe, expect, it, vi } from "vitest";
import { AlbumEvents, AlbumStreamEvent } from "./AlbumEvents";

/** Reads `count` events from the feed (then leaves it open). */
async function take(feed: AsyncIterator<AlbumStreamEvent>, count: number) {
  const events: AlbumStreamEvent[] = [];
  for (let i = 0; i < count; i++) {
    const next = await feed.next();
    if (next.done) break;
    events.push(next.value);
  }
  return events;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AlbumEvents", () => {
  it("starts with connected, then yields the album's changes in order", async () => {
    const events = new AlbumEvents();
    const controller = new AbortController();
    const feed = events.subscribe("a", controller.signal)[Symbol.asyncIterator]();
    expect(await take(feed, 1)).toEqual([{ type: "connected" }]);

    events.publish("a", { type: "changed" });
    events.publish("a", { type: "changed" });
    expect(await take(feed, 2)).toEqual([{ type: "changed" }, { type: "changed" }]);
    controller.abort();
  });

  it("does not deliver another album's events", async () => {
    const events = new AlbumEvents();
    const controller = new AbortController();
    const feed = events.subscribe("a", controller.signal)[Symbol.asyncIterator]();
    await take(feed, 1);

    events.publish("b", { type: "changed" });
    events.publish("a", { type: "deleted" });
    expect(await take(feed, 1)).toEqual([{ type: "deleted" }]);
    controller.abort();
  });

  it("ends after deleted: there is nothing left to follow", async () => {
    const events = new AlbumEvents();
    const feed = events
      .subscribe("a", new AbortController().signal)
      [Symbol.asyncIterator]();
    await take(feed, 1);
    events.publish("a", { type: "deleted" });
    await take(feed, 1);
    expect(await feed.next()).toEqual({ done: true, value: undefined });
    expect(events.listenerCount("a")).toBe(0);
  });

  it("ends and unsubscribes when the signal aborts, even while waiting", async () => {
    const events = new AlbumEvents();
    const controller = new AbortController();
    const feed = events.subscribe("a", controller.signal)[Symbol.asyncIterator]();
    await take(feed, 1);
    const waiting = feed.next();
    expect(events.listenerCount("a")).toBe(1);
    controller.abort();
    expect(await waiting).toEqual({ done: true, value: undefined });
    expect(events.listenerCount("a")).toBe(0);
  });

  it("sends a ping every heartbeat, so a client can tell a dead connection from a quiet album", async () => {
    vi.useFakeTimers();
    const events = new AlbumEvents({ heartbeatMs: 1000 });
    const controller = new AbortController();
    const feed = events.subscribe("a", controller.signal)[Symbol.asyncIterator]();
    await take(feed, 1);
    const next = feed.next();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await next).toEqual({ done: false, value: { type: "ping" } });
    controller.abort();
  });
});
