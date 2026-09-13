import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";
import Next from "@assets/images/icons/next.svg?react";
import Prev from "@assets/images/icons/prev.svg?react";
import Rotate from "@assets/images/icons/rotate.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import Circle from "@assets/images/icons/circle.svg?react";
import { ImageQueryService } from "../services/ImageQueryService";
import { useEffect, useRef, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { CryptoService } from "../services/CryptoService";
import { CanvasService } from "../services/CanvasService";
import { editedFileName, RotateService, Rotation } from "../services/RotateService";
import { ThumbnailGroup } from "../Album";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { drawnSize, useZoomPan } from "../hooks/useZoomPan";
import { Sidecar } from "../../../utils/groupFiles";
import { extensionLabel, sidecarLabel, sidecarTitle } from "../../../utils/sidecars";
import { pressable, pressableNoScale } from "../../../pressable";
import { PartType } from "../services/ImageQueryService";

type AlbumFile = Metadata["files"][number];
type Size = { width: number; height: number };

const cryptoService = new CryptoService();
const canvasService = new CanvasService();
const imageDownloadService = new ImageQueryService(cryptoService);
const rotateService = new RotateService(
  canvasService,
  cryptoService,
  imageDownloadService,
);
const NOTICE_TIMEOUT_MS = 4000;
/** Clicks within this window are coalesced into a single rotation request. */
const ROTATE_DEBOUNCE_MS = 700;
const ROTATE_ANIMATION_MS = 200;
const REVOKE_DELAY_MS = 60_000;
const PLACEHOLDER_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

/** What the viewer's download button saves: the photo in one of its renditions, its attached files, or both. */
type DownloadChoice = { photo?: "rotated" | "original"; sidecars?: boolean };
type DownloadMenuItem = { label: string; choice: DownloadChoice };

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Chromium starts the download asynchronously; revoking right away can
  // make the blob fetch fail. Revoke once the download has certainly begun.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

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

/** Decodes `src` up front so swapping it into the <img> paints in the same frame. */
async function decodeImage(src: string): Promise<Size> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    // e.g. a GIF placeholder that cannot be decoded; fall through with whatever we have.
  }
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/**
 * Scale needed for an image that is shown with `object-fit: contain` in a
 * `viewport`-sized box to still fit after a quarter turn.
 */
function rotatedFitScale(natural: Size, viewport: Size, quarterTurns: number) {
  if (quarterTurns % 2 === 0) return 1;
  if (!natural.width || !natural.height) return 1;
  const fit = Math.min(viewport.width / natural.width, viewport.height / natural.height);
  const shownWidth = natural.width * fit;
  const shownHeight = natural.height * fit;
  return Math.min(1, viewport.width / shownHeight, viewport.height / shownWidth);
}

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Which part feeds the viewer for a photo. Small originals are uploaded without
 * a reduced rendition; a rotated photo always has one (rotation re-renders it),
 * so falling back to `original` only happens for unrotated photos. Returns the
 * rotation already baked into that part so the CSS turns can be derived.
 */
function viewerPart(file: AlbumFile): { type: PartType; rotation: Rotation } {
  if (file.reduced !== undefined)
    return { type: "reduced", rotation: file.rotation ?? 0 };
  if (file.edited !== undefined && (file.rotation ?? 0) !== 0)
    return { type: "edited", rotation: file.rotation ?? 0 };
  return { type: "original", rotation: 0 };
}

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  fileName: string;
  thumbnails: ThumbnailGroup[];
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
// eslint-disable-next-line sonarjs/cognitive-complexity
export function ViewOriginalModal(props: ViewOriginalModalProps) {
  const { metadata, key, refreshMetadata } = useAlbumContext();
  const [url, setUrl] = useState<string | undefined>(PLACEHOLDER_GIF);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const file = metadata?.files.find((file) => file.fileId === props.fileId);
  const isImage = file?.original !== undefined && file.originalVideo === undefined;
  const isRotated = isImage && (file.rotation ?? 0) !== 0 && file.edited !== undefined;

  // --- Optimistic rotation -------------------------------------------------
  // The displayed image is rotated with CSS immediately; the server is asked
  // once, after the clicks settle, to re-render at the final absolute rotation.
  /** Quarter turns applied with CSS on top of the image currently in `url`. */
  const [cssTurns, setCssTurns] = useState(0);
  /** Animate the CSS turn (clicks) or apply it instantly (image swap). */
  const [animateTurn, setAnimateTurn] = useState(false);
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Size>(viewportSize);
  /** Absolute rotation the user wants for the current file (server + unsent clicks). */
  const targetRotationRef = useRef<Rotation>(0);
  /** Rotation not yet sent to the server; at most one job, always for the latest target. */
  const pendingJobRef = useRef<{ file: AlbumFile; target: Rotation } | null>(null);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Rotations confirmed by the server since the last metadata refresh. */
  const serverRotationsRef = useRef(new Map<string, Rotation>());
  const shownFileIdRef = useRef<string | undefined>(undefined);
  const flushRotationRef = useRef<() => void>(() => undefined);
  /** Object URLs created here (reduced/edited/video/unsupported blobs), revoked when replaced. */
  const ownedUrlsRef = useRef(new Set<string>());

  // --- Zoom / pan ------------------------------------------------------------
  // The zoom transform goes on a layer around the image (`targetRef`), the
  // rotation transform on the image itself, so neither overwrites the other.
  const fitScale = rotatedFitScale(naturalSize, viewport, cssTurns);
  const zoom = useZoomPan({
    resetKey: props.fileId,
    enabled: props.visible,
    pictureSize: (image) => {
      const drawn = drawnSize(image);
      // A quarter turn swaps the drawn edges and applies the fit scale.
      return cssTurns % 2 === 0
        ? drawn
        : { width: drawn.height * fitScale, height: drawn.width * fitScale };
    },
    onSwipe: (direction) => goTo(direction),
    onPinchClose: () => close(),
  });
  const isZoomed = zoom.isZoomed;

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

  function serverRotation(target: AlbumFile): Rotation {
    return serverRotationsRef.current.get(target.fileId) ?? target.rotation ?? 0;
  }

  function rotate() {
    if (!metadata || !file || !isImage) return;
    const target = ((targetRotationRef.current + 1) % 4) as Rotation;
    targetRotationRef.current = target;
    pendingJobRef.current = { file, target };
    // A rotation changes the drawn bounds, so any zoom/pan is meaningless after it.
    zoom.reset();
    setAnimateTurn(true);
    setCssTurns((turns) => turns + 1);
    scheduleFlush();
  }

  function scheduleFlush() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => flushRotationRef.current(),
      ROTATE_DEBOUNCE_MS,
    );
  }

  /** Reverts the optimistic turns of `job` back to what the server has. */
  function revertRotation(job: { file: AlbumFile }, server: Rotation) {
    if (job.file.fileId !== shownFileIdRef.current) return;
    if (pendingJobRef.current?.file.fileId === job.file.fileId)
      pendingJobRef.current = null;
    const delta = (targetRotationRef.current - server + 4) % 4;
    targetRotationRef.current = server;
    setAnimateTurn(true);
    setCssTurns((turns) => turns - delta);
  }

  /** Sends the pending rotation now (one request at a time). */
  function flushRotation() {
    clearTimeout(debounceRef.current);
    const job = pendingJobRef.current;
    if (!job || inFlightRef.current || !metadata) return;
    pendingJobRef.current = null;
    const server = serverRotation(job.file);
    if (job.target === server) return;
    inFlightRef.current = true;
    setIsRotating(true);
    rotateService
      .rotateTo(metadata.albumId, job.file, key, job.target)
      .then((res) => {
        if (res.result === "edit-in-progress") {
          revertRotation(job, server);
          setNotice("Someone is editing this photo, try again shortly");
        } else {
          serverRotationsRef.current.set(job.file.fileId, job.target);
          refreshMetadata();
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        revertRotation(job, server);
        setNotice("Rotation failed, please try again");
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsRotating(false);
        // Clicks made while the request was in flight: send them as one more request.
        if (pendingJobRef.current) scheduleFlush();
      });
  }
  flushRotationRef.current = flushRotation;

  // A pending rotation must not be lost when the modal goes away.
  useEffect(() => () => flushRotationRef.current(), []);

  function close() {
    flushRotation();
    props.onShowChange(false);
  }

  function goTo(direction: number) {
    flushRotation();
    props.onNext(direction);
    setIsVideoReady(false);
  }

  /** Images are fetched on demand: `edited` when rotated (unless `untouched`), else `original`. */
  /**
   * Saves the photo (`rotated`: the edited rendition when there is one) and/or
   * its attached files (RAW), each as its own download.
   */
  async function downloadImage(what: DownloadChoice) {
    if (!metadata || !file || isPreparingDownload) return;
    setIsPreparingDownload(true);
    try {
      if (what.photo !== undefined)
        await downloadPhoto(metadata.albumId, file, what.photo);
      if (what.sidecars) await downloadSidecars(metadata);
    } catch (e) {
      console.error(e);
      setNotice("Download failed, please try again");
    } finally {
      setIsPreparingDownload(false);
    }
  }
  async function downloadPhoto(
    albumId: string,
    photo: AlbumFile,
    which: "rotated" | "original",
  ) {
    const type = isRotated && which === "rotated" ? "edited" : "original";
    const result = await imageDownloadService.getImg(albumId, photo, key, type);
    if (!result) return;
    saveBlob(
      result.blob,
      type === "edited" ? editedFileName(result.fileName) : result.fileName,
    );
  }
  async function downloadSidecars(album: Metadata) {
    for (const sidecar of props.sidecars) {
      const sidecarFile = album.files.find((f) => f.fileId === sidecar.id);
      if (sidecarFile === undefined) continue;
      const result = await imageDownloadService.getImg(
        album.albumId,
        sidecarFile,
        key,
        "unsupportedFile",
      );
      if (result) saveBlob(result.blob, result.fileName);
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

  const thumbnailsRef = useRef(props.thumbnails);
  thumbnailsRef.current = props.thumbnails;

  useEffect(() => {
    let cancelled = false;
    setDownloadUrl(undefined);

    /** Swaps the displayed image and drops the CSS turns it already contains, in one render. */
    async function showImage(src: string, rotation: Rotation) {
      const size = await decodeImage(src);
      if (cancelled) return;
      setNaturalSize(size);
      setUrl(src);
      setCssTurns((targetRotationRef.current - rotation + 4) % 4);
      setAnimateTurn(false);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async function updateOriginalImageDataUrl() {
      if (!metadata || metadata.albumId === undefined || file === undefined) return;
      if (shownFileIdRef.current !== props.fileId) {
        // New photo: start from its thumbnail and forget the previous photo's turns.
        targetRotationRef.current = serverRotation(file);
        await showImage(
          gridThumbnail(thumbnailsRef.current, props.fileId) ?? PLACEHOLDER_GIF,
          serverRotation(file),
        );
        if (cancelled) return;
        // Only now does `url` belong to this photo (see `isSwitching` in the render).
        shownFileIdRef.current = props.fileId;
      }
      try {
        if (file.original !== undefined) {
          const part = viewerPart(file);
          const reduced = await imageDownloadService.getImg(
            metadata.albumId,
            file,
            key,
            part.type,
          );
          if (reduced?.img !== undefined && cancelled) URL.revokeObjectURL(reduced.img);
          if (!cancelled && reduced?.img !== undefined) {
            ownedUrlsRef.current.add(reduced.img);
            await showImage(reduced.img, part.rotation);
            setFileName(reduced.fileName);
          }

          if (file.originalVideo !== undefined) {
            setIsLoadingVideo(true);
            const video = await imageDownloadService.getImg(
              metadata.albumId,
              file,
              key,
              "originalVideo",
            );
            if (video?.img !== undefined && cancelled) URL.revokeObjectURL(video.img);
            if (!cancelled && video?.img !== undefined) {
              ownedUrlsRef.current.add(video.img);
              setUrl(video.img);
              setDownloadUrl(video.img);
              setFileName(video.fileName);
              setIsVideoReady(true);
            }
            if (!cancelled) setIsLoadingVideo(false);
          }
        } else if (file.unsupportedFile !== undefined) {
          const unsupported = await imageDownloadService.getImg(
            metadata.albumId,
            file,
            key,
            "unsupportedFile",
          );
          if (!cancelled && unsupported !== undefined) {
            setUrl("");
            setFileName(unsupported.fileName);
            const unsupportedUrl = URL.createObjectURL(unsupported.blob);
            ownedUrlsRef.current.add(unsupportedUrl);
            setDownloadUrl(unsupportedUrl);
          }
        } else {
          if (!cancelled) setUrl("");
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      }
    }
    updateOriginalImageDataUrl();

    return () => {
      cancelled = true;
    };
    // Keyed on the part ivs (not `file`) so a metadata refresh that did not
    // replace the parts does not refetch and re-swap the image.
  }, [
    props.fileId,
    file?.reduced?.iv,
    file?.edited?.iv,
    file?.originalVideo?.iv,
    file?.unsupportedFile?.iv,
    key,
    metadata?.albumId,
  ]);

  // Object URLs are revoked once they stop being displayed. The displayed
  // `url` is revoked only when it is replaced (a video's `downloadUrl` aliases
  // it, and the <img> may be remounted with the old src for one render when
  // switching between the video and the photo layouts).
  // Only URLs this modal created are revoked; thumbnails belong to the grid.
  const urlRef = useRef(url);
  urlRef.current = url;
  useEffect(() => {
    return () => {
      if (url !== undefined && ownedUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
    };
  }, [url]);
  useEffect(() => {
    return () => {
      if (
        downloadUrl !== undefined &&
        downloadUrl !== urlRef.current &&
        ownedUrlsRef.current.delete(downloadUrl)
      ) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // Until the effect above has swapped in the new photo, `url` and the turns
  // still belong to the previous one: draw the new photo's thumbnail (already
  // decoded by the grid) unturned instead, so opening never blinks.
  const isSwitching = shownFileIdRef.current !== props.fileId;
  const shownUrl = isSwitching
    ? (gridThumbnail(props.thumbnails, props.fileId) ?? PLACEHOLDER_GIF)
    : url;
  const shownTurns = isSwitching ? 0 : cssTurns;
  const imageTransform = {
    transform: `rotate(${shownTurns * 90}deg) scale(${rotatedFitScale(
      naturalSize,
      viewport,
      shownTurns,
    )})`,
    transition: animateTurn ? `transform ${ROTATE_ANIMATION_MS}ms ease` : "none",
  };

  return (
    <Container isVisible={props.visible} onClick={close}>
      <ButtonBar onClick={stop}>
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
              fileName={fileName}
              sidecars={props.sidecars}
              isRotated={isRotated}
              isRotating={isRotating}
              isPreparingDownload={isPreparingDownload}
              onDownload={downloadImage}
              onRotate={rotate}
            />
          ) : // eslint-disable-next-line sonarjs/no-nested-conditional
          downloadUrl ? (
            <Button
              as="a"
              style={{ padding: "0px" }}
              href={downloadUrl}
              download={fileName}
              title={`Download ${fileName}`}
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
      {file?.originalVideo ? (
        <>
          <FullScreenImg src={shownUrl} />
          {isVideoReady && (
            <FullScreenVideo src={url} autoPlay muted loop controls onClick={stop} />
          )}
          {isLoadingVideo && (
            <LoadingOverlay>
              <Spinner />
            </LoadingOverlay>
          )}
        </>
      ) : // eslint-disable-next-line sonarjs/no-nested-conditional
      file?.thumbnail ? (
        <ZoomWrapper ref={zoom.wrapperRef} isZoomed={isZoomed} {...zoom.handlers}>
          <ZoomLayer ref={zoom.targetRef}>
            <ZoomableImg
              ref={zoom.imageRef}
              src={shownUrl}
              draggable={false}
              style={imageTransform}
            />
          </ZoomLayer>
        </ZoomWrapper>
      ) : (
        <UnsupportedFile>
          <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
        </UnsupportedFile>
      )}
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
const FullScreenImg = styled("img", {
  display: "block",
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  objectFit: "contain",
  backgroundColor: "#000",
});
const ZoomWrapper = styled("div", {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: "#000",
  touchAction: "none",
  userSelect: "none",
  variants: {
    isZoomed: {
      true: { cursor: "grab" },
      false: { cursor: "default" },
    },
  },
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
