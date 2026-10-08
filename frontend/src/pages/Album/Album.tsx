import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchCuple } from "@cuple/client";
import { useAction } from "@cuple/react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { client } from "../../cuple";
import { forgetVisitedAlbum } from "../../services/visitedAlbums";
import { DeleteAlbumDialog } from "./components/DeleteAlbumDialog";
import { SaveToGooglePhotosDialog } from "./components/SaveToGooglePhotosDialog";
import { guardUnload } from "../../utils/guardUnload";
import { offerDownload } from "./components/SaveDownloadToast";
import { SelectionBar } from "./components/SelectionBar";
import { Header } from "./components/Header";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { AlbumContent } from "./components/AlbumContent";
import { AlbumLiveUpdates } from "./components/AlbumLiveUpdates";
import { ALBUM_REFRESH, useAlbumContext } from "./hooks/useAlbumContext";
import { useSelection } from "./hooks/useSelection";
import { useThumbnails } from "./hooks/useThumbnails";
import { ThumbnailVisibilityProvider } from "./hooks/useThumbnailVisibility";
import { downloadService, imageQueryService, uploadService } from "./services";
import {
  APPEND_ONLY_SCOPE,
  forgetAccessToken,
  isGooglePhotosEnabled,
  loadGoogleIdentity,
  requestAccessToken,
} from "./services/googlePhotos/googleAuth";
import { GooglePhotosError } from "./services/googlePhotos/googlePhotosApi";
import { saveToGooglePhotos } from "./services/googlePhotos/saveToGooglePhotos";
import { AlbumView, groupFiles } from "./utils/groupFiles";
import { readStoredView, storeView } from "./utils/viewStore";
import { AlbumFooter, AlbumFrame } from "./components/AlbumFrame";
import { useThumbnailRefresh } from "./hooks/useThumbnailRefresh";

/** Tiles requested as soon as the album opens, before the grid is laid out. */
const EAGER_THUMBNAILS = 12;

export default function Album() {
  const { albumId, metadata, key, refreshMetadata, decodedValues } = useAlbumContext();
  const navigate = useNavigate();
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const [isDeleteAlbumOpen, setDeleteAlbumOpen] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<AlbumView>(readStoredView);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isSavingToGoogle, setIsSavingToGoogle] = useState(false);
  /** The selection the save dialog asks about; `null` while it is closed. */
  const [saveToGoogleIds, setSaveToGoogleIds] = useState<string[] | null>(null);
  const files = metadata.files;

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
  const thumbnailRefresh = useThumbnailRefresh({
    albumId,
    key,
    files,
    onFinished: refreshMetadata,
  });
  const isEmptyAlbum = thumbnailGroups.length === 0;
  const isLoadingThumbnails = files.length > 0 && isEmptyAlbum;
  const showUploader = files.length === 0 || isUploading;

  useEffect(() => {
    setTitle(decodedValues.albumName);
  }, [decodedValues.albumName]);

  // Google's sign-in popup must open straight from a click: have its script ready.
  useEffect(() => {
    if (!isGooglePhotosEnabled) return;
    loadGoogleIdentity().catch((e) => console.error(e));
  }, []);

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

  // A failed write is a toast; the album stays on screen.
  const deleteImagesAction = useAction(
    (ids: string[]) =>
      fetchCuple(client.deleteImages.delete, {
        body: { albumId, ids },
      }).thenKeepSuccess(),
    { refresh: ALBUM_REFRESH, config: notifyAs("Couldn't delete") },
  );
  async function deleteImages(ids: string[]) {
    const state = await deleteImagesAction.run(ids);
    if (state.status !== "done") return;
    thumbnails.dropThumbnails(ids);
    selection.deselect(ids);
  }

  /** Confirms, then deletes `ids` exactly as given. */
  function confirmAndDelete(ids: string[]) {
    if (!window.confirm(selection.deleteQuestion(ids))) return;
    deleteImages(ids);
  }

  // Set before the request: our own delete must not read as someone else's.
  const deletingAlbumRef = useRef(false);
  const deleteAlbumAction = useAction(
    () => fetchCuple(client.deleteAlbum.delete, { body: { albumId } }).thenKeepSuccess(),
    { config: notifyAs("Couldn't delete the album") },
  );
  const isDeletingAlbum = deleteAlbumAction.isPending;
  /** One delete at a time: a second confirm while the first is in flight is ignored. */
  async function deleteAlbum() {
    if (isDeletingAlbum) return;
    deletingAlbumRef.current = true;
    const state = await deleteAlbumAction.run();
    if (state.status !== "done") {
      deletingAlbumRef.current = false;
      return;
    }
    forgetVisitedAlbum(albumId);
    navigate("/");
    toast.success("Album deleted");
  }

  /** Someone else deleted the album while it was open. */
  function onAlbumDeleted() {
    if (deletingAlbumRef.current) return;
    forgetVisitedAlbum(albumId);
    navigate("/not-found", { replace: true });
    toast.info("This album was just deleted");
  }

  async function runDownload(imageIds: string[]) {
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      const zip = await downloadService.download({
        albumId: metadata.albumId,
        albumName: decodedValues.albumName,
        files: metadata.files,
        key,
        selectedImages: imageIds,
        onProgress: setDownloadProgress,
      });
      offerDownload([zip]);
    } catch (e) {
      console.error(e);
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }

  /**
   * Decrypts the selection and adds it to a new album in the user's Google
   * Photos. Called straight from the click: the sign-in popup needs it.
   */
  function runSaveToGooglePhotos(imageIds: string[]) {
    if (isDownloading) return;
    const token = requestAccessToken(APPEND_ONLY_SCOPE);
    // Leaving mid-save would leave a half-filled album in Google Photos.
    const releaseUnloadGuard = guardUnload();
    setIsDownloading(true);
    setIsSavingToGoogle(true);
    setDownloadProgress(0);
    token
      .then((token) =>
        saveToGooglePhotos(imageQueryService, {
          token,
          albumId: metadata.albumId,
          albumName: decodedValues.albumName,
          files: metadata.files,
          key,
          fileIds: imageIds,
          onProgress: setDownloadProgress,
        }),
      )
      .then(({ saved, total }) => {
        if (saved === total) toast.success(`Saved ${saved} to Google Photos`);
        else toast.warn(`Saved ${saved} of ${total} to Google Photos`);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (e instanceof GooglePhotosError && e.status === 401) {
          forgetAccessToken(APPEND_ONLY_SCOPE);
        }
        toast.error(
          e instanceof Error
            ? `Google Photos: ${e.message}`
            : "Saving to Google Photos failed",
        );
      })
      .finally(() => {
        releaseUnloadGuard();
        setIsDownloading(false);
        setIsSavingToGoogle(false);
        setDownloadProgress(0);
      });
  }

  const onOpen = useCallback((id: string) => {
    setFullscreenImage({ fileId: id });
    setShowOrigin(true);
  }, []);

  /** The tiles one step from the viewed one, wrapping around; sidecars have no tile. */
  const neighbourIds = useMemo((): { prev?: string; next?: string } => {
    const index = fullscreenImage ? tileIds.indexOf(fullscreenImage.fileId) : -1;
    if (index === -1 || tileIds.length < 2) return {};
    const at = (step: number) =>
      tileIds[(index + step + tileIds.length) % tileIds.length];
    return { prev: at(-1), next: at(1) };
  }, [fullscreenImage, tileIds]);

  // The viewer previews the neighbours' grid thumbnails while swiping; the
  // wrap-around neighbour is rarely on screen, so ask for them ahead.
  useEffect(() => {
    for (const id of [neighbourIds.prev, neighbourIds.next]) {
      if (id !== undefined) thumbnails.loader.request(id, "front");
    }
  }, [neighbourIds, thumbnails.loader]);

  /** Steps the viewer to the next/previous tile. */
  function showNeighbour(direction: number) {
    const id = direction > 0 ? neighbourIds.next : neighbourIds.prev;
    if (id !== undefined) setFullscreenImage({ fileId: id });
  }

  const saveAlbumNameAction = useAction(
    (name: string) => uploadService.saveName(albumId, name, key),
    { refresh: ALBUM_REFRESH, config: notifyAs("Couldn't rename the album") },
  );
  function saveAlbumName() {
    if (title === decodedValues.albumName) return;
    saveAlbumNameAction.run(title);
  }
  // Refreshed whatever happened: a failed rename puts the old name back.
  const renameBatchAction = useAction(
    (batchId: string, name: string) =>
      uploadService.renameBatch(albumId, batchId, name, key),
    { refresh: ALBUM_REFRESH, config: notifyAs("Couldn't rename") },
  );
  function renameBatch(batchId: string, name: string) {
    renameBatchAction.run(batchId, name);
  }

  const viewed = fullscreenImage && selection.index.tiles.get(fullscreenImage.fileId);
  return (
    <ThumbnailVisibilityProvider value={thumbnails.visibility}>
      <AlbumLiveUpdates
        albumId={albumId}
        onChanged={refreshMetadata}
        onDeleted={onAlbumDeleted}
      />
      <AlbumFrame isEmptyAlbum={isEmptyAlbum}>
        {viewed && (
          <ViewOriginalModal
            fileId={viewed.id}
            visible={showOrigin}
            thumbnails={thumbnailGroups}
            neighbourIds={neighbourIds}
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
          downloadLabel={isSavingToGoogle ? "Saving to Google Photos" : undefined}
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
          onSaveToGooglePhotos={
            isGooglePhotosEnabled
              ? () => setSaveToGoogleIds(selection.selectedImages)
              : undefined
          }
        />
        <AlbumFooter
          onRefreshThumbnails={thumbnailRefresh.refresh}
          isRefreshingThumbnails={thumbnailRefresh.isRefreshing}
          onDeleteAlbum={() => setDeleteAlbumOpen(true)}
          isDeletingAlbum={isDeletingAlbum}
          busy={
            isUploading || isDownloading
              ? "Wait for the upload or download to finish"
              : undefined
          }
        />
        <SaveToGooglePhotosDialog
          count={saveToGoogleIds?.length ?? null}
          onClose={() => setSaveToGoogleIds(null)}
          onConfirm={() => {
            if (saveToGoogleIds !== null) runSaveToGooglePhotos(saveToGoogleIds);
            setSaveToGoogleIds(null);
          }}
        />
        <DeleteAlbumDialog
          open={isDeleteAlbumOpen}
          title={title}
          onClose={() => setDeleteAlbumOpen(false)}
          onConfirm={() => void deleteAlbum()}
        />
      </AlbumFrame>
    </ThumbnailVisibilityProvider>
  );
}

/** Action config: an error nobody handled is a toast saying what failed, and the page stays. */
function notifyAs(what: string) {
  return {
    errors: {
      onError: "notify" as const,
      notify: (error: { message: string }) => toast.error(`${what}: ${error.message}`),
    },
  };
}
