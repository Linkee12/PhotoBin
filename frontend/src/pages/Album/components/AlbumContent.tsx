import { styled, TOOLBAR_INLINE_QUERY } from "../../../stitches.config";
import { Cloud, DropHint } from "@assets/images/cloud";
import { DragNdrop } from "./DragNdrop";
import { AlbumSection } from "./AlbumSection";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { useGridPinch } from "../hooks/useGridPinch";
import { useLongPressSelect } from "../hooks/useLongPressSelect";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useSwallowNextClick } from "../hooks/useSwallowNextClick";
import { Uploaded, useUploadRun } from "../hooks/useUploadRun";
import { ThumbnailGroup } from "../utils/groupFiles";
import { readStoredColumns, storeColumns } from "../utils/columnsStore";
import { clampColumns } from "../utils/pinchGrid";
import { Panel } from "./Panel";
import { pressable, pressableNoScale } from "../../../pressable";
import {
  SHEET_BAR_HEIGHT,
  SUN_CENTER_BELOW_HEADER,
  SUN_X,
  sunBackground,
  TOOLBAR_HEIGHT,
} from "../layout";
import { AlbumToolbar } from "./AlbumToolbar";
import { formatBytesPair } from "../../../utils/formatBytes";
import { AlbumView } from "../utils/groupFiles";

/** Fade of the upload indicator and mask once the batch is done. */
const OUTRO_MS = 300;

type AlbumContentProps = {
  showUploader: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  isLoadingThumbnails: boolean;
  downloadProgress: number;
  thumbnailGroups: ThumbnailGroup[];
  /** Every tile in grid order (the long-press range runs along it). */
  tileIds: readonly string[];
  view: AlbumView;
  onChangeView: (view: AlbumView) => void;
  onRenameBatch: (batchId: string, name: string) => void;

  // selection
  selectedImages: string[];
  isSelected: (imageId: string) => boolean;
  /** Whether every sidecar (RAW) of the tile is selected. */
  areSidecarsSelected: (imageId: string) => boolean;
  /** (De)selects the tile's sidecars, leaving the photo's own selection alone. */
  onToggleSidecars: (imageId: string) => void;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;
  onDownloadAll: () => void;
  onUploadStarted: () => void;
  onUploadFinished: () => void;
  /** A file finished uploading; its thumbnail is known before metadata lists it. */
  onUploaded: (uploaded: Uploaded) => void;
};

export function AlbumContent(props: AlbumContentProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  // Tiles per row, once the user has pinched the grid; `null` is the CSS auto
  // layout. The count is remembered per orientation, so turning the phone
  // swaps to the count pinched in that orientation. The scroll position that
  // keeps the pinched tile in place is applied after the grid has been relaid
  // with the new count.
  const orientation = useMediaQuery("(orientation: portrait)") ? "portrait" : "landscape";
  const [columns, setColumns] = useState<number | null>(() =>
    readStoredColumns(orientation),
  );
  useEffect(() => setColumns(readStoredColumns(orientation)), [orientation]);
  const pendingScrollTop = useRef<number | null>(null);
  const onPinchCommit = useCallback(
    (next: number, scrollTop: number) => {
      pendingScrollTop.current = scrollTop;
      storeColumns(orientation, next);
      // Called from an animation frame, where React would otherwise render in a
      // later task and the browser could paint the plain grid in between.
      flushSync(() => setColumns(next));
    },
    [orientation],
  );
  useLayoutEffect(() => {
    if (pendingScrollTop.current === null) return;
    window.scrollTo({ top: pendingScrollTop.current, behavior: "auto" });
    pendingScrollTop.current = null;
  }, [columns]);
  const hasGroups = props.thumbnailGroups.length > 0;
  // Both gestures swallow the click that follows their release.
  const swallow = useSwallowNextClick();
  const pinch = useGridPinch({
    enabled: hasGroups,
    columns,
    onCommit: onPinchCommit,
    onOpen: props.onOpen,
    swallowNextClick: swallow.arm,
  });
  // A remembered count may not fit this window (pinched on a wider one, or
  // the desktop window was resized): once a grid is laid out, keep the count
  // within the ladder the pinch itself uses.
  useLayoutEffect(() => {
    if (columns === null) return;
    const images = pinch.ref.current?.querySelector<HTMLElement>("[data-images]");
    if (!images) return;
    const gap = parseFloat(getComputedStyle(images).columnGap) || 0;
    const fitted = clampColumns(columns, {
      width: images.getBoundingClientRect().width,
      gap,
    });
    if (fitted !== columns) setColumns(fitted);
  }, [columns, orientation, hasGroups, pinch.ref]);
  const longPress = useLongPressSelect({
    containerRef: pinch.ref,
    tileIds: props.tileIds,
    enabled: hasGroups,
    isSelected: props.isSelected,
    onSelect: props.onSelect,
    onDeselect: props.onDeSelect,
    swallowNextClick: swallow.arm,
  });
  // Where the toolbar is the wide shelf, the first group's header shares its
  // row (rendered into this slot); otherwise it heads its own band.
  const toolbarInline = useMediaQuery(TOOLBAR_INLINE_QUERY);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const { metadata, refreshMetadata, key, isEncrypted } = useAlbumContext();
  const run = useUploadRun({
    albumId: metadata?.albumId,
    key,
    isUploading: props.isUploading,
    onUploadStarted: props.onUploadStarted,
    onUploadFinished: props.onUploadFinished,
    onUploaded: props.onUploaded,
    refreshMetadata,
  });
  const { phase, failedFiles, newFileIds } = run;
  function uploadImages(files: File[]) {
    run.upload(files).catch((e) => console.error(e));
  }
  // A group that receives freshly uploaded tiles opens so the pulse is visible.
  useEffect(() => {
    if (newFileIds.length === 0) return;
    const receiving = props.thumbnailGroups
      .filter((group) => group.thumbnails.some((thumb) => newFileIds.includes(thumb.id)))
      .map((group) => group.key);
    if (!receiving.some((key) => collapsedGroups.has(key))) return;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      for (const key of receiving) next.delete(key);
      return next;
    });
  }, [newFileIds, props.thumbnailGroups]);
  function renameHandler(batchId: string | undefined) {
    if (batchId === undefined) return undefined;
    return (name: string) => props.onRenameBatch(batchId, name);
  }
  function toggleCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }
  function openFilePicker() {
    ref.current?.click();
  }
  const hasFailedFiles = failedFiles.length > 0;
  let cloudText = "Drop photos here";
  if (props.isUploading) cloudText = "Preparing your photos";
  else if (hasFailedFiles)
    cloudText = `${failedFiles.length} of your files didn't upload`;
  return (
    <Panel variant={0} zIndex={1}>
      {props.thumbnailGroups.length > 0 && (
        <SunAnchor aria-hidden="true">
          <PanelSun />
        </SunAnchor>
      )}
      <DragNdrop
        onDroppedFiles={(files) => {
          if (files != null) uploadImages(Array.from(files));
        }}
      >
        {/* Drop hero / upload indicator / retry notice, before the toolbar so the
            first group's band still overlaps the toolbar shelf, not this. */}
        <CloudSlot>
          <CloudContainer
            placement={props.showUploader ? "floating" : "inline"}
            isVisible={props.showUploader || hasFailedFiles}
            isFadingOut={phase === "outro"}
            onClick={openFilePicker}
          >
            <StyledUpload
              progress={run.shownPercent}
              active={phase !== "idle"}
              encrypted={isEncrypted}
            />
            {run.bytes ? (
              <UploadStats>
                <Percent>{run.shownPercent}%</Percent>
                <Bytes>{formatBytesPair(run.bytes.uploaded, run.bytes.total)}</Bytes>
              </UploadStats>
            ) : (
              <Text>
                {cloudText}
                {!props.isUploading && !hasFailedFiles && (
                  <TextHint>or click to browse</TextHint>
                )}
              </Text>
            )}
            {phase === "uploading" && (
              <UploadAction
                onClick={(e) => {
                  e.stopPropagation();
                  run.cancel();
                }}
              >
                Cancel upload
              </UploadAction>
            )}
            {phase === "idle" && hasFailedFiles && (
              <UploadAction
                onClick={(e) => {
                  e.stopPropagation();
                  run.retryFailed().catch((e) => console.error(e));
                }}
              >
                Retry failed uploads ({failedFiles.length})
              </UploadAction>
            )}
          </CloudContainer>
        </CloudSlot>
        {props.thumbnailGroups.length > 0 && (
          <AlbumToolbar
            headerSlotRef={setHeaderSlot}
            onDownloadAll={props.onDownloadAll}
            onAddPhoto={openFilePicker}
            isBusy={props.isUploading || props.isDownloading}
            view={props.view}
            onChangeView={props.onChangeView}
          />
        )}
        <AlbumSections
          ref={pinch.ref}
          {...pinch.handlers}
          {...swallow.handlers}
          onContextMenu={longPress.onContextMenu}
        >
          <PinchOverlay ref={pinch.overlayRef} aria-hidden="true" />
          {props.thumbnailGroups.map((group, i) => (
            <AlbumSection
              key={group.key}
              group={group}
              index={i}
              isCollapsed={collapsedGroups.has(group.key)}
              onToggleCollapsed={() => toggleCollapsed(group.key)}
              onRename={renameHandler(group.batchId)}
              headerSlot={i === 0 && toolbarInline ? headerSlot : null}
              newFileIds={newFileIds}
              selectedImages={props.selectedImages}
              isSelected={props.isSelected}
              areSidecarsSelected={props.areSidecarsSelected}
              onToggleSidecars={props.onToggleSidecars}
              onSelect={props.onSelect}
              onDeSelect={props.onDeSelect}
              onOpen={props.onOpen}
              columns={columns}
            />
          ))}
          {props.isLoadingThumbnails && (
            <LoadingThumbnails>
              <Spinner />
            </LoadingThumbnails>
          )}
        </AlbumSections>
        <UploadMask show={phase === "uploading" || phase === "done"} />
        <DownloadMask show={props.isDownloading}>
          <DownloadText>Preparing your files</DownloadText>
          {props.downloadProgress > 0 && (
            <DownloadPercent>{props.downloadProgress}%</DownloadPercent>
          )}
        </DownloadMask>
        <UploadSection isEmpty={props.thumbnailGroups.length > 0}>
          <input
            type="file"
            style={{ display: "none" }}
            ref={ref}
            multiple
            onChange={(e) => {
              if (e.target.files == null) return;
              const picked = Array.from(e.target.files);
              // Reset so picking the same file again (to resume it) fires onChange.
              e.target.value = "";
              uploadImages(picked);
            }}
          ></input>
        </UploadSection>
      </DragNdrop>
    </Panel>
  );
}

/**
 * Cancel / retry, part of the cloud block right under the stats so it can
 * never collide with the indicator. Same pill as the toolbar buttons.
 */
const UploadAction = styled("button", {
  marginTop: "1rem",
  display: "flex",
  alignItems: "center",
  background: "#0e0e0e",
  color: "#fff",
  border: "solid 2px #333333",
  borderRadius: "1.5rem",
  height: "2.5rem",
  padding: "0.5rem 1.2rem",
  fontFamily: "Open Sans",
  fontSize: "0.7rem",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  ...pressable,
  "&:hover": {
    borderColor: "#8B8B8B",
  },
});

const UploadSection = styled("div", {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  variants: {
    isEmpty: {
      true: {
        background: "#333333",
      },
      false: {
        background: "#181818",
      },
    },
  },
});

const AlbumSections = styled("div", {
  display: "flex",
  flexDirection: "column",
  // Two fingers pinch the grid (useGridPinch), a long press selects
  // (useLongPressSelect); one finger still scrolls the page.
  touchAction: "pan-y",
});

/** Darkens the album under the tile growing to full screen; opacity is driven by the pinch. */
const PinchOverlay = styled("div", {
  position: "fixed",
  inset: 0,
  background: "#000",
  opacity: 0,
  pointerEvents: "none",
  zIndex: 5,
});

const LoadingThumbnails = styled("div", {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "4rem",
});

const Spinner = styled("div", {
  width: "3rem",
  height: "3rem",
  border: "5px solid rgba(255, 255, 255, 0.2)",
  borderTop: "5px solid #DBDCD9",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
});

/** Centres the cloud block; the floating variant takes its horizontal position from here. */
/**
 * The lower part of the header's sun (`Header`): the disc and its glow set
 * behind whatever the panel starts with — the sheet handle, the toolbar shelf
 * and water, or the first group's band — all of which paint above it. Without
 * it the disc would be cut flat at the header's edge. It ends with the toolbar
 * row (the section bodies below are painted under it, so the glow must not
 * reach them); an empty album has no toolbar and lets the glow fade out.
 */
const SunAnchor = styled("div", {
  position: "relative",
  width: "100%",
  height: 0,
});
const PanelSun = styled("div", {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 0,
  pointerEvents: "none",
  "@toolbarInline": {
    height: TOOLBAR_HEIGHT,
    backgroundImage: sunBackground("transparent", SUN_X.inline, SUN_CENTER_BELOW_HEADER),
  },
  "@toolbarStacked": {
    height: `calc(${SHEET_BAR_HEIGHT} * 2)`,
    backgroundImage: sunBackground("transparent", SUN_X.stacked, SUN_CENTER_BELOW_HEADER),
  },
});

const CloudSlot = styled("div", {
  display: "flex",
  justifyContent: "center",
  width: "100%",
});

// The container is the click target (see CloudContainer); the cloud answers.
const StyledUpload = styled(Cloud, {
  width: "12rem",
  height: "12rem",
  color: "#333333",
  cursor: "pointer",
  transition: "color 300ms, transform 0.15s ease",
  [`&:hover ${DropHint}`]: {
    strokeOpacity: 0.55,
  },
  "&:hover": {
    color: "#3d3d3d",
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

const CloudContainer = styled("div", {
  flexDirection: "column",
  alignItems: "center",
  ...pressableNoScale,
  [`&:hover ${StyledUpload}`]: { color: "#3d3d3d", transform: "scale(1.03)" },
  [`&:hover ${DropHint}`]: { strokeOpacity: 0.55 },
  [`&:active ${StyledUpload}`]: { transform: "scale(0.98)" },
  "&:focus-visible": { outline: "none" },
  [`&:focus-visible ${StyledUpload}`]: { color: "#3d3d3d" },
  transition: `opacity ${OUTRO_MS}ms ease-out`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
  variants: {
    placement: {
      // Hero of an empty album, and the progress indicator over the dimmed album.
      floating: {
        position: "absolute",
        top: "18rem",
        // Above the upload mask, which comes later in the DOM.
        zIndex: 2,
      },
      // After failures in a filled album: in flow above the toolbar, about
      // where the floating indicator was.
      inline: {
        position: "static",
        padding: "3rem 1rem 1.5rem",
      },
    },
    isVisible: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
    isFadingOut: {
      true: {
        opacity: 0,
        pointerEvents: "none",
      },
      false: {
        opacity: 1,
      },
    },
  },
});

const Text = styled("div", {
  textAlign: "center",
  width: "14rem",
  fontFamily: "Open Sans",
  fontSize: "1rem",
  marginTop: "0.75rem",
  color: "#DBDCD9",
});

const TextHint = styled("div", {
  fontSize: "0.8rem",
  color: "#8B8B8B",
  marginTop: "0.15rem",
});

const UploadStats = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "0.75rem",
  fontFamily: "Open Sans",
  fontVariantNumeric: "tabular-nums",
});

const Percent = styled("div", {
  fontSize: "1.6rem",
  fontWeight: 600,
  lineHeight: 1.1,
  color: "#F2F2F0",
});

const Bytes = styled("div", {
  fontSize: "0.8rem",
  color: "#8B8B8B",
  marginTop: "0.25rem",
  whiteSpace: "nowrap",
});

const UploadMask = styled("div", {
  position: "fixed",
  top: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0,0.5)",
  transition: `opacity ${OUTRO_MS}ms ease-out`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
  variants: {
    show: {
      true: {
        opacity: 1,
      },
      false: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
});
const DownloadMask = styled("div", {
  position: "fixed",
  top: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "2rem",
  fontWeight: "bold",
  fontFamily: "Open Sans",
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0,0.5)",
  variants: {
    show: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
  },
});
const DownloadText = styled("div", {});
const DownloadPercent = styled("div", {
  fontSize: "1.5rem",
  color: "#DBDCD9",
});
