/* eslint-disable promise/catch-or-return */
import { styled } from "../../stitches.config";
import header from "@assets/images/header.svg?no-inline";
import Upload from "@assets/images/upload.svg?react";
import Edit from "@assets/images/icons/edit.svg?react";
import Link from "@assets/images/icons/link.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import Zoom from "@assets/images/icons/zoom.svg?react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageResizeService } from "../../utils/ImageResizeService";
import { UploadService } from "../../utils/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { uint8ArrayToBase64 } from "../../utils/base64";
import { ImageDownloadService } from "../../utils/ImageDownloadService";
import { T } from "react-router/dist/development/fog-of-war-CvttGpNz";

const imageResizeService = new ImageResizeService();
const uploadService = new UploadService(imageResizeService);
const imageDownloadService = new ImageDownloadService();
type Metadata = {
  albumId: string;
  albumName: string;
  files: {
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number, original: number, thumbnail: number }
  }[];
};

export default function Album() {
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<{ thumbnail: string; id: string }[]>([]);
  const [originImg, setOriginImg] = useState<string>("")
  const { albumId } = useParams();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showUploader, setShowUploader] = useState(true);
  const [metadata, setMetadata] = useState<Metadata>();
  const key = decodeURIComponent(window.location.hash.slice(1));

  useEffect(() => {
    if (!albumId) return;
    client.getAlbumMetadata
      .get({
        query: {
          id: albumId,
        },
      })
      .then((e) => {
        // eslint-disable-next-line promise/always-return
        if (e.result === "success") {
          setTitle(e.metadata.albumName);
          setMetadata(e.metadata);
        }
      })
      .catch(() => console.log("The album is not exist"));
  }, []);
  useEffect(() => {
    if (metadata !== undefined && albumId !== undefined) {
      getThumbnail(metadata).then((thumb) => {
        console.log("lefut")
        if (thumb !== undefined) {
          setThumbnails([...thumbnails, thumb])
        }
      })
    }
  }, [metadata]);

  function updateProgress(percentage: number) {
    const height = 480 * (percentage / 100);
    const y = 480 - height;
    const fillCloud = document.getElementById("fillCloud");
    if (fillCloud !== null) {
      fillCloud.setAttribute("height", height.toString());
      fillCloud.setAttribute("y", y.toString());
    }
  }

  const ref = useRef<HTMLInputElement>(null);

  const thumbs = useMemo(() => thumbnails, [thumbnails]);

  async function getThumbnail(metadata: Metadata) {
    for (const file of metadata.files) {
      const result = await imageDownloadService.getImg(metadata, file.fileId, file.thumbnailIv, key, "thumbnail")

      console.log(result)
      if (result === undefined) return

      const thumb = { thumbnail: result.img, id: result.id }
      return thumb

    }

  }

  async function getOriginImg(metadata: Metadata, id: string) {
    const fileData = metadata?.files.find(file => file.fileId === id)
    if (fileData === undefined) return
    const reduce = await imageDownloadService.getImg(metadata, id, fileData.reducedIv, key, "reduced",)
    console.log(reduce)
    if (reduce !== undefined) {
      setOriginImg(reduce.img)
    }
  }

  async function upload(files: File[]) {
    if (albumId === undefined || key === undefined) throw new Error("Error in URL");
    const metaData: Metadata = { albumId: albumId, albumName: title, files: [] };
    const arrLength = files.length;
    for (let i = 0; i < arrLength; ++i) {
      const UUID = crypto.randomUUID();
      const uploadData = await uploadService.upload(files[i], UUID, { albumId, key });
      if (uploadData !== undefined) {
        metaData.files.push({
          fileId: UUID,
          originalIv: uint8ArrayToBase64(uploadData.originalIv),
          reducedIv: uint8ArrayToBase64(uploadData.reducedIv),
          thumbnailIv: uint8ArrayToBase64(uploadData.thumbnailIv),
          chunks: { reduced: uploadData.chunks.reduced, original: uploadData.chunks.original, thumbnail: 1 }
        });
        setThumbnails((prevThumbs) => [
          ...prevThumbs,
          { thumbnail: uploadData.thumbnail, id: uploadData.fileId },
        ]);
        updateProgress((i / arrLength) * 100);
      }
    }
    await uploadService.uploadMetadata(albumId, JSON.stringify(metaData));
    setMetadata(metaData)
    updateProgress(100);
    setShowUploader(false);
  }
  return (
    <Container>
      {originImg.length > 0 ? <FullScreenImg src={originImg} key={"1"} /> : <></>}
      <HeaderBG bgColor={showUploader}>
        <Header bgColor={showUploader}>
          <TextContainer>
            <Title
              value={title}
              placeholder="Title"
              onChange={(e) => setTitle(e.target.value)}
              autoCapitalize="sentences"
            />
          </TextContainer>
          <Tools>
            <Button onClick={() => console.log("asd")}>
              <Icons as={Edit} />
            </Button>
            <Button onClick={() => console.log("asd")}>
              <Icons as={Link} />
            </Button>
          </Tools>
        </Header>
      </HeaderBG>
      <Content bgColor={showUploader}>
        {thumbnails != undefined &&
          Array.from(thumbs).map((image, key) => (
            <div
              key={key}
              onClick={() =>
                selectedImages?.includes(image.id)
                  ? setSelectedImages(selectedImages.filter((e) => image.id != e))
                  : setSelectedImages([...selectedImages, image.id])
              }
            >
              <SelectedImage>
                <CheckIcon isVisible={selectedImages.includes(image.id)} />
                <Image
                  src={image.thumbnail}
                  key={key}
                  isSelected={selectedImages.includes(image.id)}
                >
                </Image>
                <ZoomIcon onClick={async () => { if (metadata !== undefined) { await getOriginImg(metadata, image.id) } }} />
              </SelectedImage>
            </div>
          ))}
        <CloudContainer isVisible={showUploader}>
          <StyledUpload
            onClick={() => {
              if (!ref.current) return;
              ref.current.click();
            }}
          />
          <Text>Drop your photos here to upload</Text>
        </CloudContainer>
        <input
          type="file"
          style={{ display: "none" }}
          ref={ref}
          multiple
          onChange={(e) => {
            if (e.target.files != null) {
              const fileArr = Array.from(e.target.files);
              upload(fileArr).catch((e) => console.error(e));
            }
          }}
        ></input>
      </Content>
      <Toolbar
        albumId={albumId}
        selectedImages={selectedImages}
        setSelectedImages={setSelectedImages}
        setThumbnails={setThumbnails}
      />
    </Container>
  );
}

const Container = styled("div", {
  width: "100%",
  height: "auto",
  minHeight: "100vh",
  position: "relative",
  fontFamily: "Open Sans",
});
const HeaderBG = styled("div", {
  width: "100%",
  flex: 1,
  display: "flex",
  transition: "background-color 0.3s",
  variants: {
    bgColor: {
      true: {
        backgroundColor: "#181818",
      },
      false: {
        backgroundColor: "#333333",
      },
    },
  },
});

const Header = styled("div", {
  width: "100%",
  minHeight: "20vh",
  display: "flex",
  justifyContent: "space-between",
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  padding: "2rem",
  boxSizing: "border-box",
  transition: "background-color 0.3s",
  variants: {
    bgColor: {
      true: {
        backgroundColor: "#333333",
      },
      false: {
        backgroundColor: "#181818",
      },
    },
  },
});

const Content = styled("div", {
  display: "flex",
  flexWrap: "wrap",
  position: "relative",
  minHeight: "80vh",
  gap: "10px",
  paddingTop: "2rem",
  maxWidth: "100%",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.3s",
  variants: {
    bgColor: {
      true: {
        backgroundColor: "#181818",
      },
      false: {
        backgroundColor: "#333333",
      },
    },
  },
});
const CloudContainer = styled("div", {
  flexDirection: "column",
  alignItems: "center",
  position: "absolute",
  top: "15vh",
  transition: "display 0.3s",
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
const Tools = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: "3rem",
});
const TextContainer = styled("div", {
  display: "flex",
  flex: 1,
  flexDirection: "column",
});
const Text = styled("div", {
  textAlign: "center",
  width: "12rem",
  fontSize: "1rem",
  marginTop: "0.5rem",
  color: "#DBDCD9",
});

const Title = styled("textarea", {
  fontFamily: "Open Sans",
  border: "none",
  background: "none",
  overflow: "hidden",
  resize: "none",
  fontSize: "2rem",
  color: "#fff",
  width: "100%",
  "&:focus": { outline: "none" },
});

const Button = styled("button", {
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  width: "2rem",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  "&:hover": {
    color: "#fff",
  },
  fontSize: "2rem",
  background: "none",
  border: "none",
  padding: "0px",
  margin: "0px",
});

const StyledUpload = styled(Upload, {
  width: "12rem",
  color: "#333333",
  cursor: "pointer",
  transition: "color 300ms",
  "&:hover": {
    color: "#444444",
  },
});

const Image = styled("img", {
  display: "block",
  borderRadius: "10px",
  width: "var(--width, 300px)",
  height: "var(--height, 200px)",
  transition: "width 0.2s, height 0.2s",
  variants: {
    isSelected: {
      true: { width: 280, height: 180 },
      false: { width: 300, height: 200 },
    },
  },
});

const SelectedImage = styled("div", {
  width: "300px",
  height: "200px",
  borderRadius: "10px",
  backgroundColor: "#232323",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
});

const Icons = styled("svg", {
  width: "2rem",
  height: "2rem",
  "&:hover": {
    color: "#fff",
  },
});

const CheckIcon = styled(Check, {
  position: "absolute",
  top: "5px",
  left: "5px",
  variants: {
    isVisible: {
      true: {
        visibility: "visible",
      },
      false: {
        visibility: "hidden",
      },
    },
  },
});
const ZoomIcon = styled(Zoom, {
  position: "absolute",
  width: "30px",
  height: "30px",
  bottom: "5px",
  right: "5px",
  cursor: "pointer",
});
const FullScreenImg = styled("img", {
  top: "15%",
  left: "15%",
  display: "block",
  position: "absolute",
  width: "70%",
  height: "70%",
  backgroundColor: "#000",
  zIndex: "9",
});