import { styled } from "../../stitches.config";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { client } from "../../cuple";
import { Footer, FOOTER_HEIGHT } from "../../components/Footer";
import { pressableNoScale } from "../../pressable";
import { forgetVisitedAlbum } from "../../services/visitedAlbums";
import { DeleteAlbumDialog } from "./components/DeleteAlbumDialog";
import { SelectionBar } from "./components/SelectionBar";
import { Header } from "./components/Header";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { AlbumContent } from "./components/AlbumContent";
import { useAlbumContext } from "./hooks/useAlbumContext";
import { useSelection } from "./hooks/useSelection";
import { useThumbnails } from "./hooks/useThumbnails";
import { ThumbnailVisibilityProvider } from "./hooks/useThumbnailVisibility";
import { downloadService, uploadService } from "./services";
import {
  ALBUM_VIEWS,
  AlbumView,
  DEFAULT_ALBUM_VIEW,
  groupFiles,
} from "./utils/groupFiles";

const VIEW_STORAGE_KEY = "photobin:albumView";
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

export default function Album() {
  const { metadata, key, refreshMetadata, decodedValues } = useAlbumContext();
  const { albumId } = useParams();
  const navigate = useNavigate();
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const [isDeleteAlbumOpen, setDeleteAlbumOpen] = useState(false);
  const [isDeletingAlbum, setDeletingAlbum] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<AlbumView>(readStoredView);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const files = useMemo(() => metadata?.files ?? [], [metadata]);

  // Thumbnails are loaded (or announced by an upload) per file; the grouped
  // view is derived from metadata + that map, so switching views is free.
  const thumbnails = useThumbnails({ albumId, key, files });
  const thumbnailGroups = useMemo(
    () =>
      groupFiles({
        files,
        decodedFiles: decodedValues.files,
        decodedBatches: decodedValues.batches,
        thumbnails: thumbnails.thumbnailUrls,
        view,
      }),
    [files, decodedValues, thumbnails.thumbnailUrls, view],
  );
  const tileIds = useMemo(
    () => thumbnailGroups.flatMap((group) => group.thumbnails.map((tile) => tile.id)),
    [thumbnailGroups],
  );
  const selection = useSelection(thumbnailGroups);
  const isEmptyAlbum = thumbnailGroups.length === 0;
  const isLoadingThumbnails = files.length > 0 && isEmptyAlbum;
  const showUploader = (metadata !== undefined && files.length === 0) || isUploading;

  useEffect(() => {
    setTitle(decodedValues.albumName);
  }, [decodedValues.albumName]);

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
    for (const thumb of eager) thumbnails.loader.request(thumb.id);
  }, [files, thumbnails.loader]);

  function changeView(next: AlbumView) {
    setView(next);
    storeView(next);
  }

  async function deleteImages(ids: string[]) {
    if (albumId === undefined) return;
    const response = await client.deleteImages.delete({ body: { albumId, ids } });
    if (response.result !== "success") {
      toast.error("Failed to delete");
      return;
    }
    thumbnails.dropThumbnails(ids);
    selection.deselect(ids);
    refreshMetadata();
  }

  /** Confirms, then deletes `ids` exactly as given. */
  function confirmAndDelete(ids: string[]) {
    if (!window.confirm(selection.deleteQuestion(ids))) return;
    deleteImages(ids).catch((reason) => {
      console.error(reason);
      toast.error("Failed to delete");
    });
  }

  /** One delete at a time: a second confirm while the first is in flight is ignored. */
  async function deleteAlbum() {
    if (albumId === undefined || isDeletingAlbum) return;
    setDeletingAlbum(true);
    try {
      const response = await client.deleteAlbum.delete({ body: { albumId } });
      if (response.result !== "success") throw new Error(response.message);
      forgetVisitedAlbum(albumId);
      navigate("/");
      toast.success("Album deleted");
    } finally {
      setDeletingAlbum(false);
    }
  }

  async function runDownload(imageIds: string[]) {
    if (metadata === undefined) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadService.download({
        albumId: metadata.albumId,
        albumName: decodedValues.albumName,
        files: metadata.files,
        key,
        selectedImages: imageIds,
        onProgress: setDownloadProgress,
      });
    } catch (e) {
      console.error(e);
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }

  const onOpen = useCallback((id: string) => {
    setFullscreenImage({ fileId: id });
    setShowOrigin(true);
  }, []);

  /** Steps the viewer to the next/previous tile, wrapping around; sidecars have no tile. */
  function showNeighbour(direction: number) {
    const currentIdx = tileIds.findIndex((id) => id === fullscreenImage?.fileId);
    const nextIdx = (currentIdx + direction + tileIds.length) % tileIds.length;
    setFullscreenImage({ fileId: tileIds[nextIdx] });
  }

  function saveAlbumName() {
    if (metadata === undefined) return;
    uploadService.saveName(metadata.albumId, title, key).catch((e) => {
      console.error(e);
      toast.error("Failed to rename the album");
    });
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

  const viewed = fullscreenImage && selection.index.tiles.get(fullscreenImage.fileId);
  return (
    <ThumbnailVisibilityProvider value={thumbnails.visibility}>
      <Container isEmptyAlbum={isEmptyAlbum}>
        {viewed && (
          <ViewOriginalModal
            fileId={viewed.id}
            visible={showOrigin}
            thumbnails={thumbnailGroups}
            fileName={decodedValues.files[viewed.id]?.name ?? ""}
            onShowChange={setShowOrigin}
            onNext={showNeighbour}
            // "Delete this photo and its attachments", not "delete the selection".
            onDelete={() => deleteImages(selection.withSidecars([viewed.id]))}
            isSelected={selection.isSelected(viewed.id)}
            onToggleSelect={() => selection.toggle(viewed.id)}
            sidecars={viewed.sidecars}
            areSidecarsSelected={selection.areSidecarsSelected(viewed.id)}
            onToggleSidecars={() => selection.toggleSidecars(viewed.id)}
          />
        )}
        <Header
          isEmptyAlbum={isEmptyAlbum}
          title={title}
          onChangeTitle={setTitle}
          onSaveName={saveAlbumName}
          onSelectAll={selection.selectAll}
          onUnselectAll={selection.clear}
          selectedAll={selection.selectedAll}
          selectedSome={selection.selectedSome}
          sidecarCount={selection.sidecarCount}
          selectedSidecarCount={selection.selectedSidecarCount}
          onToggleAllSidecars={selection.toggleAllSidecars}
        />
        <AlbumContent
          showUploader={showUploader}
          isUploading={isUploading}
          isDownloading={isDownloading}
          isLoadingThumbnails={isLoadingThumbnails}
          downloadProgress={downloadProgress}
          onUploadStarted={() => setIsUploading(true)}
          onUploadFinished={() => setIsUploading(false)}
          // "Download all" takes every tile's sidecars along.
          onDownloadAll={() => void runDownload(selection.withSidecars(tileIds))}
          thumbnailGroups={thumbnailGroups}
          tileIds={tileIds}
          view={view}
          onChangeView={changeView}
          onRenameBatch={renameBatch}
          onUploaded={(uploaded) =>
            thumbnails.setLoadedThumbnail(uploaded.fileId, {
              url: uploaded.thumbnail,
              iv: uploaded.thumbnailIv,
            })
          }
          selectedImages={selection.selectedImages}
          isSelected={selection.isSelected}
          areSidecarsSelected={selection.areSidecarsSelected}
          onToggleSidecars={selection.toggleSidecars}
          onSelect={selection.select}
          onDeSelect={selection.deselect}
          onOpen={onOpen}
        />
        <SelectionBar
          isBusy={isDownloading || isUploading}
          selectedCount={selection.selectedImages.length}
          onDeleteSelected={() => confirmAndDelete(selection.selectedImages)}
          onUncheckSelected={selection.clear}
          onDownloadSelected={() => void runDownload(selection.selectedImages)}
        />
        <Footer>
          {/* An upload finishing after the delete would recreate nothing (the
              server refuses writes into a missing album), but it would still
              fail noisily: keep the two apart. */}
          <FooterLink
            type="button"
            disabled={isUploading || isDeletingAlbum}
            title={isUploading ? "Wait for the upload to finish" : undefined}
            onClick={() => setDeleteAlbumOpen(true)}
          >
            Delete this album
          </FooterLink>
        </Footer>
        <DeleteAlbumDialog
          open={isDeleteAlbumOpen}
          title={title}
          onClose={() => setDeleteAlbumOpen(false)}
          onConfirm={() => {
            deleteAlbum().catch((error: unknown) => {
              console.error(error);
              toast.error("Failed to delete the album");
            });
          }}
        />
      </Container>
    </ThumbnailVisibilityProvider>
  );
}

const Container = styled("div", {
  width: "100%",
  minHeight: "100vh",
  boxSizing: "border-box",
  // Room for the footer, which is anchored to this box.
  position: "relative",
  paddingBottom: FOOTER_HEIGHT,
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

/** A quiet text link; the footer's only content. */
const FooterLink = styled("button", {
  ...pressableNoScale,
  background: "none",
  border: "none",
  padding: "0.5rem",
  fontFamily: "inherit",
  fontSize: "0.85rem",
  color: "#8B8B8B",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  "&:hover:not(:disabled)": { color: "#fff" },
});
