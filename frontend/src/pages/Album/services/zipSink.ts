/** Where `DownloadService` streams the zip while it builds it. */
export type ZipSink = {
  /** Called in order; the sink may keep `chunk` only until the promise settles. */
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<Blob>;
  abort(): Promise<void>;
};

/** Zips written to the origin-private file system are named with this prefix. */
const ENTRY_PREFIX = "download-";
/** A zip older than this is no longer being saved and is removed from the origin-private file system. */
const STALE_ENTRY_MS = 60 * 60 * 1000;

/**
 * Opens the best sink the browser has, so a big album never has to fit in memory:
 * - the origin-private file system through `createWritable()` (Chromium, Firefox, Safari 26+),
 * - the same file system through `createSyncAccessHandle()` in a worker (Safari 15.2 – 18, which
 *   lack `createWritable()`),
 * - memory, when there is no origin-private file system at all (Safari Private Browsing).
 */
export async function openZipSink(): Promise<ZipSink> {
  let root: FileSystemDirectoryHandle;
  try {
    root = await navigator.storage.getDirectory();
  } catch (e) {
    console.warn("No origin-private file system, zipping in memory", e);
    return memorySink();
  }
  await removeStaleEntries(root);
  const name = `${ENTRY_PREFIX}${crypto.randomUUID()}.zip`;

  if ("createWritable" in FileSystemFileHandle.prototype) {
    return writableSink(await root.getFileHandle(name, { create: true }));
  }
  try {
    return await workerSink(root, name);
  } catch (e) {
    console.warn(
      "Cannot write the origin-private file system from a worker, zipping in memory",
      e,
    );
    await root.removeEntry(name).catch(() => undefined);
    return memorySink();
  }
}

/** Each download leaves its zip behind (the browser may still be reading it); drop the old ones. */
async function removeStaleEntries(root: FileSystemDirectoryHandle) {
  try {
    for await (const handle of root.values()) {
      if (handle.kind !== "file" || !handle.name.startsWith(ENTRY_PREFIX)) continue;
      const file = await handle.getFile();
      if (Date.now() - file.lastModified > STALE_ENTRY_MS) {
        await root.removeEntry(handle.name);
      }
    }
  } catch (e) {
    console.warn("Could not clean up old downloads", e);
  }
}

async function writableSink(fileHandle: FileSystemFileHandle): Promise<ZipSink> {
  const writable = await fileHandle.createWritable();
  return {
    write: (chunk) => writable.write(chunk as Uint8Array<ArrayBuffer>),
    async close() {
      await writable.close();
      return fileHandle.getFile();
    },
    abort: () => writable.abort().catch(() => undefined),
  };
}

export type ZipWriterRequest =
  | { type: "open"; name: string }
  | { type: "write"; chunk: Uint8Array }
  | { type: "close" };
export type ZipWriterResponse = { type: "done" } | { type: "error"; message: string };

async function workerSink(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<ZipSink> {
  const worker = new Worker(new URL("./zipWriter.worker.ts", import.meta.url), {
    type: "module",
  });
  let failure: Error | undefined;
  let pending: { resolve: () => void; reject: (e: Error) => void } | undefined;
  const fail = (e: Error) => {
    failure ??= e;
    pending?.reject(failure);
    pending = undefined;
  };
  worker.onmessage = (event: MessageEvent<ZipWriterResponse>) => {
    if (event.data.type === "error") {
      fail(new Error(event.data.message));
      return;
    }
    pending?.resolve();
    pending = undefined;
  };
  worker.onerror = (event) => fail(new Error(event.message || "Zip writer failed"));
  const post = (request: ZipWriterRequest, transfer: Transferable[] = []) =>
    worker.postMessage(request, transfer);
  /** `open` and `close` answer once the worker has handled everything posted before them. */
  const ask = (request: ZipWriterRequest) =>
    new Promise<void>((resolve, reject) => {
      if (failure) {
        reject(failure);
        return;
      }
      pending = { resolve, reject };
      post(request);
    });

  try {
    await ask({ type: "open", name });
  } catch (e) {
    worker.terminate();
    throw e;
  }
  return {
    write(chunk) {
      if (failure) return Promise.reject(failure);
      // `chunk` may be a view into a buffer the zip still uses: transfer a copy.
      const copy = chunk.slice();
      post({ type: "write", chunk: copy }, [copy.buffer]);
      return Promise.resolve();
    },
    async close() {
      try {
        await ask({ type: "close" });
      } finally {
        worker.terminate();
      }
      return (await root.getFileHandle(name)).getFile();
    },
    async abort() {
      // Terminating the worker releases its access handle.
      worker.terminate();
      await root.removeEntry(name).catch(() => undefined);
    },
  };
}

function memorySink(): ZipSink {
  let chunks: Uint8Array<ArrayBuffer>[] = [];
  return {
    write(chunk) {
      chunks.push(chunk.slice());
      return Promise.resolve();
    },
    close() {
      const blob = new Blob(chunks, { type: "application/zip" });
      chunks = [];
      return Promise.resolve(blob);
    },
    abort() {
      chunks = [];
      return Promise.resolve();
    },
  };
}
