/* eslint-disable promise/catch-or-return */
import { styled } from "../../stitches.config";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageResizeService } from "../../utils/ImageResizeService";
import { UploadService } from "../../utils/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { uint8ArrayToBase64 } from "../../utils/base64";
import { ImageDownloadService } from "../../utils/ImageDownloadService";
import { Header } from "./components/Header";
import { AlbumItem } from "./components/AlbumItem";
import { Cloud } from "@assets/images/cloud";

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
    chunks: { reduced: number; original: number; thumbnail: number };
  }[];
};

export default function Album() {
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<{ thumbnail: string; id: string }[]>([]);
  const [originImg, setOriginImg] = useState<string>("");
  const { albumId } = useParams();
  const [maskHeight, setMaskHeight] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Metadata>();
  const key = decodeURIComponent(window.location.hash.slice(1));
  const showUploader = metadata ? metadata.files.length === 0 : true;
  console.log(showUploader);

  useEffect(() => {
    getMetadata();
  }, []);

  useEffect(() => {
    if (metadata !== undefined && albumId !== undefined) {
      const oldThumbnailIds = new Set(thumbnails.map((thumb) => thumb.id));
      const newThumbnails = metadata.files.filter(
        (file) => !oldThumbnailIds.has(file.fileId),
      );
      getThumbnails(newThumbnails).then((thumb) => {
        // eslint-disable-next-line promise/always-return
        if (thumb !== undefined) {
          if (thumbnails.find((element) => element.id === thumb.id)) return;
          setThumbnails([...thumbnails, thumb]);
        }
      });
    }
  }, [metadata]);

  async function deleteImages() {
    if (albumId === undefined) return;
    for (const image of selectedImages) {
      const responses = await client.deleteImage.delete({
        body: {
          albumId: albumId,
          id: image,
        },
      });
      if (responses.result === "success") {
        setThumbnails((prev) => prev.filter((img) => img.id !== image));
      }
    }
    getMetadata();
  }

  function getMetadata() {
    if (!albumId) return;
    client.getAlbumMetadata
      .get({
        query: {
          id: albumId,
        },
      })
      .then((res) => {
        // eslint-disable-next-line promise/always-return
        if (res.result === "success") {
          if (res.metadata !== null) {
            setTitle(res.metadata.albumName);
            setMetadata(res.metadata);
          }
        }
      })
      .catch(() => console.log("The album is not exist"));
  }

  function onDeleteSelected() {
    deleteImages().catch((reason) => {
      console.error(reason);
    });
  }

  function onUncheckSelected() {
    setSelectedImages([]);
  }
  function updateProgress(percentage: number) {
    const height = 480 * (percentage / 100);
    setMaskHeight(height);
  }

  const ref = useRef<HTMLInputElement>(null);

  const thumbs = useMemo(() => thumbnails, [thumbnails]);

  async function getThumbnails(thumbnails: Metadata["files"]) {
    if (albumId === undefined) return;
    for (const file of thumbnails) {
      const result = await imageDownloadService.getImg(albumId, file, key, "thumbnail");

      if (result === undefined) return;

      const thumb = { thumbnail: result.img, id: result.id };
      return thumb;
    }
  }

  async function getOriginImg(id: string) {
    if (albumId === undefined) return;
    const file = metadata?.files.find((file) => file.fileId === id);
    if (file === undefined) return;
    const reduce = await imageDownloadService.getImg(albumId, file, key, "reduced");
    if (reduce !== undefined) {
      setOriginImg(reduce.img);
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
          chunks: {
            reduced: uploadData.chunks.reduced,
            original: uploadData.chunks.original,
            thumbnail: 1,
          },
        });
        setThumbnails((prevThumbs) => [
          ...prevThumbs,
          { thumbnail: uploadData.thumbnail, id: uploadData.fileId },
        ]);
        updateProgress((i / arrLength) * 100);
      }
    }
    await uploadService.uploadMetadata(albumId, JSON.stringify(metaData));
    setMetadata(metaData);
    updateProgress(100);
  }
  return (
    <Container>
      {originImg.length > 0 ? <FullScreenImg src={originImg} key={"1"} /> : <></>}
      <Header isEmptyAlbum={showUploader} title={title} onChangeTitle={setTitle} />
      <Content bgColor={showUploader}>
        {thumbnails != undefined &&
          Array.from(thumbs).map((image) => (
            <AlbumItem
              key={image.id}
              imageSrc={image.thumbnail}
              isSelected={selectedImages.includes(image.id)}
              onSelect={() => setSelectedImages([...selectedImages, image.id])}
              onDeselect={() =>
                setSelectedImages(selectedImages.filter((id) => id !== image.id))
              }
              onOpen={() => getOriginImg(image.id)}
            />
          ))}
        <CloudContainer isVisible={showUploader} 
            onClick={() => {
              if (!ref.current) return;
              ref.current.click();
            }}>
          <StyledUpload height={maskHeight} />
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
        selectedImages={selectedImages}
        onDeleteSelected={onDeleteSelected}
        onUncheckSelected={onUncheckSelected}
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

const Text = styled("div", {
  textAlign: "center",
  width: "12rem",
  fontSize: "1rem",
  marginTop: "0.5rem",
  color: "#DBDCD9",
});

const StyledUpload = styled(Cloud, {
  width: "12rem",
  height:"12rem",
  color: "#333333",
  cursor: "pointer",
  transition: "color 300ms",
  "&:hover": {
    color: "#444444",
  },
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
