/* eslint-disable promise/catch-or-return */
import { styled } from "@stitches/react";
import header from "../images/header.svg?no-inline";
import Upload from "../images/upload.svg?react";
import { useMemo, useRef, useState } from "react";
import { Container } from "./Home";
import { GrEdit } from "react-icons/gr";
import { TbExternalLink } from "react-icons/tb";
import imageResize from "../utils/imageResize";
import encryptImage from "../utils/encryptImage";
import genKey from "../utils/genKey";

export default function NewAlbum() {
  const [title, setTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>();
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  // /image:
  //1. create thumbnail
  //2. encrypt images
  //3. upload
  //4. extends state with the current thumbnail
  async function upload(file: File) {
    const thumbnail = await imageResize(file);
    const key = await genKey();
    const cryptedThumbNail = await encryptImage(thumbnail.blob, key);
    const cryptedOriginImage = await encryptImage(file, key);
    // TODO
    // reduced img
    //UUID
    //slicce origin and reduce
    //Send back
    console.log(cryptedThumbNail);
    //
    setThumbnails((prevThumbs) => [...prevThumbs, thumbnail.url]);
  }
  const thumbs = useMemo(() => thumbnails, [thumbnails]);
  return (
    <Body>
      <Container>
        <Header>
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
              <GrEdit />
            </Button>
            <Button onClick={() => console.log("asd")}>
              <TbExternalLink />
            </Button>
          </Tools>
        </Header>
        <Content>
          {thumbnails != undefined ? (
            Array.from(thumbs).map((image, key) => <Image src={image} key={key}></Image>)
          ) : (
            <></>
          )}
          <CloudContainer>
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
                setSelectedFiles(fileArr);
                fileArr.map((file) => {
                  upload(file);
                });
              }
            }}
          ></input>
        </Content>
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
const Header = styled("div", {
  maxWidth: "1500px",
  width: "100%",
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  background: `url(${header}) no-repeat center center`,
  backgroundSize: "100% 100%",
  padding: "2rem",
  boxSizing: "border-box",
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
});
const CloudContainer = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "absolute",
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

const Button = styled("div", {
  width: "2rem",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  "&:hover": {
    color: "#fff",
  },
  fontSize: "2rem",
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
  width: "300px",
  height: "200px",
  borderRadius: "8px",
});
