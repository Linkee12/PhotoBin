import { useMemo } from "react";
import { useParams } from "react-router";
import { listVisitedAlbums } from "../../../services/visitedAlbums";
import { AlbumPlaceholderProvider } from "../hooks/useAlbumContext";
import { ThumbnailGroup } from "../utils/groupFiles";
import { readStoredView } from "../utils/viewStore";
import { AlbumContent } from "./AlbumContent";
import { AlbumFooter, AlbumFrame } from "./AlbumFrame";
import { Header } from "./Header";

/** Tiles shown for an album this browser has not opened before. */
const UNKNOWN_COUNT = 6;
/** Enough to fill any screen; the rest of a big album appears below the fold. */
const MAX_TILES = 30;

const noop = () => undefined;

/**
 * The album page while its metadata loads and decrypts. It is the page's own
 * components (header, wave, toolbar, group band, tiles) with placeholders in
 * them, not a look-alike, so nothing moves when the album replaces it. What
 * this browser remembers from the last visit (title, photo count, expiry)
 * makes it closer still: an album known to be empty shows the empty layout.
 * Inert: nothing in it can be clicked.
 */
export function AlbumSkeleton() {
  const { albumId = "" } = useParams();
  const remembered = useMemo(
    () => listVisitedAlbums().find((album) => album.albumId === albumId),
    [albumId],
  );
  const count = Math.min(remembered?.itemCount ?? UNKNOWN_COUNT, MAX_TILES);
  const groups = useMemo(() => placeholderGroups(count), [count]);
  const tileIds = useMemo(
    () => groups.flatMap((group) => group.thumbnails.map((tile) => tile.id)),
    [groups],
  );
  const isEmptyAlbum = groups.length === 0;

  return (
    <AlbumPlaceholderProvider albumId={albumId} expiresAt={remembered?.expiresAt ?? null}>
      <div inert role="status" aria-busy="true" aria-label="Loading the album">
        <AlbumFrame isEmptyAlbum={isEmptyAlbum}>
          <Header
            isLoading
            isEmptyAlbum={isEmptyAlbum}
            title={remembered?.title ?? ""}
            onChangeTitle={noop}
            onSaveName={noop}
            onSelectAll={noop}
            onUnselectAll={noop}
            selectedAll={false}
            selectedSome={false}
            sidecarCount={0}
            selectedSidecarCount={0}
            onToggleAllSidecars={noop}
          />
          <AlbumContent
            showUploader={isEmptyAlbum}
            isUploading={false}
            isDownloading={false}
            isLoadingThumbnails={false}
            downloadProgress={0}
            thumbnailGroups={groups}
            tileIds={tileIds}
            view={readStoredView()}
            onChangeView={noop}
            onRenameBatch={noop}
            selectedImages={NO_SELECTION}
            isSelected={never}
            areSidecarsSelected={never}
            onToggleSidecars={noop}
            onSelect={noop}
            onDeSelect={noop}
            onOpen={noop}
            onDownloadAll={noop}
            onUploadStarted={noop}
            onUploadFinished={noop}
            onUploaded={noop}
          />
          <AlbumFooter
            onRefreshThumbnails={noop}
            isRefreshingThumbnails={false}
            onDeleteAlbum={noop}
            isDeletingAlbum={false}
          />
        </AlbumFrame>
      </div>
    </AlbumPlaceholderProvider>
  );
}

const NO_SELECTION: string[] = [];
const never = () => false;

/** One group of `count` loading tiles; the text is only there to size the placeholder bars. */
function placeholderGroups(count: number): ThumbnailGroup[] {
  if (count === 0) return [];
  return [
    {
      key: "placeholder",
      title: "Uploads",
      meta: `00/00 00:00 · ${count} photos`,
      batchId: undefined,
      isPlaceholder: true,
      thumbnails: Array.from({ length: count }, (_, i) => ({
        id: `placeholder-${i}`,
        thumbnail: undefined,
        isLoading: true,
        name: "",
        isVideo: false,
        sidecars: [],
      })),
    },
  ];
}
