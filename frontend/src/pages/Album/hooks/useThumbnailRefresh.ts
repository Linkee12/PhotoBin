import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { guardUnload } from "../../../utils/guardUnload";
import { rotateService } from "../services";
import { mapWithConcurrency } from "../services/PartTransport";
import { AlbumFile } from "../services/renditions";
import { RefreshCounts, refreshSummary } from "../utils/thumbnailRefresh";

/** Each file downloads its shown rendition (MBs): two at a time. */
const REFRESH_CONCURRENCY = 2;

/**
 * "Refresh thumbnails": redoes every thumbnail made before thumbnails kept
 * the whole frame, so the viewer's preview matches the photo. Progress and
 * the outcome go to one toast; a file someone is rotating is skipped, a
 * failed one is counted and the rest go on. Leaving asks first.
 */
export function useThumbnailRefresh(options: {
  albumId: string;
  key: string | null;
  files: AlbumFile[];
  onFinished: () => void;
}) {
  const [isRefreshing, setRefreshing] = useState(false);
  // Set synchronously: a double click must not start two runs.
  const running = useRef(false);

  async function refresh() {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    const releaseUnload = guardUnload();
    const files = options.files.filter((file) => file.original && file.thumbnail);
    const toastId = toast.loading(progressText(0, files.length));
    const counts: RefreshCounts = { refreshed: 0, busy: 0, failed: 0 };
    let done = 0;
    try {
      await mapWithConcurrency(files.length, REFRESH_CONCURRENCY, async (i) => {
        try {
          const result = await rotateService.refreshThumbnail(
            options.albumId,
            files[i],
            options.key,
          );
          if (result === "refreshed") counts.refreshed++;
          else if (result === "edit-in-progress") counts.busy++;
        } catch (error) {
          console.error("[thumbnails] refresh failed", files[i].fileId, error);
          counts.failed++;
        }
        done++;
        toast.update(toastId, { render: progressText(done, files.length) });
      });
    } finally {
      const summary = refreshSummary(counts);
      toast.update(toastId, {
        render: summary.text,
        type: summary.ok ? "success" : "warning",
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
      });
      releaseUnload();
      running.current = false;
      setRefreshing(false);
      options.onFinished();
    }
  }

  return { isRefreshing, refresh };
}

function progressText(done: number, total: number) {
  return `Refreshing thumbnails ${done}/${total}`;
}
