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

const imageDownloadService = new ImageQueryService(new CryptoService());

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  fileName: string;
  onNext: (direction: number) => void;
  onDelete: () => void;
  onShowChange: (visible: boolean) => void;
};
export function ViewOriginalModal(props: ViewOriginalModalProps) {
  const { metadata, key } = useAlbumContext();
  const [url, setUrl] = useState<string | undefined>(
    "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
  );
  const [fileName, setFileName] = useState("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const file = metadata?.files.find((file) => file.fileId === props.fileId);
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

  async function updateOriginalImageDataUrl() {
    if (!metadata) return;
    if (metadata.albumId === undefined) return;
    if (file === undefined) return;
    if (file.original !== undefined) {
      const reduced = await imageDownloadService.getImg(
        metadata.albumId,
        file,
        key,
        "reduced",
      );
      if (reduced !== undefined) {
        setUrl(reduced.img);
        setFileName(reduced.fileName);
      }
      const origin = await imageDownloadService.getImg(
        metadata.albumId,
        file,
        key,
        "original",
      );
      if (origin !== undefined) {
        setUrl(origin.img);
      }
      if (file.originalVideo !== undefined) {
        setIsLoadingVideo(true);
        const video = await imageDownloadService.getImg(
          metadata.albumId,
          file,
          key,
          "originalVideo",
        );
        if (video !== undefined) {
          setUrl(video.img);
          setIsVideoReady(true);
        }
        setIsLoadingVideo(false);
      }
    } else {
      setUrl("");
    }
  }

  useEffect(() => {
    updateOriginalImageDataUrl().catch((e) => console.error(e));
  }, [props.fileId]);

  return (
    <Container isVisible={props.visible}>
      <ButtonBar>
        <ButtonGroup>
          <Button
            onClick={() => {
              props.onShowChange(!props.visible);
              props.onDelete();
            }}
          >
            <Icons as={Trash} />
          </Button>
          <Button as="a" style={{ padding: "0px" }} href={url} download={fileName}>
            <Icons as={SimpleCloud} />
          </Button>
        </ButtonGroup>
        <Button onClick={() => props.onShowChange(!props.visible)}>
          <Icons as={Exit} />
        </Button>
      </ButtonBar>
      <NextButton
        style={{ left: "0px" }}
        onClick={() => {
          props.onNext(-1);
          setIsVideoReady(false);
        }}
      >
        <Icons as={Prev} />
      </NextButton>
      {file?.originalVideo ? (
        <>
          <FullScreenImg src={url} />
          {isVideoReady && <FullScreenVideo src={url} autoPlay muted loop controls />}
          {isLoadingVideo && (
            <LoadingOverlay>
              <Spinner />
            </LoadingOverlay>
          )}
        </>
      ) : // eslint-disable-next-line sonarjs/no-nested-conditional
      file?.original ? (
        <FullScreenImg src={url} />
      ) : (
        <UnsupportedFile>
          <UnsupportedFileName>{props.fileName}</UnsupportedFileName>
        </UnsupportedFile>
      )}
      <NextButton
        style={{ right: "0px" }}
        onClick={() => {
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
