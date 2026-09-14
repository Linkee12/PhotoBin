import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { isAbortError, sleep } from "../../../utils/retry";
import { acquireWakeLock } from "../../../utils/wakeLock";
import { randomBatchName } from "../utils/batchName";
import { uploadService } from "../services";
import { PULSE_MS } from "../components/AlbumItem";

/** How long the bar sits at 100 % before the outro fade starts. */
const DONE_HOLD_MS = 500;

/**
 * idle      → nothing running
 * uploading → batch in flight; the indicator never shows 100 % here
 * done      → batch succeeded: fill snaps to 100 % on the still-dimmed album
 * outro     → indicator and mask fade out while the new tiles pulse
 */
export type UploadPhase = "idle" | "uploading" | "done" | "outro";

export type Uploaded = {
  fileId: string;
  thumbnail: string | undefined;
  thumbnailIv: string | undefined;
};

type UploadEvent =
  | ({ result: "finish" } & Uploaded)
  | { result: "progress"; bytes: number };

type RunOutcome = {
  finished: Uploaded[];
  /** Files that threw, or were in flight / not yet started when cancelled. */
  failed: File[];
  cancelled: boolean;
};

/**
 * Uploads `files` one after another, in order. A file that throws is recorded
 * as failed and the loop moves on; an abort ends the loop at once, with the
 * current file and every later one recorded as failed.
 */
export async function uploadInOrder(
  files: readonly File[],
  upload: (file: File) => AsyncIterable<UploadEvent>,
  on: { progress(bytes: number): void; finish(uploaded: Uploaded): void },
): Promise<RunOutcome> {
  const finished: Uploaded[] = [];
  const failed: File[] = [];
  for (const [i, file] of files.entries()) {
    try {
      for await (const event of upload(file)) {
        if (event.result === "progress") {
          on.progress(event.bytes);
        } else {
          const { fileId, thumbnail, thumbnailIv } = event;
          finished.push({ fileId, thumbnail, thumbnailIv });
          on.finish({ fileId, thumbnail, thumbnailIv });
        }
      }
    } catch (e) {
      if (isAbortError(e)) {
        return { finished, failed: [...failed, ...files.slice(i)], cancelled: true };
      }
      console.error(`Upload of ${file.name} failed`, e);
      failed.push(file);
    }
  }
  return { finished, failed, cancelled: false };
}

export type ByteProgress = { uploaded: number; total: number };

/**
 * What the indicator shows. Never 100 % while the batch is still running: the
 * last steps (finalize, metadata refresh) happen after the bytes are sent.
 */
export function shownPercentOf(phase: UploadPhase, bytes: ByteProgress | null): number {
  switch (phase) {
    case "idle":
      return 0;
    case "uploading": {
      if (bytes === null || bytes.total === 0) return 0;
      return Math.min(99, Math.floor((bytes.uploaded / bytes.total) * 100));
    }
    case "done":
    case "outro":
      return 100;
  }
}

function guardUnload(): () => void {
  const warn = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Legacy browsers (e.g. Chrome < 119) only show the prompt when returnValue is set.
    e.returnValue = true;
  };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}

type Options = {
  /** Undefined until the album metadata has loaded. */
  albumId: string | undefined;
  key: string | null;
  /** The parent's own notion of "a run is active" (set via `onUploadStarted`). */
  isUploading: boolean;
  onUploadStarted: () => void;
  onUploadFinished: () => void;
  /** A file finished uploading; its thumbnail is known before metadata lists it. */
  onUploaded: (uploaded: Uploaded) => void;
  refreshMetadata: () => void;
};

/**
 * One upload run at a time: every picked set of files is its own batch with a
 * fresh fantasy name (a resumed or retried file keeps the batch it was first
 * picked with). Failed files are kept for "retry"; cancelling stops the run
 * and keeps the unsent files.
 */
export function useUploadRun(options: Options) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [bytes, setBytes] = useState<ByteProgress | null>(null);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  /** Ids uploaded in the batch that just finished; their tiles pulse. */
  const [newFileIds, setNewFileIds] = useState<string[]>([]);
  // The only run state read synchronously: `cancel` needs it, and it refuses
  // a second `upload` before React has re-rendered `phase`.
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const upload = useCallback(async (files: File[]) => {
    const { albumId, key, isUploading } = optionsRef.current;
    if (albumId === undefined) {
      toast.error("Album is still loading, please try again");
      return;
    }
    if (isUploading || abortRef.current !== null || files.length === 0) return;

    const abort = new AbortController();
    abortRef.current = abort;
    const releaseWakeLock = acquireWakeLock();
    const releaseUnloadGuard = guardUnload();
    optionsRef.current.onUploadStarted();
    setPhase("uploading");
    setFailedFiles([]);
    setBytes({ uploaded: 0, total: files.reduce((sum, file) => sum + file.size, 0) });

    let outcome: RunOutcome | undefined;
    try {
      const batch = await uploadService.createBatch(randomBatchName(), key);
      outcome = await uploadInOrder(
        files,
        (file) =>
          uploadService.upload(file, { key, albumId, batch, signal: abort.signal }),
        {
          progress: (n) => setBytes((b) => b && { ...b, uploaded: b.uploaded + n }),
          finish: (uploaded) => {
            optionsRef.current.onUploaded(uploaded);
            // The tile shows as soon as metadata lists the file.
            optionsRef.current.refreshMetadata();
          },
        },
      );
      if (outcome.cancelled) toast.info("Upload cancelled");
      else if (outcome.failed.length > 0)
        toast.error(`${outcome.failed.length} of ${files.length} files failed`);
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      // Transfer is over: stop guarding the page before the outro plays.
      abortRef.current = null;
      releaseUnloadGuard();
      releaseWakeLock();
      // Nothing was attempted when the run threw, so everything is retryable.
      setFailedFiles(outcome?.failed ?? files);
      optionsRef.current.refreshMetadata();
    }

    if (outcome !== undefined && !outcome.cancelled && outcome.finished.length > 0) {
      // 100 % flash on the dimmed album → indicator and mask fade out while
      // the new tiles scroll into view and pulse.
      setPhase("done");
      await sleep(DONE_HOLD_MS);
      setPhase("outro");
      setNewFileIds(outcome.finished.map((u) => u.fileId));
      await sleep(PULSE_MS);
      setNewFileIds([]);
    }

    setPhase("idle");
    setBytes(null);
    optionsRef.current.onUploadFinished();
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const retryFailed = useCallback(() => upload(failedFiles), [upload, failedFiles]);

  return {
    upload,
    cancel,
    retryFailed,
    phase,
    shownPercent: shownPercentOf(phase, bytes),
    bytes,
    failedFiles,
    newFileIds,
  };
}
