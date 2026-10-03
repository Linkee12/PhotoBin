import type { ZipWriterRequest, ZipWriterResponse } from "./zipSink";

/**
 * Writes the zip into the origin-private file system for browsers without
 * `FileSystemFileHandle.createWritable()` (Safari before 26), whose only way to
 * write there is a sync access handle, available in dedicated workers only.
 * Safari before 17 returns promises from everything but `write`, hence the awaits.
 */
type SyncAccessHandle = {
  write(buffer: Uint8Array, options: { at: number }): number;
  truncate(size: number): unknown;
  flush(): unknown;
  close(): unknown;
};

type WorkerScope = {
  onmessage: ((event: MessageEvent<ZipWriterRequest>) => void) | null;
  postMessage(message: ZipWriterResponse): void;
};
const scope = self as unknown as WorkerScope;

let handle: SyncAccessHandle | undefined;
let offset = 0;
/** `open` is async; later messages wait for it so the writes stay in order. */
let queue = Promise.resolve();

async function handleRequest(request: ZipWriterRequest) {
  switch (request.type) {
    case "open": {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(request.name, { create: true });
      handle = await (
        fileHandle as unknown as { createSyncAccessHandle(): Promise<SyncAccessHandle> }
      ).createSyncAccessHandle();
      await handle.truncate(0);
      offset = 0;
      scope.postMessage({ type: "done" });
      return;
    }
    case "write": {
      if (!handle) throw new Error("Zip writer is not open");
      let written = 0;
      while (written < request.chunk.length) {
        const n = handle.write(request.chunk.subarray(written), { at: offset + written });
        if (n <= 0) throw new Error("Zip writer could not write (storage full?)");
        written += n;
      }
      offset += written;
      return;
    }
    case "close": {
      if (!handle) throw new Error("Zip writer is not open");
      await handle.flush();
      await handle.close();
      handle = undefined;
      scope.postMessage({ type: "done" });
      return;
    }
  }
}

scope.onmessage = (event) => {
  queue = queue
    .then(() => handleRequest(event.data))
    .catch((e: unknown) => {
      scope.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    });
};
