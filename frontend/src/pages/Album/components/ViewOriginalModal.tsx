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
import { useAlbumContext } from "../hooks/useAlbumContext";
import { drawnSize, useZoomPan } from "../hooks/useZoomPan";
import { useViewerMedia } from "../hooks/useViewerMedia";
import { rotatedFitScale, useOptimisticRotation } from "../hooks/useOptimisticRotation";
import { imageQueryService } from "../services";
import { downloadFileName, downloadPart } from "../services/renditions";
import { Sidecar, ThumbnailGroup } from "../utils/groupFiles";
import { PINCH_SETTLE_MS } from "../utils/pinchClose";
import { extensionLabel, sidecarLabel, sidecarTitle } from "../utils/sidecars";
import { SWIPE_ANIMATION_MS } from "../utils/swipeStrip";
import { prefersReducedMotion } from "../../../utils/reducedMotion";
import { saveBlob } from "../../../utils/saveBlob";
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
  const { metadata, key, refreshMetadata } = useAlbumContext();
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Size>(viewportSize);
  const file = metadata?.files.find((file) => file.fileId === props.fileId);
  const isImage = file?.original !== undefined && file.originalVideo === undefined;
  const isRotated = isImage && (file.rotation ?? 0) !== 0 && file.edited !== undefined;

  // The zoom transform goes on a layer around the image (`targetRef`), the
  // rotation transform on the image itself, so neither overwrites the other.
  const rotation = useOptimisticRotation({
    fileId: props.fileId,
    file,
    albumId: metadata?.albumId,
    key,
    onSaved: refreshMetadata,
    onNotice: setNotice,
    onTurn: () => zoom.reset(),
  });
  const media = useViewerMedia({
    fileId: props.fileId,
    file,
    albumId: metadata?.albumId,
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
  function fadeViewer(t: number, animate: boolean) {
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
      for (const target of targets) {
        const type = downloadPart(target.file, target.photo);
        const result = await imageQueryService.getImg(
          metadata.albumId,
          target.file,
          key,
          type,
        );
        if (result) saveBlob(result.blob, downloadFileName(type, result.fileName));
      }
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
      <ButtonBar ref={buttonBarRef} onClick={stop}>
        <ButtonGroup>
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
          <Button
            onClick={() => {
              if (!window.confirm("Delete this photo? This cannot be undone.")) {
                return;
              }
              props.onShowChange(!props.visible);
              props.onDelete();
            }}
          >
            <Icons as={Trash} />
          </Button>
          {isImage ? (
            <ImageActions
              fileName={media.fileName}
              sidecars={props.sidecars}
              isRotated={isRotated}
              isRotating={rotation.isSaving}
              isPreparingDownload={isPreparingDownload}
              onDownload={downloadImage}
              onRotate={rotation.rotate}
            />
          ) : // eslint-disable-next-line sonarjs/no-nested-conditional
          media.downloadUrl ? (
            <Button
              as="a"
              style={{ padding: "0px" }}
              href={media.downloadUrl}
              download={media.fileName}
              title={`Download ${media.fileName}`}
            >
              <Icons as={SimpleCloud} />
            </Button>
          ) : (
            <Button as="button" disabled title="Preparing download...">
              <Icons as={SimpleCloud} style={{ opacity: 0.4 }} />
            </Button>
          )}
        </ButtonGroup>
        {notice && <Notice role="status">{notice}</Notice>}
        <Button onClick={close}>
          <Icons as={Exit} />
        </Button>
      </ButtonBar>
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
                    <Spinner />
                  </LoadingOverlay>
                )}
              </ZoomLayer>
            ) : (
              <UnsupportedFile>
                <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
              </UnsupportedFile>
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
  isRotating: boolean;
  isPreparingDownload: boolean;
  onDownload: (what: DownloadChoice) => void;
  onRotate: () => void;
}) {
  const iconStyle = { opacity: props.isPreparingDownload ? 0.4 : 1 };
  const items = downloadMenuItems(props.fileName, props.isRotated, props.sidecars);
  return (
    <>
      {items.length > 1 ? (
        <DownloadMenu
          fileName={props.fileName}
          items={items}
          disabled={props.isPreparingDownload}
          onDownload={props.onDownload}
        />
      ) : (
        <Button
          disabled={props.isPreparingDownload}
          onClick={() => props.onDownload(items[0].choice)}
          title={`Download ${props.fileName}`}
        >
          <Icons as={SimpleCloud} style={iconStyle} />
        </Button>
      )}
      <Button onClick={() => props.onRotate()} title="Rotate 90° clockwise">
        <Icons as={Rotate} />
      </Button>
      {props.isRotating && (
        <SavingStatus role="status">
          <SyncIcon viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" />
            <path d="M17.7 2.4v4h-4M6.3 21.6v-4h4" />
          </SyncIcon>
          Saving…
        </SavingStatus>
      )}
    </>
  );
}

function DownloadMenu(props: {
  fileName: string;
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
      <Button
        disabled={props.disabled}
        onClick={() => props.onDownload(props.items[0].choice)}
        title={props.items[0].label}
      >
        <Icons as={SimpleCloud} style={{ opacity: props.disabled ? 0.4 : 1 }} />
      </Button>
      <ChevronButton
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
  backgroundColor: "#000",
});
const Button = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  borderRadius: "1rem",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  // The bar is black already: a lighter pill shows the hover.
  "&:hover:not(:disabled)": {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  "&:active:not(:disabled)": {
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    transform: "scale(0.94)",
  },
  padding: "5px",
  fontSize: "2rem",
  background: "none",
  border: "none",
  margin: "10px",
});
const Icons = styled("svg", {
  height: "1.5rem",
  width: "2rem",
  color: "#fff",
});
// Pill at the left of the top bar (see artwork/design.svg, viewer page):
// ring + "Select" while unselected, check + "Selected" once selected.
const SelectButton = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  height: "2rem",
  margin: "10px",
  padding: "0 0.9rem 0 0.5rem",
  borderRadius: "1rem",
  border: "none",
  background: "rgba(26, 26, 26, 0.8)",
  color: "#fff",
  fontFamily: "Open Sans",
  fontSize: "0.9rem",
  whiteSpace: "nowrap",
  userSelect: "none",
  // Over the picture: the pill stays dark and lightens a step on hover.
  "&:hover": {
    background: "rgba(70, 70, 70, 0.9)",
  },
  "&:active": {
    background: "rgba(95, 95, 95, 0.95)",
  },
  variants: {
    isSelected: {
      true: {
        background: "rgba(26, 26, 26, 0.95)",
        fontWeight: 600,
        "&:hover": { background: "rgba(70, 70, 70, 0.95)" },
      },
      false: {},
    },
  },
  "@narrow": {
    // Icon only, so the trash / download / rotate buttons keep their room.
    padding: "0 0.5rem",
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
const ButtonBar = styled("div", {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  flex: 1,
  position: "absolute",
  top: "0px",
  // Above the (invisible) prev/next buttons so the download menu stays clickable.
  zIndex: "4",
});
const ButtonGroup = styled("div", {
  display: "flex",
});
const SavingStatus = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  alignSelf: "center",
  marginLeft: "0.25rem",
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
});
// Split button: the cloud saves the first (default) entry, the chevron opens the rest.
const ChevronButton = styled(Button, {
  width: "1.2rem",
  marginLeft: "-0.4rem",
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
const Menu = styled("div", {
  position: "absolute",
  top: "calc(100% - 4px)",
  left: "10px",
  minWidth: "11rem",
  padding: "0.25rem",
  borderRadius: "0.5rem",
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
  padding: "0.5rem 0.75rem",
  borderRadius: "0.35rem",
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
const Notice = styled("div", {
  position: "absolute",
  top: "3.5rem",
  left: "50%",
  transform: "translateX(-50%)",
  padding: "0.5rem 1rem",
  borderRadius: "0.5rem",
  backgroundColor: "rgba(26, 26, 26, 0.95)",
  color: "#fff",
  fontFamily: "Open Sans",
  fontSize: "0.9rem",
  whiteSpace: "nowrap",
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

const Spinner = styled("div", {
  width: "3rem",
  height: "3rem",
  border: "5px solid rgba(255, 255, 255, 0.3)",
  borderTop: "5px solid white",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
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
