/* eslint-disable promise/catch-or-return */
import { styled } from "../../stitches.config";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageResizeService } from "../../utils/ImageResizeService";
import { UploadService } from "../../utils/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { ImageDownloadService } from "../../utils/ImageDownloadService";
import { Header } from "./components/Header";
import { AlbumItem } from "./components/AlbumItem";
import { Cloud } from "@assets/images/cloud";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { Metadata, useAlbumContext } from "./hooks/useAlbumContext";

const imageResizeService = new ImageResizeService();
const uploadService = new UploadService(imageResizeService);
const imageDownloadService = new ImageDownloadService();

export default function Album() {
  const { metadata, key, refreshMetadata } = useAlbumContext();
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const { albumId } = useParams();
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<{ thumbnail: string; id: string }[]>([]);
  const [maskHeight, setMaskHeight] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showOrigin, setShowOrigin] = useState(true);
  const showUploader = metadata ? metadata.files.length === 0 : true;

  useEffect(() => {
    if (metadata !== undefined && albumId !== undefined) {
      const oldThumbnailIds = new Set(thumbnails.map((thumb) => thumb.id));
      const newThumbnails = metadata.files.filter(
        (file) => !oldThumbnailIds.has(file.fileId),
      );
      getThumbnails(newThumbnails).then((thumb) => {
        // eslint-disable-next-line promise/always-return
        if (thumb !== undefined) {
          setThumbnails((thumbnails) => [...thumbnails, ...thumb]);
        }
      });
    }
  }, [metadata, thumbnails]);

  async function deleteImages() {
    if (albumId === undefined) return;
    const responses = await client.deleteImages.delete({
      body: {
        albumId: albumId,
        ids: selectedImages,
      },
    });
    if (responses.result === "success") {
      setThumbnails((prev) => prev.filter((img) => !selectedImages.includes(img.id)));
    }
    refreshMetadata();
  }
  async function deleteImage(id: string) {
    if (albumId === undefined) return;
    const responses = await client.deleteImages.delete({
      body: {
        albumId: albumId,
        ids: [id],
      },
    });
    if (responses.result === "success") {
      setThumbnails((prev) => prev.filter((img) => img.id !== id));
    }

    refreshMetadata();
  }

  function onDeleteSelected() {
    deleteImages().catch((reason) => {
      console.error(reason);
    });
  }

  function onUncheckSelected() {
    setSelectedImages([]);
  }
  function setProgress(percentage: number) {
    const height = 480 * (percentage / 100);
    setMaskHeight(height);
  }

  const ref = useRef<HTMLInputElement>(null);

  const thumbs = useMemo(() => thumbnails, [thumbnails]);

  async function getThumbnails(thumbnails: Metadata["files"]) {
    if (albumId === undefined) return;
    let thumbArr: {
      thumbnail: string;
      id: string;
    }[] = [];
    for (const file of thumbnails) {
      const result = await imageDownloadService.getImg(albumId, file, key, "thumbnail");
      if (result === undefined) return;

      const thumb = { thumbnail: result.img, id: result.id };
      thumbArr = [...thumbArr, thumb];
    }
    return thumbArr;
  }

  async function uploadImages(files: File[]) {
    if (!metadata) return;
    const results = upload({ files, key, metadata });

    for await (const result of results) {
      setProgress(result.progress);
      setThumbnails((thumbnails) => [...thumbnails, result.thumbnail]);
      refreshMetadata();
    }
  }

  return (
    <Container>
      {fullscreenImage && (
        <ViewOriginalModal
          fileId={fullscreenImage.fileId}
          visible={showOrigin}
          onShowChange={setShowOrigin}
          onDelete={() => deleteImage(fullscreenImage.fileId)}
        />
      )}
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
              onOpen={() => {
                setFullscreenImage({ fileId: image.id });
              }}
            />
          ))}
        <CloudContainer
          isVisible={showUploader}
          onClick={() => {
            if (!ref.current) return;
            ref.current.click();
          }}
        >
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
              uploadImages(fileArr).catch((e) => console.error(e));
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

async function* upload(params: {
  files: File[];
  key: string;
  metadata: { albumId: string };
}) {
  const arrLength = params.files.length;
  for (let i = 0; i < arrLength; ++i) {
    const uploadData = await uploadService.upload(params.files[i], {
      albumId: params.metadata.albumId,
      key: params.key,
    });
    if (uploadData === undefined) {
      throw new Error("Upload error");
    }

    yield {
      progress: (i / arrLength) * 100,
      thumbnail: { thumbnail: uploadData.thumbnail, id: uploadData.fileId },
    };
  }
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
  height: "12rem",
  color: "#333333",
  cursor: "pointer",
  transition: "color 300ms",
  "&:hover": {
    color: "#444444",
  },
});
