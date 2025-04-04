/* eslint-disable promise/catch-or-return */
import { styled } from "@stitches/react";
import header from "../images/header.svg?no-inline";
import Cloud from "../images/icons/cloud.svg?react";
import SimpleCloud from "../images/icons/cloud2.svg?react";
import Trash from "../images/icons/trash.svg?react";
import Upload from "../images/upload.svg?react";
import Edit from "../images/icons/edit.svg?react";
import Link from "../images/icons/link.svg?react";
import Check from "../images/icons/check.svg?react";
import { useMemo, useRef, useState } from "react";
import { Container } from "./Home";
import { ImageResizeService } from "../utils/ImageResizeService";
import { UploadService } from "../utils/UploadService";
import { useParams } from "react-router";

const imageResizeService = new ImageResizeService();
const uploadService = new UploadService(imageResizeService);

export default function NewAlbum() {
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const { albumId } = useParams();
  const key = decodeURIComponent(window.location.hash.slice(1));
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [cloudVisibility, setCloudVisibility] = useState(true);

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

  async function upload(files: File[]) {
    if (albumId === undefined || key === undefined) throw new Error("Error in URL");
    const arrLength = files.length;
    for (let i = 0; i < arrLength; ++i) {
      const thumbnail = await uploadService.upload(files[i], { albumId, key });
      if (thumbnail !== undefined) {
        setThumbnails((prevThumbs) => [...prevThumbs, thumbnail]);
        updateProgress((i / arrLength) * 100);
      }
    }
    updateProgress(100);
    setCloudVisibility(false);
  }
  return (
    <Body>
      <Container>
        <HeaderBG css={cloudVisibility ? { "--hbg": "#181818" } : { "--hbg": "#333333" }}>
          <Header css={cloudVisibility ? { "--bg": "#333333" } : { "--bg": "#181818" }}>
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
                <Edit />
              </Button>
              <Button onClick={() => console.log("asd")}>
                <Link />
              </Button>
            </Tools>
          </Header>
        </HeaderBG>
        <Content css={cloudVisibility ? { "--hbg": "#181818" } : { "--hbg": "#333333" }}>
          {thumbnails != undefined ? (
            Array.from(thumbs).map((image, key) => (
              <div
                key={key}
                onClick={() =>
                  selectedImages?.includes(key)
                    ? setSelectedImages(selectedImages.filter((e) => key != e))
                    : setSelectedImages([...selectedImages, key])
                }
              >
                <SelectedImage>
                  <Check />
                  <Image
                    src={image}
                    key={key}
                    css={
                      selectedImages.includes(key)
                        ? { "--width": " 280px", "--height": " 180px" }
                        : { "--width": " 300px", "--height": " 200px" }
                    }
                  ></Image>
                </SelectedImage>
              </div>
            ))
          ) : (
            <></>
          )}
          <CloudContainer
            css={
              cloudVisibility
                ? { "--visibility": "visible" }
                : { "--visibility": "hidden" }
            }
          >
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
        <ToolBar
          css={
            cloudVisibility ? { "--visibility": "hidden" } : { "--visibility": "visible" }
          }
        >
          <Button>
            <Trash />
          </Button>
          <Button>
            <SimpleCloud />
          </Button>
          <Button>
            <Cloud />
          </Button>
          {selectedImages.length} item(s) selected
        </ToolBar>
      </Container>
    </Body>
  );
}

const Body = styled("div", {
  background: "#181818",
  width: "100vw",
  height: "auto",
  display: "flex",
  flex: 1,
  justifyContent: "center",
  fontFamily: "sans-serif",
});
const HeaderBG = styled("div", {
  maxWidth: "1500px",
  width: "100%",
  flex: 1,
  display: "flex",
  backgroundColor: "var(--hbg, #181818)",
  transition: "background-color 0.3s",
});

const Header = styled("div", {
  maxWidth: "1500px",
  width: "100%",
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  padding: "2rem",
  boxSizing: "border-box",
  backgroundColor: "var(--bg, #333333)",
  transition: "background-color 0.3s",
});

const Content = styled("div", {
  flex: 4,
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  paddingTop: "2rem",
  maxWidth: "100%",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--hbg, #181818)",
  transition: "background-color 0.3s",
});
const CloudContainer = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "absolute",
  top: "35vh",
  visibility: "var(--visibility, visible)",
  transition: "visibility 0.3s",
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
  borderRadius: "5px",
  width: "var(--width, 300px)",
  height: "var(--height, 200px)",
  transition: "width 0.2s, height 0.2s",
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
const ToolBar = styled("div", {
  width: "300px",
  height: "50px",
  borderRadius: "10px",
  backgroundColor: "#1A1A1A",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "space-around",
  alignItems: "center",
  position: "absolute",
  bottom: "10px",
  left: "50%",
  transform: "translateX(-50%)",
  visibility: "var(--visibility, hidden)",
});
