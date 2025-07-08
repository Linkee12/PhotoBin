/* eslint-disable promise/catch-or-return */
import { styled } from "../../stitches.config";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasService } from "./services/CanvasService";
import { UploadService } from "./services/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { ImageQueryService } from "./services/ImageQueryService";
import { Header } from "./components/Header";
import { Cloud } from "@assets/images/cloud";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { useAlbumContext } from "./hooks/useAlbumContext";
import { arrayBufferToBase64, uint8ArrayToBase64 } from "../../utils/base64";
import { DragNdrop } from "./components/DragNdrop";
import { DownloadService } from "./services/DownloadService";
import { CryptoService } from "./services/CryptoService";
import { AlbumItemContainer } from "./components/AlbumItemContainer";
import { groupThumbnailsByDate } from "../../utils/groupThumbnailsByDate";
import header from "@assets/images/albumItemsBg.svg?no-inline";
import { Metadata } from "../../../../backend/src/services/MetadataService";
const imageResizeService = new CanvasService();
const cryptoService = new CryptoService();
const uploadService = new UploadService(imageResizeService, cryptoService);
const imageQueryService = new ImageQueryService(cryptoService);
const downloadService = new DownloadService(imageQueryService);

type Thumbnails = {
  date: string;
  thumbnails: {
    thumbnail: string;
    id: string;
    isVideo: boolean;
  }[];
}[];

export default function Album() {
  const albumContext = useAlbumContext();
  const { metadata, key, refreshMetadata, decodedValues } = albumContext;
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const { albumId } = useParams();
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<Thumbnails>([]);
  const [maskHeight, setMaskHeight] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showOrigin, setShowOrigin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const showUploader = thumbnails.length === 0 || isUploading;
  useEffect(() => {
    if (metadata !== undefined && albumId !== undefined) {
      setTitle(decodedValues.albumName);
      const oldThumbnailIds = new Set();
      thumbnails.forEach((thumb) =>
        thumb.thumbnails.forEach((t) => oldThumbnailIds.add(t.id)),
      );
      const newThumbnails = metadata.files.filter(
        (file) => !oldThumbnailIds.has(file.fileId),
      );
      getThumbnails(newThumbnails).then((thumb) => {
        // eslint-disable-next-line promise/always-return
        if (thumb !== undefined) {
          const thumbs = groupThumbnailsByDate(thumb);
          setThumbnails((prev) => [...prev, ...thumbs]);
        }
      });
    }
  }, [metadata]);

  async function deleteImages(ids: string[]) {
    if (albumId === undefined) return;
    const responses = await client.deleteImages.delete({
      body: {
        albumId: albumId,
        ids: ids,
      },
    });
    if (responses.result === "success") {
      setThumbnails((prev) =>
        prev.filter((img) => {
          // eslint-disable-next-line sonarjs/no-nested-functions
          img.thumbnails.map((element) => !ids.includes(element.id));
        }),
      );
      setSelectedImages((prev) => prev.filter((imgId) => !ids.includes(imgId)));
    }
    refreshMetadata();
  }

  function onDeleteSelected() {
    deleteImages(selectedImages).catch((reason) => {
      console.error(reason);
    });
  }

  async function onDownloadSelected() {
    if (metadata) await downloadService.download({ albumContext, selectedImages });
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
      date: string;
      isVideo: boolean;
    }[] = [];
    for (const file of thumbnails) {
      const result = await imageQueryService.getImg(albumId, file, key, "thumbnail");
      if (result === undefined) return;
      const thumb = {
        thumbnail: result.img,
        id: result.id,
        date: result.date,
        isVideo: result.isVideo,
      };
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
      setThumbnails((thumbnails) => {
        const date = result.thumbnail.date;
        let group = thumbnails.find((g) => g.date === date);

        if (!group) {
          group = { date, thumbnails: [] };
          thumbnails.push(group);
        }

        group.thumbnails.push({
          id: result.thumbnail.id,
          thumbnail: result.thumbnail.thumbnail,
          isVideo: result.thumbnail.isVideo,
        });
        return thumbnails;
      });

      refreshMetadata();
    }
    setIsUploading(false);
  }
  function nextOriginImgId(direction: number) {
    const ids: string[] = [];
    thumbnails.forEach((group) => group.thumbnails.forEach((i) => ids.push(i.id)));
    const currentIdx = ids.findIndex((id) => id === fullscreenImage?.fileId);

    let nextIdx;
    if (currentIdx + direction > ids.length - 1) {
      nextIdx = 0;
    } else if (currentIdx + direction < 0) {
      nextIdx = ids.length - 1;
    } else {
      nextIdx = currentIdx + direction;
    }
    setFullscreenImage({ fileId: ids[nextIdx] });
  }

  function saveAlbumName() {
    if (metadata !== undefined) {
      uploadService.saveName(metadata.albumId, title, key);
    }
  }

  return (
    <Container isEmptyAlbum={thumbnails.length === 0}>
      {fullscreenImage && (
        <ViewOriginalModal
          fileId={fullscreenImage.fileId}
          visible={showOrigin}
          onShowChange={setShowOrigin}
          onNext={(direction) => nextOriginImgId(direction)}
          onDelete={() => deleteImages([fullscreenImage.fileId])}
        />
      )}
      <Header
        isEmptyAlbum={showUploader}
        title={title}
        onChangeTitle={setTitle}
        onSaveName={saveAlbumName}
      />

      <Content bgColor={showUploader}>
        <ContentHeaderBg show={showUploader}>
          <ContentHeader />
        </ContentHeaderBg>
        <DragNdrop
          onDroppedFiles={(files) => {
            if (files != null) {
              const fileArr = Array.from(files);
              uploadImages(fileArr).catch((e) => console.error(e));
            }
          }}
        />
        {thumbnails != undefined &&
          thumbs.map((group, i) => (
            <AlbumItemContainer
              key={i}
              group={group}
              index={i}
              isUploading={isUploading}
              selectedImages={selectedImages}
              isSelected={(id) => selectedImages.includes(id)}
              onSelect={(id: string[]) => setSelectedImages([...selectedImages, ...id])}
              onDeSelect={(id: string[]) => {
                if (id) {
                  setSelectedImages(
                    selectedImages.filter((imgId) => !id.includes(imgId)),
                  );
                }
              }}
              onOpen={(id) => {
                setFullscreenImage({ fileId: id });
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
              const array = Array.from(e.target.files);
              uploadImages(array).catch((e) => console.error(e));
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
  const encryptedTitle = await cryptoService.encrypString(params.albumTitle, params.key);
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
    if (uploadData !== null) {
      yield {
        progress: (i / arrLength) * 100,
        thumbnail: {
          thumbnail: uploadData.thumbnail,
          id: uploadData.fileId,
          date: uploadData.date,
          isVideo: uploadData.isVideo,
        },
      };
    } else {
      console.log("vidi");
    }
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
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "rgba(51, 51, 51)",
      },
      false: {
        backgroundColor: "#181818",
      },
    },
  },
});

const Content = styled("div", {
  display: "flex",
  maxWidth: "100%",
  flexDirection: "column",
  alignItems: "center",
  flex: 1,
  alignContent: "flex-start",
  flexWrap: "wrap",
  transition: "background-color 0.3s",
  variants: {
    bgColor: {
      true: {
        backgroundColor: "#181818",
      },
      false: {
        backgroundColor: "rgba(51, 51, 51)",
      },
    },
  },
});

const ContentHeader = styled("div", {
  display: "flex",
  width: "100%",
  maxHeight: "5rem",
  flex: 1,
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundColor: "#181818",
  variants: {
    bg: {
      true: {
        backgroundColor: "#181818",
      },
      false: {},
    },
  },
});
const ContentHeaderBg = styled("div", {
  display: "flex",
  width: "100%",
  maxHeight: "5rem",
  flex: 1,
  backgroundColor: "#333333",
  variants: {
    show: {
      true: {
        display: "flex",
      },
      false: { display: "none" },
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
