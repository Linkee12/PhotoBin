import { styled } from "../../stitches.config";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CanvasService } from "./services/CanvasService";
import { UploadService } from "./services/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { ImageQueryService } from "./services/ImageQueryService";
import { Header } from "./components/Header";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { useAlbumContext } from "./hooks/useAlbumContext";
import { DownloadService } from "./services/DownloadService";
import { CryptoService } from "./services/CryptoService";
import {
  ALBUM_VIEWS,
  AlbumView,
  DEFAULT_ALBUM_VIEW,
  groupFiles,
} from "../../utils/groupFiles";
import { AlbumContent } from "./components/AlbumContent";
import { toast } from "react-toastify";
import { LoadedThumbnail, ThumbnailLoader } from "./services/ThumbnailLoader";
import {
  ThumbnailVisibilityProvider,
  useThumbnailVisibility,
} from "./hooks/useThumbnailVisibility";

export type { Thumbnail, ThumbnailGroup } from "../../utils/groupFiles";

const imageResizeService = new CanvasService();
const cryptoService = new CryptoService();
const uploadService = new UploadService(imageResizeService, cryptoService);
const imageQueryService = new ImageQueryService(cryptoService);
const downloadService = new DownloadService(imageQueryService);

const VIEW_STORAGE_KEY = "photobin:albumView";
/** Thumbnail downloads in flight at once (browsers allow ~6 per host on HTTP/1.1). */
const THUMBNAIL_CONCURRENCY = 6;
/** Tiles requested as soon as the album opens, before the grid is laid out. */
const EAGER_THUMBNAILS = 12;

function readStoredView(): AlbumView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return ALBUM_VIEWS.find((view) => view === stored) ?? DEFAULT_ALBUM_VIEW;
  } catch {
    return DEFAULT_ALBUM_VIEW;
  }
}

function storeView(view: AlbumView) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Persisting the view is a convenience; ignore storage errors.
  }
}

function revokeIfBlob(url: string | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

/** "Delete 3 photos and 1 attached file?" — attached files are selected RAWs. */
function deleteQuestion(photos: number, attached: number): string {
  const parts: string[] = [];
  if (photos === 1) parts.push("this photo");
  else if (photos > 1) parts.push(`${photos} photos`);
  if (attached === 1) parts.push("1 attached file");
  else if (attached > 1) parts.push(`${attached} attached files`);
  return `Delete ${parts.join(" and ")}?`;
}

export default function Album() {
  const albumContext = useAlbumContext();
  const { metadata, key, refreshMetadata, decodedValues } = albumContext;
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const { albumId } = useParams();
  const [title, setTitle] = useState("");
  const [view, setView] = useState<AlbumView>(readStoredView);
  // Thumbnails are loaded (or announced by an upload) per file; the grouped
  // view is derived from metadata + this map, so switching views is free.
  const [thumbnails, setThumbnails] = useState<Map<string, LoadedThumbnail>>(
    () => new Map(),
  );
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showOrigin, setShowOrigin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const files = useMemo(() => metadata?.files ?? [], [metadata]);
  const thumbnailUrls = useMemo(
    () => new Map([...thumbnails].map(([id, thumb]) => [id, thumb.url])),
    [thumbnails],
  );
  const thumbnailGroups = useMemo(
    () =>
      groupFiles({
        files,
        decodedFiles: decodedValues.files,
        decodedBatches: decodedValues.batches,
        thumbnails: thumbnailUrls,
        view,
      }),
    [files, decodedValues, thumbnailUrls, view],
  );
  // A tile's sidecars (RAW next to its JPG). Selection is per file: picking a
  // tile picks only the photo; the RAW has its own toggle (the tile's badge, the
  // viewer's pill). "Download all" and a delete from the viewer take them along.
  const { tileIds, sidecarsOf, sidecarIdsOf, sidecarIds } = useMemo(() => {
    const tiles = thumbnailGroups.flatMap((group) => group.thumbnails);
    const withSidecars = tiles.filter((tile) => tile.sidecars.length > 0);
    return {
      tileIds: tiles.map((tile) => tile.id),
      sidecarsOf: new Map(withSidecars.map((tile) => [tile.id, tile.sidecars])),
      sidecarIdsOf: new Map(
        withSidecars.map((tile) => [tile.id, tile.sidecars.map((s) => s.id)]),
      ),
      sidecarIds: new Set(withSidecars.flatMap((tile) => tile.sidecars.map((s) => s.id))),
    };
  }, [thumbnailGroups]);
  const allSidecarIds = useMemo(() => [...sidecarIds], [sidecarIds]);
  const withSidecars = useCallback(
    (ids: string[]) => [
      ...new Set(ids.flatMap((id) => [id, ...(sidecarIdsOf.get(id) ?? [])])),
    ],
    [sidecarIdsOf],
  );
  const isEmptyAlbum = thumbnailGroups.length === 0;
  const isLoadingThumbnails = files.length > 0 && isEmptyAlbum;
  const showUploader = (metadata !== undefined && files.length === 0) || isUploading;

  useEffect(() => {
    setTitle(decodedValues.albumName);
  }, [decodedValues.albumName]);

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
          return result && { url: result.img, iv: file.thumbnail.iv };
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
    if (metadata === undefined) return;
    // A changed thumbnail iv means the part was replaced server-side (e.g.
    // rotation): refetch it right away, ahead of tiles that are merely
    // scrolling into view. The stale image stays up until the new one lands.
    for (const file of metadata.files) {
      const loaded = thumbnails.get(file.fileId);
      if (loaded !== undefined && loaded.iv !== file.thumbnail?.iv) {
        loader.request(file.fileId, "front");
      }
    }
  }, [metadata, loader]);

  // The first tiles of a freshly opened album are on screen in any layout; ask
  // for them as soon as the file list is known instead of after the whole
  // grid has been laid out and observed. Everything else (including later
  // metadata refreshes) waits for the IntersectionObserver.
  const eagerRequested = useRef(false);
  useLayoutEffect(() => {
    if (eagerRequested.current || files.length === 0) return;
    eagerRequested.current = true;
    const eager = thumbnailGroups
      .flatMap((group) => group.thumbnails)
      .filter((thumb) => thumb.isLoading)
      .slice(0, EAGER_THUMBNAILS);
    for (const thumb of eager) loader.request(thumb.id);
  }, [files, loader]);

  function setLoadedThumbnail(fileId: string, next: LoadedThumbnail) {
    setThumbnails((prev) => {
      const current = prev.get(fileId);
      if (current?.url !== next.url) revokeIfBlob(current?.url);
      return new Map(prev).set(fileId, next);
    });
  }

  function changeView(next: AlbumView) {
    setView(next);
    storeView(next);
  }

  async function deleteImages(ids: string[]) {
    if (albumId === undefined) return;
    const responses = await client.deleteImages.delete({
      body: {
        albumId: albumId,
        ids: ids,
      },
    });

    if (responses.result !== "success") {
      toast.error("Failed to delete");
      return;
    }

    setThumbnails((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        revokeIfBlob(next.get(id)?.url);
        next.delete(id);
      }
      return next;
    });
    setSelectedImages((prev) => prev.filter((imgId) => !ids.includes(imgId)));
    refreshMetadata();
  }

  function onDeleteSelected() {
    const photos = selectedImages.filter((id) => !sidecarIds.has(id)).length;
    const attached = selectedImages.length - photos;
    if (!window.confirm(`${deleteQuestion(photos, attached)} This cannot be undone.`))
      return;
    deleteImages(selectedImages).catch((reason) => {
      console.error(reason);
      toast.error("Failed to delete");
    });
  }

  async function runDownload(imageIds: string[]) {
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      if (metadata) {
        await downloadService.download({
          albumContext,
          selectedImages: imageIds,
          onProgress: setDownloadProgress,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }

  function onDownloadSelected() {
    runDownload(selectedImages).catch((e) => console.error(e));
  }
  function onDownloadAll(imageIds: string[]) {
    runDownload(withSidecars(imageIds)).catch((e) => console.error(e));
  }

  function onUncheckSelected() {
    setSelectedImages([]);
  }
  /** Every photo (tile); the attached RAWs have their own "+RAW" toggle. */
  function onSelectAll() {
    setSelectedImages((prev) => [...tileIds, ...prev.filter((id) => sidecarIds.has(id))]);
  }
  const selectedSidecarCount = selectedImages.filter((id) => sidecarIds.has(id)).length;
  function onToggleAllSidecars() {
    if (selectedSidecarCount === allSidecarIds.length) onDeSelect(allSidecarIds);
    else onSelect(allSidecarIds);
  }
  /** Same as tapping a tile's ring: the album enters selection mode on the first pick. */
  function toggleSelected(id: string) {
    setSelectedImages((selected) =>
      selected.includes(id)
        ? selected.filter((imgId) => imgId !== id)
        : [...selected, id],
    );
  }
  // Stable handlers: AlbumItem is memoised, so these must not change per render.
  const onSelect = useCallback((ids: string[]) => {
    setSelectedImages((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
  }, []);
  const onDeSelect = useCallback((ids: string[]) => {
    setSelectedImages((prev) => prev.filter((imgId) => !ids.includes(imgId)));
  }, []);
  const isSelected = useCallback(
    (id: string) => selectedImages.includes(id),
    [selectedImages],
  );
  const areSidecarsSelected = useCallback(
    (id: string) => {
      const ids = sidecarIdsOf.get(id) ?? [];
      return (
        ids.length > 0 && ids.every((sidecarId) => selectedImages.includes(sidecarId))
      );
    },
    [selectedImages, sidecarIdsOf],
  );
  const onToggleSidecars = useCallback(
    (id: string) => {
      const ids = sidecarIdsOf.get(id) ?? [];
      if (ids.length === 0) return;
      setSelectedImages((prev) =>
        ids.every((sidecarId) => prev.includes(sidecarId))
          ? prev.filter((imgId) => !ids.includes(imgId))
          : [...prev, ...ids.filter((sidecarId) => !prev.includes(sidecarId))],
      );
    },
    [sidecarIdsOf],
  );
  const onOpen = useCallback((id: string) => {
    setFullscreenImage({ fileId: id });
    setShowOrigin(true);
  }, []);

  function nextOriginImgId(direction: number) {
    const ids = thumbnailGroups.flatMap((group) => group.thumbnails.map((i) => i.id));
    const currentIdx = ids.findIndex((id) => id === fullscreenImage?.fileId);

    let nextIdx;
    if (currentIdx + direction > ids.length - 1) {
      nextIdx = 0;
    } else if (currentIdx + direction < 0) {
      nextIdx = ids.length - 1;
    } else {
      nextIdx = currentIdx + direction;
    }
    setFullscreenImage({ fileId: ids[nextIdx] });
  }

  function saveAlbumName() {
    if (metadata !== undefined) {
      uploadService.saveName(metadata.albumId, title, key);
    }
  }
  async function renameBatch(batchId: string, name: string) {
    if (metadata === undefined) return;
    try {
      await uploadService.renameBatch(metadata.albumId, batchId, name, key);
    } catch (e) {
      console.error(e);
      toast.error("Failed to rename");
    }
    refreshMetadata();
  }
  return (
    <ThumbnailVisibilityProvider value={visibility}>
      <Container isEmptyAlbum={isEmptyAlbum}>
        {fullscreenImage && (
          <ViewOriginalModal
            fileId={fullscreenImage.fileId}
            visible={showOrigin}
            thumbnails={thumbnailGroups}
            fileName={decodedValues.files[fullscreenImage.fileId]?.name ?? ""}
            onShowChange={setShowOrigin}
            onNext={(direction) => nextOriginImgId(direction)}
            onDelete={() => deleteImages(withSidecars([fullscreenImage.fileId]))}
            isSelected={selectedImages.includes(fullscreenImage.fileId)}
            onToggleSelect={() => toggleSelected(fullscreenImage.fileId)}
            sidecars={sidecarsOf.get(fullscreenImage.fileId) ?? []}
            areSidecarsSelected={areSidecarsSelected(fullscreenImage.fileId)}
            onToggleSidecars={() => onToggleSidecars(fullscreenImage.fileId)}
          />
        )}
        <Header
          isEmptyAlbum={isEmptyAlbum}
          title={title}
          onChangeTitle={setTitle}
          onSaveName={saveAlbumName}
          onSelectAll={onSelectAll}
          onUnselectAll={onUncheckSelected}
          selectedAll={
            tileIds.length > 0 && tileIds.every((id) => selectedImages.includes(id))
          }
          selectedSome={selectedImages.length > 0}
          sidecarCount={allSidecarIds.length}
          selectedSidecarCount={selectedSidecarCount}
          onToggleAllSidecars={onToggleAllSidecars}
        />
        <AlbumContent
          uploadService={uploadService}
          showUploader={showUploader}
          isUploading={isUploading}
          isDownloading={isDownloading}
          isLoadingThumbnails={isLoadingThumbnails}
          downloadProgress={downloadProgress}
          onUploadStarted={() => setIsUploading(true)}
          onUploadFinished={() => setIsUploading(false)}
          onDownloadAll={(files: string[]) => onDownloadAll(files)}
          thumbnailGroups={thumbnailGroups}
          view={view}
          onChangeView={changeView}
          onRenameBatch={(batchId, name) => renameBatch(batchId, name)}
          onUploaded={(uploaded) =>
            setLoadedThumbnail(uploaded.fileId, {
              url: uploaded.thumbnail,
              iv: uploaded.thumbnailIv,
            })
          }
          selectedImages={selectedImages}
          isSelected={isSelected}
          areSidecarsSelected={areSidecarsSelected}
          onToggleSidecars={onToggleSidecars}
          onSelect={onSelect}
          onDeSelect={onDeSelect}
          onOpen={onOpen}
        />
        <Toolbar
          isBusy={isDownloading || isUploading}
          selectedImages={selectedImages}
          onDeleteSelected={onDeleteSelected}
          onUncheckSelected={onUncheckSelected}
          onDownloadSelected={onDownloadSelected}
        />
      </Container>
    </ThumbnailVisibilityProvider>
  );
}

const Container = styled("div", {
  width: "100%",
  minHeight: "100vh",
  fontFamily: "Open Sans",
  display: "flex",
  flexDirection: "column",
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "rgba(51, 51, 51)",
      },
      false: {
        backgroundColor: "#181818",
      },
    },
  },
});
