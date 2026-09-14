import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Metadata } from "../../../../../backend/src/services/MetadataService";
import { imageQueryService } from "../services";
import { LoadedThumbnail, ThumbnailLoader } from "../services/ThumbnailLoader";
import { useThumbnailVisibility } from "./useThumbnailVisibility";

/** Thumbnail downloads in flight at once (browsers allow ~6 per host on HTTP/1.1). */
const THUMBNAIL_CONCURRENCY = 6;

function revokeIfBlob(url: string | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

/**
 * The album's loaded thumbnails, one object URL per file, fetched lazily as
 * tiles come near the viewport (`visibility`) or on demand (`loader`). A
 * thumbnail whose part was replaced server-side (rotation: new iv) is
 * refetched right away; the stale image stays up until the new one lands.
 */
export function useThumbnails(options: {
  albumId: string | undefined;
  key: string | null;
  files: Metadata["files"];
}) {
  const { albumId, key, files } = options;
  const [thumbnails, setThumbnails] = useState<Map<string, LoadedThumbnail>>(
    () => new Map(),
  );
  // The loader reads the latest file list and loaded set through refs so it is
  // created once per album and survives metadata refreshes.
  const filesRef = useRef(files);
  filesRef.current = files;
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  // Loaded thumbnails are collected here and committed once per frame so a
  // burst of arrivals costs one render instead of one per thumbnail.
  const pendingRef = useRef(new Map<string, LoadedThumbnail>());
  const flushRef = useRef<number | null>(null);

  const setLoadedThumbnail = useCallback((fileId: string, next: LoadedThumbnail) => {
    setThumbnails((prev) => {
      const current = prev.get(fileId);
      if (current?.url !== next.url) revokeIfBlob(current?.url);
      return new Map(prev).set(fileId, next);
    });
  }, []);
  const flushThumbnails = useCallback(() => {
    flushRef.current = null;
    const arrived = pendingRef.current;
    if (arrived.size === 0) return;
    pendingRef.current = new Map();
    setThumbnails((prev) => {
      const next = new Map(prev);
      for (const [fileId, thumb] of arrived) {
        const current = next.get(fileId);
        if (current?.url !== thumb.url) revokeIfBlob(current?.url);
        next.set(fileId, thumb);
      }
      return next;
    });
  }, []);
  const queueLoadedThumbnail = useCallback(
    (fileId: string, thumb: LoadedThumbnail) => {
      const superseded = pendingRef.current.get(fileId);
      if (superseded !== undefined && superseded.url !== thumb.url) {
        revokeIfBlob(superseded.url);
      }
      pendingRef.current.set(fileId, thumb);
      flushRef.current ??= requestAnimationFrame(flushThumbnails);
    },
    [flushThumbnails],
  );
  const loader = useMemo(
    () =>
      new ThumbnailLoader({
        concurrency: THUMBNAIL_CONCURRENCY,
        load: async (fileId) => {
          if (albumId === undefined) return undefined;
          const file = filesRef.current.find((f) => f.fileId === fileId);
          if (file?.thumbnail === undefined) return undefined;
          // The eager request and the IntersectionObserver may both ask for a
          // tile; whichever comes second finds it already loaded (or about to
          // be committed) and is a no-op unless the part was replaced since.
          const loaded =
            pendingRef.current.get(fileId) ?? thumbnailsRef.current.get(fileId);
          if (loaded !== undefined && loaded.iv === file.thumbnail.iv) return undefined;
          const result = await imageQueryService.getImg(albumId, file, key, "thumbnail", {
            withText: false,
          });
          return (
            result && { url: URL.createObjectURL(result.blob), iv: file.thumbnail.iv }
          );
        },
        onLoaded: queueLoadedThumbnail,
        onError: (fileId, error) => console.error(`Thumbnail ${fileId} failed`, error),
      }),
    [albumId, key, queueLoadedThumbnail],
  );
  const visibility = useThumbnailVisibility(loader);
  useEffect(
    () => () => {
      loader.dispose();
      if (flushRef.current !== null) cancelAnimationFrame(flushRef.current);
      for (const thumb of pendingRef.current.values()) revokeIfBlob(thumb.url);
      pendingRef.current = new Map();
    },
    [loader],
  );

  useEffect(() => {
    for (const file of files) {
      const loaded = thumbnails.get(file.fileId);
      if (loaded !== undefined && loaded.iv !== file.thumbnail?.iv) {
        loader.request(file.fileId, "front");
      }
    }
  }, [files, loader]);

  const dropThumbnails = useCallback((ids: string[]) => {
    setThumbnails((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        revokeIfBlob(next.get(id)?.url);
        next.delete(id);
      }
      return next;
    });
  }, []);

  const thumbnailUrls = useMemo(
    () => new Map([...thumbnails].map(([id, thumb]) => [id, thumb.url])),
    [thumbnails],
  );

  return { thumbnailUrls, loader, visibility, setLoadedThumbnail, dropThumbnails };
}
