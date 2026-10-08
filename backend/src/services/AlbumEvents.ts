import { EventEmitter } from "node:events";

/** What happened to an album. Carries no album data: clients re-fetch the (encrypted) metadata. */
export type AlbumEvent = { type: "changed" } | { type: "deleted" };

/**
 * One subscriber's feed: the album's events, plus `connected` first (a client
 * that reconnects re-fetches, since it may have missed events) and a `ping`
 * every heartbeat (a client that hears nothing for longer knows the
 * connection is dead, which a phone waking from sleep cannot tell otherwise).
 */
export type AlbumStreamEvent = AlbumEvent | { type: "connected" } | { type: "ping" };

/** Default heartbeat; below the idle timeout of common proxies (60 s and up). */
export const DEFAULT_HEARTBEAT_MS = 25_000;

/**
 * In-process pub/sub of album changes, keyed by albumId. One backend process
 * serves every client, so an EventEmitter is enough; several instances would
 * need a shared bus instead.
 */
export class AlbumEvents {
  private _emitter = new EventEmitter().setMaxListeners(0);
  private _heartbeatMs: number;

  constructor(options: { heartbeatMs?: number } = {}) {
    this._heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  }

  publish(albumId: string, event: AlbumEvent) {
    this._emitter.emit(albumId, event);
  }

  listenerCount(albumId: string) {
    return this._emitter.listenerCount(albumId);
  }

  /**
   * Follows `albumId` until `signal` aborts or the album is deleted. Events
   * published while the consumer is busy are queued, not dropped.
   */
  async *subscribe(
    albumId: string,
    signal: AbortSignal,
  ): AsyncGenerator<AlbumStreamEvent> {
    const queue: AlbumStreamEvent[] = [];
    let wake: (() => void) | null = null;
    const push = (event: AlbumStreamEvent) => {
      queue.push(event);
      wake?.();
    };
    const onAbort = () => wake?.();
    this._emitter.on(albumId, push);
    signal.addEventListener("abort", onAbort);
    const heartbeat = setInterval(() => push({ type: "ping" }), this._heartbeatMs);
    try {
      yield { type: "connected" };
      while (!signal.aborted) {
        const event = queue.shift();
        if (event === undefined) {
          await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
          continue;
        }
        yield event;
        if (event.type === "deleted") return;
      }
    } finally {
      clearInterval(heartbeat);
      signal.removeEventListener("abort", onAbort);
      this._emitter.off(albumId, push);
    }
  }
}
