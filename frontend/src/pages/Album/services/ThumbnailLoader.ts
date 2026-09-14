/** A loaded thumbnail: its object URL and the iv of the part it was made from. */
export type LoadedThumbnail = { url: string | undefined; iv: string | undefined };

type ThumbnailLoaderOptions = {
  /** Thumbnail requests in flight at once. */
  concurrency: number;
  load: (fileId: string) => Promise<LoadedThumbnail | undefined>;
  onLoaded: (fileId: string, thumbnail: LoadedThumbnail) => void;
  onError: (fileId: string, error: unknown) => void;
};

/**
 * Bounded queue of thumbnail downloads. Tiles ask for their thumbnail when
 * they come near the viewport (`request`) and withdraw the request when they
 * leave it before the download started (`cancel`), so an album with hundreds
 * of photos only ever fetches the ones the user is looking at.
 */
export class ThumbnailLoader {
  private _queue: string[] = [];
  private _inFlight = new Set<string>();
  private _disposed = false;

  constructor(private _options: ThumbnailLoaderOptions) {}

  /** Queues a thumbnail; `front` puts it ahead of everything not yet started. */
  request(fileId: string, position: "front" | "back" = "back") {
    if (this._disposed || this._inFlight.has(fileId)) return;
    const queued = this._queue.indexOf(fileId);
    if (queued !== -1) {
      if (position === "back") return;
      this._queue.splice(queued, 1);
    }
    if (position === "front") this._queue.unshift(fileId);
    else this._queue.push(fileId);
    this._pump();
  }

  /** Drops a request that has not started yet. */
  cancel(fileId: string) {
    const queued = this._queue.indexOf(fileId);
    if (queued !== -1) this._queue.splice(queued, 1);
  }

  isPending(fileId: string) {
    return this._inFlight.has(fileId) || this._queue.includes(fileId);
  }

  dispose() {
    this._disposed = true;
    this._queue = [];
  }

  private _pump() {
    while (this._inFlight.size < this._options.concurrency && this._queue.length > 0) {
      const fileId = this._queue.shift();
      if (fileId === undefined) return;
      this._inFlight.add(fileId);
      this._options
        .load(fileId)
        .then((thumbnail) => {
          if (thumbnail === undefined) return;
          if (this._disposed) {
            if (thumbnail.url?.startsWith("blob:")) URL.revokeObjectURL(thumbnail.url);
            return;
          }
          this._options.onLoaded(fileId, thumbnail);
        })
        .catch((error) => {
          if (!this._disposed) this._options.onError(fileId, error);
        })
        .finally(() => {
          this._inFlight.delete(fileId);
          this._pump();
        });
    }
  }
}
