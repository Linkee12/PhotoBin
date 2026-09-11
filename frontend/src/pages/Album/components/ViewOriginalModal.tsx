import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";
import Next from "@assets/images/icons/next.svg?react";
import Prev from "@assets/images/icons/prev.svg?react";
import { ImageQueryService } from "../services/ImageQueryService";
import { useEffect, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { CryptoService } from "../services/CryptoService";
import { ThumbnailGroup } from "../Album";
import { useZoomPan } from "../hooks/useZoomPan";

const imageDownloadService = new ImageQueryService(new CryptoService());

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  fileName: string;
  thumbnails: ThumbnailGroup[];
  onNext: (direction: number) => void;
  onDelete: () => void;
  onShowChange: (visible: boolean) => void;
};
export function ViewOriginalModal(props: ViewOriginalModalProps) {
  const { metadata, key } = useAlbumContext();
  const [url, setUrl] = useState<string | undefined>(
    "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
  );
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const file = metadata?.files.find((file) => file.fileId === props.fileId);
  const zoom = useZoomPan({ resetKey: props.fileId, enabled: props.visible });
  const isZoomed = zoom.isZoomed;
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
        props.onShowChange(false);
      } else if (isZoomed) {
        // The user is panning a zoomed image, leave the arrow keys alone.
        return;
      } else if (e.key === "ArrowRight") {
        props.onNext(1);
        setIsVideoReady(false);
      } else if (e.key === "ArrowLeft") {
        props.onNext(-1);
        setIsVideoReady(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.visible, props.onShowChange, props.onNext, isZoomed]);

  useEffect(() => {
    let cancelled = false;
    setDownloadUrl(undefined);

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async function updateOriginalImageDataUrl() {
      if (!metadata || metadata.albumId === undefined || file === undefined) return;
      const currnetThumb = props.thumbnails
        .flatMap((group) => group.thumbnails)
        .find((thumb) => thumb.id === props.fileId);
      setUrl(currnetThumb?.thumbnail);
      try {
        if (file.original !== undefined) {
          const reduced = await imageDownloadService.getImg(
            metadata.albumId,
            file,
            key,
            "reduced",
          );
          if (!cancelled && reduced !== undefined) {
            setUrl(reduced.img);
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
  }, [file, key, metadata, props.fileId, props.thumbnails]);

  useEffect(() => {
    return () => {
      if (downloadUrl?.startsWith("blob:")) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Container isVisible={props.visible} onClick={() => props.onShowChange(false)}>
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
          {downloadUrl ? (
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
        <Button onClick={() => props.onShowChange(!props.visible)}>
          <Icons as={Exit} />
        </Button>
      </ButtonBar>
      <NextButton
        style={{ left: "0px" }}
        isZoomed={isZoomed}
        onClick={(e) => {
          e.stopPropagation();
          props.onNext(-1);
          setIsVideoReady(false);
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
        <ZoomWrapper ref={zoom.wrapperRef} isZoomed={isZoomed} {...zoom.handlers}>
          <ZoomableImg
            ref={zoom.imageRef}
            src={url}
            draggable={false}
            style={{
              transform: `translate(${zoom.transform.tx}px, ${zoom.transform.ty}px) scale(${zoom.transform.scale})`,
            }}
          />
        </ZoomWrapper>
      ) : (
        <UnsupportedFile>
          <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
        </UnsupportedFile>
      )}
      <NextButton
        style={{ right: "0px" }}
        isZoomed={isZoomed}
        onClick={(e) => {
          e.stopPropagation();
          props.onNext(1);
          setIsVideoReady(false);
        }}
      >
        <Icons as={Next} />
      </NextButton>
    </Container>
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
const ZoomableImg = styled("img", {
  display: "block",
  maxWidth: "100%",
  maxHeight: "100vh",
  objectFit: "contain",
  transformOrigin: "center",
  willChange: "transform",
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
