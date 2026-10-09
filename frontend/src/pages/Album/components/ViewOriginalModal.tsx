import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";
import Next from "@assets/images/icons/next.svg?react";
import Prev from "@assets/images/icons/prev.svg?react";
import Rotate from "@assets/images/icons/rotate.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import Circle from "@assets/images/icons/circle.svg?react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "../../../components/Spinner";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { drawnSize, useZoomPan } from "../hooks/useZoomPan";
import { useViewerMedia } from "../hooks/useViewerMedia";
import { rotatedFitScale, useOptimisticRotation } from "../hooks/useOptimisticRotation";
import { imageQueryService } from "../services";
import { downloadFileName, downloadPart } from "../services/renditions";
import { Sidecar, ThumbnailGroup } from "../utils/groupFiles";
import { flyToTile, shownPicture } from "../utils/flyToTile";
import { PINCH_SETTLE_MS } from "../utils/pinchClose";
import { noticeCard } from "../../../components/notifications";
import { extensionLabel, sidecarLabel, sidecarTitle } from "../utils/sidecars";
import { SWIPE_ANIMATION_MS } from "../utils/swipeStrip";
import { prefersReducedMotion } from "../../../utils/reducedMotion";
import { SavedFile } from "../../../utils/saveBlob";
import { offerDownload } from "./SaveDownloadToast";
import { pressable, pressableNoScale } from "../../../pressable";

type Size = { width: number; height: number };

const NOTICE_TIMEOUT_MS = 4000;
const ROTATE_ANIMATION_MS = 200;
/**
 * The bottom band of a video where the browser draws its controls; a drag that
 * starts there scrubs the timeline and must not swipe to the next photo.
 */
const VIDEO_CONTROLS_PX = 72;

/** What the viewer's download button saves: the photo in one of its renditions, its attached files, or both. */
type DownloadChoice = { photo?: "rotated" | "original"; sidecars?: boolean };
type DownloadMenuItem = { label: string; choice: DownloadChoice };

/**
 * The download menu's entries. Rotated photos offer both renditions; a photo
 * with attached files (RAW) offers them alone and together with the photo.
 */
function downloadMenuItems(
  fileName: string,
  isRotated: boolean,
  sidecars: Sidecar[],
): DownloadMenuItem[] {
  const photo = extensionLabel(fileName);
  const items: DownloadMenuItem[] = isRotated
    ? [
        { label: `Download rotated ${photo}`, choice: { photo: "rotated" } },
        { label: `Download original ${photo}`, choice: { photo: "original" } },
      ]
    : [{ label: `Download ${photo}`, choice: { photo: "rotated" } }];
  if (sidecars.length > 0) {
    const raw = sidecarLabel(sidecars);
    items.push(
      { label: `Download ${raw}`, choice: { sidecars: true } },
      {
        label: `Download ${photo} + ${raw}`,
        choice: { photo: "rotated", sidecars: true },
      },
    );
  }
  return items;
}

/** The thumbnail URL the grid shows for `fileId`, if it has one. */
function gridThumbnail(groups: ThumbnailGroup[], fileId: string): string | undefined {
  for (const group of groups) {
    const thumb = group.thumbnails.find((t) => t.id === fileId);
    if (thumb) return thumb.thumbnail;
  }
  return undefined;
}

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  fileName: string;
  thumbnails: ThumbnailGroup[];
  /** The tiles `onNext(-1)` / `onNext(1)` would show; their thumbnails slide in with a swipe. */
  neighbourIds: { prev?: string; next?: string };
  onNext: (direction: number) => void;
  onDelete: () => void;
  onShowChange: (visible: boolean) => void;
  /** whether the shown photo is part of the album selection */
  isSelected: boolean;
  /** (de)selects the shown photo, same as tapping its tile's ring */
  onToggleSelect: () => void;
  /** the unsupported files attached to the shown photo (its RAW) */
  sidecars: Sidecar[];
  areSidecarsSelected: boolean;
  /** (de)selects the sidecars on their own, same as tapping the tile's badge */
  onToggleSidecars: () => void;
};

export function ViewOriginalModal(props: ViewOriginalModalProps) {
  const { albumId, metadata, key, refreshMetadata } = useAlbumContext();
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Size>(viewportSize);
  const file = metadata.files.find((file) => file.fileId === props.fileId);
  const isImage = file?.original !== undefined && file.originalVideo === undefined;
  const isRotated = isImage && (file.rotation ?? 0) !== 0 && file.edited !== undefined;

  // The zoom transform goes on a layer around the image (`targetRef`), the
  // rotation transform on the image itself, so neither overwrites the other.
  const rotation = useOptimisticRotation({
    fileId: props.fileId,
    file,
    albumId,
    key,
    onSaved: refreshMetadata,
    onNotice: setNotice,
    onTurn: () => zoom.reset(),
  });
  const media = useViewerMedia({
    fileId: props.fileId,
    file,
    albumId,
    key,
    gridThumbnail: gridThumbnail(props.thumbnails, props.fileId),
    onImageSwapped: rotation.onImageSwapped,
  });
  // Until the new photo's own image is in, the turns still belong to the previous one.
  const shownTurns = media.isSwitching ? 0 : rotation.cssTurns;
  const fitScale = rotatedFitScale(media.naturalSize, viewport, shownTurns);

  // The swipe strip and the pinch-to-close fade are written straight to the
  // DOM, once per pointer event, like the zoom transform itself.
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonBarRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  function moveStrip(offset: number, animate: boolean) {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transition =
      animate && !prefersReducedMotion()
        ? `transform ${SWIPE_ANIMATION_MS}ms ease-out`
        : "none";
    strip.style.transform = `translateX(${offset}px)`;
  }
  /**
   * How far the viewer has faded away under a pinch: 0 is fully there, 1 is
   * gone. `animate` eases there (the fingers lifted and the picture springs back).
   */
  const fadedRef = useRef(0);
  function fadeViewer(t: number, animate: boolean) {
    fadedRef.current = t;
    const container = containerRef.current;
    const bar = buttonBarRef.current;
    if (!container || !bar) return;
    const ease = animate && !prefersReducedMotion();
    container.style.transition = ease
      ? `background-color ${PINCH_SETTLE_MS}ms ease-out`
      : "none";
    container.style.backgroundColor = `rgba(0, 0, 0, ${1 - t})`;
    bar.style.transition = ease ? `opacity ${PINCH_SETTLE_MS}ms ease-out` : "none";
    bar.style.opacity = `${1 - t}`;
  }

  const zoom = useZoomPan({
    resetKey: props.fileId,
    enabled: props.visible,
    zoomable: isImage,
    pictureSize: (image) => {
      const drawn = drawnSize(image);
      // A quarter turn swaps the drawn edges and applies the fit scale.
      return shownTurns % 2 === 0
        ? drawn
        : { width: drawn.height * fitScale, height: drawn.width * fitScale };
    },
    canGoPrev: props.neighbourIds.prev !== undefined,
    canGoNext: props.neighbourIds.next !== undefined,
    onSwipeOffset: moveStrip,
    onSwipe: (direction) => goTo(direction),
    onPinchProgress: fadeViewer,
    onPinchClose: () => close(),
  });
  const isZoomed = zoom.isZoomed;

  // The new photo is in place (its thumbnail, where the neighbour was): the
  // strip goes back to the middle before the frame is painted.
  useLayoutEffect(() => {
    moveStrip(0, false);
  }, [props.fileId, props.visible]);

  useEffect(() => {
    if (notice === null) return;
    const id = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    const onResize = () => setViewport(viewportSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function close() {
    rotation.flush();
    // The photo flies back into its tile from wherever it is drawn now
    // (zoomed, turned or half pinched away); a placeholder has nothing to fly.
    const picture = zoom.imageRef.current;
    if (picture && picture.naturalWidth > 1) {
      flyToTile({
        fileId: props.fileId,
        src: picture.currentSrc || picture.src,
        from: shownPicture(
          picture.getBoundingClientRect(),
          { width: picture.naturalWidth, height: picture.naturalHeight },
          shownTurns,
        ),
        quarterTurns: shownTurns,
        backdropOpacity: 1 - fadedRef.current,
      });
    }
    fadeViewer(0, false);
    props.onShowChange(false);
  }

  function goTo(direction: number) {
    rotation.flush();
    props.onNext(direction);
  }

  /**
   * Saves the photo (`rotated`: the edited rendition when there is one) and/or
   * its attached files (RAW), each as its own download.
   */
  async function downloadImage(what: DownloadChoice) {
    if (!metadata || !file || isPreparingDownload) return;
    setIsPreparingDownload(true);
    try {
      const targets = [
        ...(what.photo === undefined ? [] : [{ file, photo: what.photo }]),
        ...(what.sidecars ? props.sidecars : [])
          .map((sidecar) => metadata.files.find((f) => f.fileId === sidecar.id))
          .filter((f) => f !== undefined)
          .map((f) => ({ file: f, photo: "rotated" as const })),
      ];
      const ready: SavedFile[] = [];
      for (const target of targets) {
        const type = downloadPart(target.file, target.photo);
        const result = await imageQueryService.getImg(
          metadata.albumId,
          target.file,
          key,
          type,
        );
        if (result)
          ready.push({
            blob: result.blob,
            name: downloadFileName(type, result.fileName),
          });
      }
      // Saved together: one share sheet on iOS for the photo and its RAW.
      offerDownload(ready);
    } catch (e) {
      console.error(e);
      setNotice("Download failed, please try again");
    } finally {
      setIsPreparingDownload(false);
    }
  }

  useEffect(() => {
    const body = document.body;
    if (props.visible) {
      body.style.height = "100vh";
      body.style.overflow = "hidden";
    }
    return () => {
      body.style.height = "auto";
      body.style.overflow = "unset";
    };
  }, [props.visible]);

  const onToggleSelectRef = useRef(props.onToggleSelect);
  onToggleSelectRef.current = props.onToggleSelect;

  useEffect(() => {
    if (!props.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        onToggleSelectRef.current();
      } else if (isZoomed) {
        // The user is panning a zoomed image, leave the arrow keys alone.
        return;
      } else if (e.key === "ArrowRight") {
        goTo(1);
      } else if (e.key === "ArrowLeft") {
        goTo(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.visible, props.onShowChange, props.onNext, isZoomed]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const imageTransform = {
    transform: `rotate(${shownTurns * 90}deg) scale(${fitScale})`,
    transition: rotation.animateTurn ? `transform ${ROTATE_ANIMATION_MS}ms ease` : "none",
  };

  const prevThumbnail =
    props.neighbourIds.prev && gridThumbnail(props.thumbnails, props.neighbourIds.prev);
  const nextThumbnail =
    props.neighbourIds.next && gridThumbnail(props.thumbnails, props.neighbourIds.next);

  return (
    <Container ref={containerRef} isVisible={props.visible} onClick={close}>
      {/* Selection on the left; the file's actions, one pill, and close on the right. */}
      <ButtonBar ref={buttonBarRef}>
        <ButtonGroup onClick={stop}>
          <SelectButton
            type="button"
            isSelected={props.isSelected}
            aria-pressed={props.isSelected}
            title={props.isSelected ? "Deselect" : "Select"}
            onClick={() => props.onToggleSelect()}
          >
            <SelectIcon as={props.isSelected ? Check : Circle} aria-hidden="true" />
            <SelectLabel>{props.isSelected ? "Selected" : "Select"}</SelectLabel>
          </SelectButton>
          {props.sidecars.length > 0 && (
            <SelectButton
              type="button"
              isSelected={props.areSidecarsSelected}
              aria-pressed={props.areSidecarsSelected}
              title={sidecarTitle(props.sidecars, props.areSidecarsSelected)}
              onClick={() => props.onToggleSidecars()}
            >
              <SelectIcon
                as={props.areSidecarsSelected ? Check : Circle}
                aria-hidden="true"
              />
              <SidecarLabel>{sidecarLabel(props.sidecars)}</SidecarLabel>
            </SelectButton>
          )}
        </ButtonGroup>
        <ButtonGroup onClick={stop}>
          <ActionPill role="toolbar" aria-label="Photo actions">
            <PillButton
              type="button"
              title="Delete"
              aria-label="Delete"
              onClick={() => {
                if (!window.confirm("Delete this photo? This cannot be undone.")) {
                  return;
                }
                props.onShowChange(!props.visible);
                props.onDelete();
              }}
            >
              <PillIcon as={Trash} aria-hidden="true" />
            </PillButton>
            {isImage ? (
              <ImageActions
                fileName={media.fileName}
                sidecars={props.sidecars}
                isRotated={isRotated}
                isPreparingDownload={isPreparingDownload}
                onDownload={downloadImage}
                onRotate={rotation.rotate}
              />
            ) : (
              <PillButton
                type="button"
                disabled={!media.download}
                onClick={() => media.download && offerDownload([media.download])}
                title={
                  media.download ? `Download ${media.fileName}` : "Preparing download..."
                }
                aria-label="Download"
              >
                <PillIcon as={SimpleCloud} aria-hidden="true" />
              </PillButton>
            )}
          </ActionPill>
          <CloseButton type="button" title="Close" aria-label="Close" onClick={close}>
            <PillIcon as={Exit} aria-hidden="true" />
          </CloseButton>
        </ButtonGroup>
      </ButtonBar>
      <StatusArea>
        {notice && <Notice role="status">{notice}</Notice>}
        {rotation.isSaving && (
          <SavingStatus role="status">
            <SyncIcon viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" />
              <path d="M17.7 2.4v4h-4M6.3 21.6v-4h4" />
            </SyncIcon>
            Saving…
          </SavingStatus>
        )}
      </StatusArea>
      <NextButton
        isZoomed={isZoomed}
        style={{ left: "0px" }}
        onClick={(e) => {
          e.stopPropagation();
          goTo(-1);
        }}
      >
        <Icons as={Prev} />
      </NextButton>
      <ZoomWrapper ref={zoom.wrapperRef} isZoomed={isZoomed} {...zoom.handlers}>
        {/* The shown file in the middle, its neighbours' thumbnails one screen to each side. */}
        <SwipeStrip ref={stripRef}>
          <Slot>
            {prevThumbnail && <NeighbourImg src={prevThumbnail} draggable={false} />}
          </Slot>
          <Slot>
            {file?.thumbnail ? (
              <ZoomLayer ref={zoom.targetRef}>
                <ZoomableImg
                  ref={zoom.imageRef}
                  src={media.shownUrl}
                  draggable={false}
                  style={imageTransform}
                />
                {media.videoUrl && (
                  <FullScreenVideo
                    src={media.videoUrl}
                    autoPlay
                    muted
                    loop
                    controls
                    // iOS only autoplays inline videos.
                    playsInline
                    onClick={stop}
                    onPointerDown={(e) => {
                      // Scrubbing the timeline is not a swipe.
                      const { bottom } = e.currentTarget.getBoundingClientRect();
                      if (e.clientY > bottom - VIDEO_CONTROLS_PX) e.stopPropagation();
                    }}
                  />
                )}
                {media.isLoadingVideo && (
                  <LoadingOverlay>
                    <Spinner css={{ color: "#fff" }} />
                  </LoadingOverlay>
                )}
              </ZoomLayer>
            ) : (
              // A layer of its own too, so a pinch can shrink it away like a photo.
              <ZoomLayer ref={zoom.targetRef}>
                <UnsupportedFile>
                  <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
                </UnsupportedFile>
                {media.unsupportedVideoUrl && (
                  // A video stored without a poster; covers the name if it plays.
                  <FullScreenVideo
                    key={media.unsupportedVideoUrl}
                    src={media.unsupportedVideoUrl}
                    opaque
                    controls
                    playsInline
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    onPointerDown={(e) => {
                      const { bottom } = e.currentTarget.getBoundingClientRect();
                      if (e.clientY > bottom - VIDEO_CONTROLS_PX) e.stopPropagation();
                    }}
                  />
                )}
              </ZoomLayer>
            )}
          </Slot>
          <Slot>
            {nextThumbnail && <NeighbourImg src={nextThumbnail} draggable={false} />}
          </Slot>
        </SwipeStrip>
      </ZoomWrapper>
      <NextButton
        isZoomed={isZoomed}
        style={{ right: "0px" }}
        onClick={(e) => {
          e.stopPropagation();
          goTo(1);
        }}
      >
        <Icons as={Next} />
      </NextButton>
    </Container>
  );
}

function ImageActions(props: {
  fileName: string;
  sidecars: Sidecar[];
  isRotated: boolean;
  isPreparingDownload: boolean;
  onDownload: (what: DownloadChoice) => void;
  onRotate: () => void;
}) {
  const items = downloadMenuItems(props.fileName, props.isRotated, props.sidecars);
  return (
    <>
      <PillButton
        type="button"
        onClick={() => props.onRotate()}
        title="Rotate 90° clockwise"
        aria-label="Rotate 90° clockwise"
      >
        <PillIcon as={Rotate} aria-hidden="true" />
      </PillButton>
      {items.length > 1 ? (
        <DownloadMenu
          items={items}
          disabled={props.isPreparingDownload}
          onDownload={props.onDownload}
        />
      ) : (
        <PillButton
          type="button"
          disabled={props.isPreparingDownload}
          onClick={() => props.onDownload(items[0].choice)}
          title={`Download ${props.fileName}`}
          aria-label="Download"
        >
          <PillIcon as={SimpleCloud} aria-hidden="true" />
        </PillButton>
      )}
    </>
  );
}

function DownloadMenu(props: {
  items: DownloadMenuItem[];
  disabled: boolean;
  onDownload: (what: DownloadChoice) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
    items()[0]?.focus();
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Handled here (capture phase) so the modal itself does not close too.
        e.stopPropagation();
        setIsOpen(false);
        return;
      }
      const list = items();
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        list[(idx + step + list.length) % list.length]?.focus();
      } else if (e.key === "Tab" && idx !== -1) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [isOpen]);

  return (
    <MenuWrap ref={wrapRef}>
      <PillButton
        type="button"
        disabled={props.disabled}
        onClick={() => props.onDownload(props.items[0].choice)}
        title={props.items[0].label}
        aria-label={props.items[0].label}
      >
        <PillIcon as={SimpleCloud} aria-hidden="true" />
      </PillButton>
      <ChevronButton
        type="button"
        disabled={props.disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More download options"
        title="More download options"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Chevron viewBox="0 0 10 6" aria-hidden="true" isOpen={isOpen}>
          <path d="M1 1l4 4 4-4" />
        </Chevron>
      </ChevronButton>
      {isOpen && (
        <Menu ref={menuRef} role="menu" aria-label="Download">
          {props.items.map((item) => (
            <MenuItem
              key={item.label}
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                props.onDownload(item.choice);
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </MenuWrap>
  );
}

const Container = styled("div", {
  display: "flex",
  position: "fixed",
  top: "0",
  justifyContent: "center",
  width: "100%",
  height: "100vh",
  backgroundColor: "#000",
  zIndex: 9,
  variants: {
    isVisible: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
  },
});
// The gesture surface. It has no background of its own: the container's is the
// backdrop that fades away under a pinch.
const ZoomWrapper = styled("div", {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  overflow: "hidden",
  touchAction: "none",
  userSelect: "none",
  variants: {
    isZoomed: {
      true: { cursor: "grab" },
      false: { cursor: "default" },
    },
  },
});
// Three screens side by side — previous, shown, next — moved as one by a swipe
// (written outside React, like the zoom transform).
const SwipeStrip = styled("div", {
  position: "absolute",
  top: 0,
  left: "-100%",
  width: "300%",
  height: "100vh",
  display: "flex",
  willChange: "transform",
});
const Slot = styled("div", {
  position: "relative",
  width: "calc(100% / 3)",
  height: "100vh",
  flexShrink: 0,
});
const NeighbourImg = styled("img", {
  display: "block",
  width: "100%",
  height: "100vh",
  objectFit: "contain",
});
// Receives the zoom/pan transform from `useZoomPan` (written outside React).
const ZoomLayer = styled("div", {
  width: "100%",
  height: "100vh",
  transformOrigin: "center",
  willChange: "transform",
});
// The image box is constant (the whole viewport) so the thumbnail is drawn into
// the same box the reduced image will occupy and the swap causes no layout jump.
// Its own transform carries the optimistic rotation.
const ZoomableImg = styled("img", {
  display: "block",
  width: "100%",
  height: "100vh",
  // Its own layer, so the zoom transform above scales a cached raster instead
  // of re-rasterizing (or re-decoding) the full picture every frame.
  willChange: "transform",
  objectFit: "contain",
  transformOrigin: "center center",
});
const FullScreenVideo = styled("video", {
  display: "block",
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  objectFit: "contain",
  zIndex: 2,
  // Its letterbox shows the backdrop, which a pinch fades away like a photo's;
  // the poster under it is the same frame in the same place.
  variants: {
    // Without a poster it has to hide the file name behind it.
    opaque: { true: { backgroundColor: "#000" } },
  },
});
const Icons = styled("svg", {
  height: "1.5rem",
  width: "2rem",
  color: "#fff",
});
const PILL_HEIGHT = "2.5rem";
const HOVER = "@media (hover: hover)";
// Every control of the bar is a dark pill floating over the picture (see
// artwork/design.svg, viewer page), so it reads on a bright photo as well.
const pillSurface = {
  ...pressable,
  height: PILL_HEIGHT,
  borderRadius: PILL_HEIGHT,
  border: "none",
  background: "rgba(26, 26, 26, 0.8)",
  color: "#fff",
  userSelect: "none",
  // Over the picture: the pill stays dark and lightens a step on hover (not
  // after a tap, where the hover would stick).
  [HOVER]: { "&:hover:not(:disabled)": { background: "rgba(70, 70, 70, 0.9)" } },
  "&:active:not(:disabled)": { background: "rgba(95, 95, 95, 0.95)" },
} as const;
// Ring + "Select" while unselected, check + "Selected" once selected.
const SelectButton = styled("button", {
  ...pillSurface,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0 0.9rem 0 0.6rem",
  fontFamily: "Open Sans",
  fontSize: "0.9rem",
  whiteSpace: "nowrap",
  variants: {
    isSelected: {
      true: {
        background: "rgba(26, 26, 26, 0.95)",
        fontWeight: 600,
        [HOVER]: { "&:hover:not(:disabled)": { background: "rgba(70, 70, 70, 0.95)" } },
      },
      false: {},
    },
  },
  "@narrow": {
    // Icon only (the RAW pill keeps its extension), so the bar fits a phone.
    padding: "0 0.55rem",
  },
});
const SelectIcon = styled("svg", {
  width: "1.4rem",
  height: "1.4rem",
  flexShrink: 0,
});
const SelectLabel = styled("span", {
  "@narrow": { display: "none" },
});
// The attached file's extension; always shown, it is what the pill is about.
const SidecarLabel = styled("span", {
  fontSize: "0.75rem",
  letterSpacing: "0.05em",
});
// The file's actions share one pill; each is a round hover target inside it.
const ActionPill = styled("div", {
  display: "flex",
  alignItems: "center",
  height: PILL_HEIGHT,
  padding: "0 0.25rem",
  borderRadius: PILL_HEIGHT,
  background: "rgba(26, 26, 26, 0.8)",
});
const PillButton = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "2.25rem",
  height: "2.25rem",
  padding: 0,
  borderRadius: "50%",
  border: "none",
  background: "none",
  color: "#fff",
  [HOVER]: { "&:hover:not(:disabled)": { backgroundColor: "rgba(255, 255, 255, 0.14)" } },
  "&:active:not(:disabled)": { backgroundColor: "rgba(255, 255, 255, 0.24)" },
});
const PillIcon = styled("svg", {
  width: "1.3rem",
  height: "1.3rem",
  color: "#fff",
});
// Close stands apart from the actions: a round pill of its own at the corner.
const CloseButton = styled("button", {
  ...pillSurface,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: PILL_HEIGHT,
  padding: 0,
});
const ButtonBar = styled("div", {
  boxSizing: "border-box",
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.5rem",
  position: "absolute",
  top: 0,
  padding: "calc(10px + env(safe-area-inset-top)) 10px 0",
  // The gap between the groups belongs to the picture (swipe, close on click).
  pointerEvents: "none",
  "& > *": { pointerEvents: "auto" },
  // Above the (invisible) prev/next buttons so the download menu stays clickable.
  zIndex: "4",
});
const ButtonGroup = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minWidth: 0,
});
// Notices and the rotation's "Saving…", centred under the bar.
const StatusArea = styled("div", {
  position: "absolute",
  top: `calc(10px + env(safe-area-inset-top) + ${PILL_HEIGHT} + 0.75rem)`,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.5rem",
  pointerEvents: "none",
  zIndex: 3,
});
const SavingStatus = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  height: "2rem",
  padding: "0 0.9rem",
  borderRadius: "1rem",
  background: "rgba(26, 26, 26, 0.8)",
  color: "rgba(255, 255, 255, 0.75)",
  fontFamily: "Open Sans",
  fontSize: "0.85rem",
  whiteSpace: "nowrap",
  userSelect: "none",
});
const SyncIcon = styled("svg", {
  width: "1rem",
  height: "1rem",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  animation: "spin 1.2s linear infinite",
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});
const MenuWrap = styled("div", {
  position: "relative",
  display: "flex",
  alignItems: "center",
});
// Split button: the cloud saves the first (default) entry, the chevron opens the rest.
const ChevronButton = styled(PillButton, {
  width: "1.25rem",
  marginLeft: "-0.25rem",
  borderRadius: "0.625rem",
});
const Chevron = styled("svg", {
  width: "0.6rem",
  height: "0.4rem",
  fill: "none",
  stroke: "#fff",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  transition: "transform 0.15s ease",
  variants: {
    isOpen: {
      true: { transform: "rotate(180deg)" },
      false: {},
    },
  },
});
// Opens under the pill, aligned to its right so it stays on a phone's screen.
const Menu = styled("div", {
  position: "absolute",
  top: "calc(100% + 0.5rem)",
  right: "-0.25rem",
  minWidth: "11rem",
  padding: "0.25rem",
  borderRadius: "0.75rem",
  backgroundColor: "rgba(26, 26, 26, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
  display: "flex",
  flexDirection: "column",
  zIndex: 4,
});
const MenuItem = styled("button", {
  ...pressableNoScale,
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.5rem",
  background: "none",
  border: "none",
  color: "#fff",
  fontFamily: "Open Sans",
  fontSize: "0.9rem",
  whiteSpace: "nowrap",
  "&:hover, &:focus-visible": {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    outline: "none",
  },
  "&:active": { backgroundColor: "rgba(255, 255, 255, 0.2)" },
});
// A notice like every other, under the viewer's button bar.
const Notice = styled("div", {
  ...noticeCard,
  paddingRight: "1rem",
});
const NextButton = styled("button", {
  display: "flex",
  // Touch screens swipe instead; the buttons would swallow a swipe starting near an edge.
  "@media (hover: none)": { display: "none" },
  justifyContent: "center",
  alignItems: "center",
  width: "20%",
  height: "90%",
  top: "3rem",
  position: "absolute",
  opacity: "0",
  bottom: "0px",
  zIndex: 3,
  border: "none",
  background: "none",
  cursor: "pointer",
  "&:hover, &:focus-visible": {
    opacity: "1",
    outline: "none",
  },
  "&:active": { opacity: "1", filter: "brightness(0.7)" },
  transition: "opacity 0.5s, filter 0.15s",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  variants: {
    isZoomed: {
      // While zoomed the whole screen is used for panning.
      true: { pointerEvents: "none" },
      false: {},
    },
  },
});

const LoadingOverlay = styled("div", {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  backgroundColor: "rgba(0, 0, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
});
const UnsupportedFile = styled("div", {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  backgroundImage: "linear-gradient(black 0%, #404040 10%, #404040 90%, black 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
});
const UnsupportedFileName = styled("p", {
  fontFamily: "Open Sans",
  fontSize: "1.7rem",
});
