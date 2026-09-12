import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";
import Next from "@assets/images/icons/next.svg?react";
import Prev from "@assets/images/icons/prev.svg?react";
import Rotate from "@assets/images/icons/rotate.svg?react";
import { ImageQueryService } from "../services/ImageQueryService";
import { useEffect, useRef, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { CryptoService } from "../services/CryptoService";
import { CanvasService } from "../services/CanvasService";
import { editedFileName, RotateService, Rotation } from "../services/RotateService";
import { ThumbnailGroup } from "../Album";
import { Metadata } from "../../../../../backend/src/services/MetadataService";

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
const PLACEHOLDER_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

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

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  fileName: string;
  thumbnails: ThumbnailGroup[];
  onNext: (direction: number) => void;
  onDelete: () => void;
  onShowChange: (visible: boolean) => void;
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
  async function downloadImage(untouched: boolean) {
    if (!metadata || !file || isPreparingDownload) return;
    setIsPreparingDownload(true);
    try {
      const type = isRotated && !untouched ? "edited" : "original";
      const result = await imageDownloadService.getImg(metadata.albumId, file, key, type);
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = type === "edited" ? editedFileName(result.fileName) : result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  useEffect(() => {
    if (!props.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowRight") {
        goTo(1);
      } else if (e.key === "ArrowLeft") {
        goTo(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.visible, props.onShowChange, props.onNext]);

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
        shownFileIdRef.current = props.fileId;
        targetRotationRef.current = serverRotation(file);
        const currentThumb = thumbnailsRef.current
          .flatMap((group) => group.thumbnails)
          .find((thumb) => thumb.id === props.fileId);
        await showImage(currentThumb?.thumbnail ?? PLACEHOLDER_GIF, serverRotation(file));
        if (cancelled) return;
      }
      try {
        if (file.original !== undefined) {
          const reduced = await imageDownloadService.getImg(
            metadata.albumId,
            file,
            key,
            "reduced",
          );
          if (!cancelled && reduced?.img !== undefined) {
            await showImage(reduced.img, file.rotation ?? 0);
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
            if (!cancelled && video !== undefined) {
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
            setDownloadUrl(URL.createObjectURL(unsupported.blob));
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
    file?.originalVideo?.iv,
    file?.unsupportedFile?.iv,
    key,
    metadata?.albumId,
  ]);

  useEffect(() => {
    return () => {
      if (downloadUrl?.startsWith("blob:")) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const imageTransform = {
    transform: `rotate(${cssTurns * 90}deg) scale(${rotatedFitScale(
      naturalSize,
      viewport,
      cssTurns,
    )})`,
    transition: animateTurn ? `transform ${ROTATE_ANIMATION_MS}ms ease` : "none",
  };

  return (
    <Container isVisible={props.visible} onClick={close}>
      <ButtonBar onClick={stop}>
        <ButtonGroup>
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
          <FullScreenImg src={url} />
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
        <FullScreenImg src={url} style={imageTransform} />
      ) : (
        <UnsupportedFile>
          <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
        </UnsupportedFile>
      )}
      <NextButton
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
  isRotated: boolean;
  isRotating: boolean;
  isPreparingDownload: boolean;
  onDownload: (untouched: boolean) => void;
  onRotate: () => void;
}) {
  const iconStyle = { opacity: props.isPreparingDownload ? 0.4 : 1 };
  return (
    <>
      {props.isRotated ? (
        <DownloadMenu
          fileName={props.fileName}
          disabled={props.isPreparingDownload}
          onDownload={props.onDownload}
        />
      ) : (
        <Button
          disabled={props.isPreparingDownload}
          onClick={() => props.onDownload(false)}
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

const MENU_ITEMS = [
  { label: "Download rotated", untouched: false },
  { label: "Download original", untouched: true },
];

function DownloadMenu(props: {
  fileName: string;
  disabled: boolean;
  onDownload: (untouched: boolean) => void;
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
        style={{ width: "auto" }}
        disabled={props.disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        title={`Download ${props.fileName}`}
      >
        <Icons as={SimpleCloud} style={{ opacity: props.disabled ? 0.4 : 1 }} />
        <Chevron viewBox="0 0 10 6" aria-hidden="true" isOpen={isOpen}>
          <path d="M1 1l4 4 4-4" />
        </Chevron>
      </Button>
      {isOpen && (
        <Menu ref={menuRef} role="menu" aria-label="Download">
          {MENU_ITEMS.map((item) => (
            <MenuItem
              key={item.label}
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                props.onDownload(item.untouched);
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
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  borderRadius: "1rem",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  "&:hover": {
    backgroundColor: "#000",
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
const ButtonBar = styled("div", {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  flex: 1,
  position: "absolute",
  top: "0px",
  zIndex: "3",
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
const Chevron = styled("svg", {
  width: "0.6rem",
  height: "0.4rem",
  marginLeft: "0.2rem",
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
  cursor: "pointer",
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
  "&:hover": {
    opacity: "1",
  },
  transition: "opacity 0.5s",
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
