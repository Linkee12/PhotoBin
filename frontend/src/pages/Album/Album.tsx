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
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../utils/base64";
import { DragNdrop } from "./components/DragNdrop";
import { Zip, ZipPassThrough } from "fflate";

const imageResizeService = new ImageResizeService();
const uploadService = new UploadService(imageResizeService);
const imageDownloadService = new ImageDownloadService();

export default function Album() {
  const { metadata, key, refreshMetadata } = useAlbumContext();
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const { albumId } = useParams();
  const [title, setTitle] = useState("Title");
  const [thumbnails, setThumbnails] = useState<{ thumbnail: string; id: string }[]>([]);
  const [maskHeight, setMaskHeight] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showOrigin, setShowOrigin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const showUploader = thumbnails.length === 0 || isUploading;

  useEffect(() => {
    if (metadata !== undefined && albumId !== undefined) {
      const oldThumbnailIds = new Set(thumbnails.map((thumb) => thumb.id));
      const newThumbnails = metadata.files.filter(
        (file) => !oldThumbnailIds.has(file.fileId),
      );

      imageDownloadService
        .getAlbumName(metadata, key)
        .then((albumName) => setTitle(albumName));
      getThumbnails(newThumbnails).then((thumb) => {
        // eslint-disable-next-line promise/always-return
        if (thumb !== undefined) {
          setThumbnails((thumbnails) => [...thumbnails, ...thumb]);
        }
      });
    }
  }, [metadata]);

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
      setSelectedImages((prev) =>
        prev.filter((imgId) => !selectedImages.includes(imgId)),
      );
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
      setSelectedImages((prev) => prev.filter((imgId) => imgId !== id));
    }

    refreshMetadata();
  }

  function onDeleteSelected() {
    deleteImages().catch((reason) => {
      console.error(reason);
    });
  }

  async function onDownloadSelected() {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(title, { create: true });
      const writable = await fileHandle.createWritable();

      let zipFinished = false;
      const zip = new Zip(async (err, chunk, final) => {
        if (err) {
          console.error("ZIP error:", err);
          return;
        }

        if (chunk) {
          await writable.write(chunk);
        }

        if (final) {
          console.log("ZIP successfully completed.");
          await writable.close();
          zipFinished = true;
        }
      });

      let count = 0;
      for (const imgID of selectedImages) {
        if (!albumId || !metadata) continue;

        const file = metadata.files.find((f) => f.fileId === imgID);
        if (!file) continue;

        const origin = await imageDownloadService.getImg(albumId, file, key, "original");
        if (!origin) continue;

        const blob = origin.blob;
        const buffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        const passThrough = new ZipPassThrough(origin.fileName);

        zip.add(passThrough);

        const chunkSize = 64 * 1024;
        let offset = 0;

        while (offset < uint8.length) {
          const end = Math.min(offset + chunkSize, uint8.length);
          const chunk = uint8.slice(offset, end);
          const isLastChunk = end === uint8.length;

          passThrough.push(chunk, isLastChunk);
          offset = end;
          if (!isLastChunk) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }
        ++count;
        console.log(
          "Progress...:" + Math.floor((count / selectedImages.length) * 100) + "%",
        );
      }

      zip.end();

      while (!zipFinished) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return url;
    } catch (e) {
      console.error("Error creating ZIP:", e);
      throw e;
    }
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
    setIsUploading(true);
    const results = upload({ files, key, metadata, albumTitle: title });

    for await (const result of results) {
      setProgress(result.progress);
      setThumbnails((thumbnails) => [...thumbnails, result.thumbnail]);
      refreshMetadata();
    }
    setIsUploading(false);
  }

  function nextOriginImgId(direction: number) {
    const currentIdx = thumbnails.findIndex(
      (thumbnail) => thumbnail.id === fullscreenImage?.fileId,
    );
    let nextIdx;
    if (currentIdx + direction > thumbnails.length - 1) {
      nextIdx = 0;
    } else if (currentIdx + direction < 0) {
      nextIdx = thumbnails.length - 1;
    } else {
      nextIdx = currentIdx + direction;
    }
    setFullscreenImage({ fileId: thumbnails[nextIdx].id });
  }

  function saveAlbumName() {
    if (metadata !== undefined) {
      uploadService.saveName(metadata.albumId, title, key);
    }
  }

  return (
    <Container>
      {fullscreenImage && (
        <ViewOriginalModal
          fileId={fullscreenImage.fileId}
          visible={showOrigin}
          onShowChange={setShowOrigin}
          onNext={(direction) => nextOriginImgId(direction)}
          onDelete={() => deleteImage(fullscreenImage.fileId)}
        />
      )}
      <Header
        isEmptyAlbum={showUploader}
        title={title}
        onChangeTitle={setTitle}
        onSaveName={saveAlbumName}
      />
      <Content bgColor={showUploader}>
        <DragNdrop
          onDroppedFiles={(files) => {
            if (files != null) {
              const fileArr = Array.from(files);
              uploadImages(fileArr).catch((e) => console.error(e));
            }
          }}
        />
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
                setShowOrigin(true);
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
        onDownloadSelected={onDownloadSelected}
      />
    </Container>
  );
}

async function* upload(params: {
  files: File[];
  key: string;
  metadata: { albumId: string };
  albumTitle: string;
}) {
  const arrLength = params.files.length;
  const encryptedTitle = await uploadService._encrypString(params.albumTitle, params.key);
  const base64Title = {
    iv: uint8ArrayToBase64(encryptedTitle.iv),
    value: arrayBufferToBase64(encryptedTitle.encryptedText),
  };
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
  await uploadService.addAlbumName(params.metadata.albumId, base64Title);
}

const Container = styled("div", {
  width: "100%",
  minHeight: "100vh",
  position: "relative",
  fontFamily: "Open Sans",
  display: "flex",
  flexDirection: "column",
});

const Content = styled("div", {
  display: "flex",
  gap: "10px",
  paddingTop: "2rem",
  maxWidth: "100%",
  flex: 1,
  alignContent: "flex-start",
  flexWrap: "wrap",
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
  top: "30vh",
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
