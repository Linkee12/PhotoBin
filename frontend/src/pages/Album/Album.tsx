import { styled } from "../../stitches.config";
import { useEffect, useMemo, useState } from "react";
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
import { Metadata } from "../../../../backend/src/services/MetadataService";
import { AlbumContent } from "./components/AlbumContent";
import { toast } from "react-toastify";

export type { Thumbnail, ThumbnailGroup } from "../../utils/groupFiles";

const imageResizeService = new CanvasService();
const cryptoService = new CryptoService();
const uploadService = new UploadService(imageResizeService, cryptoService);
const imageQueryService = new ImageQueryService(cryptoService);
const downloadService = new DownloadService(imageQueryService);

const VIEW_STORAGE_KEY = "photobin:albumView";

/** A loaded thumbnail: its object URL and the iv of the part it was made from. */
type LoadedThumbnail = { url: string | undefined; iv: string | undefined };

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
  const isEmptyAlbum = thumbnailGroups.length === 0;
  const isLoadingThumbnails = files.length > 0 && isEmptyAlbum;
  const showUploader = (metadata !== undefined && files.length === 0) || isUploading;

  useEffect(() => {
    setTitle(decodedValues.albumName);
  }, [decodedValues.albumName]);

  useEffect(() => {
    if (metadata === undefined || albumId === undefined) return;
    let cancelled = false;
    // A changed thumbnail iv means the part was replaced server-side (e.g.
    // rotation) and must be refetched.
    const stale = metadata.files.filter((file) => {
      const loaded = thumbnails.get(file.fileId);
      return loaded === undefined || loaded.iv !== file.thumbnail?.iv;
    });
    const loadThumbnails = async () => {
      for await (const thumb of getThumbnails(stale)) {
        if (cancelled) {
          revokeIfBlob(thumb.url);
          break;
        }
        setLoadedThumbnail(thumb.id, thumb);
      }
    };
    loadThumbnails().catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [metadata]);

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
    const count = selectedImages.length;
    const message =
      count === 1
        ? "Delete this photo? This cannot be undone."
        : `Delete ${count} photos? This cannot be undone.`;
    if (!window.confirm(message)) return;
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
    runDownload(imageIds).catch((e) => console.error(e));
  }

  function onUncheckSelected() {
    setSelectedImages([]);
  }
  function onSelectAll() {
    if (metadata?.files) {
      setSelectedImages(metadata?.files.map((file) => file.fileId));
    }
  }
  /** Same as tapping a tile's ring: the album enters selection mode on the first pick. */
  function toggleSelected(id: string) {
    setSelectedImages((selected) =>
      selected.includes(id)
        ? selected.filter((imgId) => imgId !== id)
        : [...selected, id],
    );
  }

  async function* getThumbnails(
    files: Metadata["files"],
  ): AsyncGenerator<LoadedThumbnail & { id: string }> {
    if (albumId === undefined) return;
    for (const file of files) {
      const result = await imageQueryService.getImg(
        albumId,
        file,
        key,
        file.thumbnail !== undefined ? "thumbnail" : "unsupportedFile",
      );
      if (result === undefined) return;
      yield { id: result.id, url: result.img, iv: file.thumbnail?.iv };
    }
  }
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
    <Container isEmptyAlbum={isEmptyAlbum}>
      {fullscreenImage && (
        <ViewOriginalModal
          fileId={fullscreenImage.fileId}
          visible={showOrigin}
          thumbnails={thumbnailGroups}
          fileName={decodedValues.files[fullscreenImage.fileId]?.name ?? ""}
          onShowChange={setShowOrigin}
          onNext={(direction) => nextOriginImgId(direction)}
          onDelete={() => deleteImages([fullscreenImage.fileId])}
          isSelected={selectedImages.includes(fullscreenImage.fileId)}
          onToggleSelect={() => toggleSelected(fullscreenImage.fileId)}
        />
      )}
      <Header
        isEmptyAlbum={isEmptyAlbum}
        title={title}
        onChangeTitle={setTitle}
        onSaveName={saveAlbumName}
        onSelectAll={onSelectAll}
        onUnselectAll={onUncheckSelected}
        selectedAll={selectedImages.length === metadata?.files.length}
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
        isSelected={(id) => selectedImages.includes(id)}
        onSelect={(id: string[]) => setSelectedImages([...selectedImages, ...id])}
        onDeSelect={(id: string[]) => {
          if (id) {
            setSelectedImages(selectedImages.filter((imgId) => !id.includes(imgId)));
          }
        }}
        onOpen={(id) => {
          setFullscreenImage({ fileId: id });
          setShowOrigin(true);
        }}
      />
      <Toolbar
        isBusy={isDownloading || isUploading}
        selectedImages={selectedImages}
        onDeleteSelected={onDeleteSelected}
        onUncheckSelected={onUncheckSelected}
        onDownloadSelected={onDownloadSelected}
      />
    </Container>
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
