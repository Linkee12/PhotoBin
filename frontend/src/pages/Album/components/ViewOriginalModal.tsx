import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";
import Next from "@assets/images/icons/next.svg?react";
import Prev from "@assets/images/icons/prev.svg?react";
import { ImageDownloadService } from "../../../utils/ImageDownloadService";
import { useEffect, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";

const imageDownloadService = new ImageDownloadService();

type ViewOriginalModalProps = {
  fileId: string;
  visible: boolean;
  onNext: (direction: number) => void;
  onDelete: () => void;
  onShowChange: (visible: boolean) => void;
};
export function ViewOriginalModal(props: ViewOriginalModalProps) {
  const { metadata, key } = useAlbumContext();
  const [url, setUrl] = useState(
    "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
  );
  const [fileName, setFileName] = useState("");
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

  async function updateOriginalImageDataUrl(fileId: string) {
    if (!metadata) return;
    if (metadata.albumId === undefined) return;
    const file = metadata?.files.find((file) => file.fileId === fileId);
    if (file === undefined) return;
    const reduce = await imageDownloadService.getImg(
      metadata.albumId,
      file,
      key,
      "reduced",
    );
    if (reduce !== undefined) {
      setUrl(reduce.img);
      setFileName(file.fileName);
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
  }

  useEffect(() => {
    updateOriginalImageDataUrl(props.fileId).catch((e) => console.error(e));
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
      <NextButton style={{ left: "0px" }} onClick={() => props.onNext(-1)}>
        <Icons as={Prev} />
      </NextButton>
      <FullScreenImg src={url} key={"1"} />
      <NextButton style={{ right: "0px" }} onClick={() => props.onNext(1)}>
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
  zIndex: "2",
});
const ButtonGroup = styled("div", {
  display: "flex",
});
const NextButton = styled("button", {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "20%",
  height: "80%",
  position: "absolute",
  opacity: "0",
  bottom: "0px",
  zIndex: 11,
  border: "none",
  background: "none",
  "&:hover": {
    opacity: "1",
  },
  transition: "opacity 0.5s",
});
