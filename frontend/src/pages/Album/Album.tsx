import { styled } from "../../stitches.config";
import { useEffect, useState } from "react";
import { CanvasService } from "./services/CanvasService";
import { UploadService } from "./services/UploadService";
import { useParams } from "react-router";
import Toolbar from "./components/Toolbar";
import { client } from "../../cuple";
import { ImageQueryService } from "./services/ImageQueryService";
import { Header } from "./components/Header";
import { ViewOriginalModal } from "./components/ViewOriginalModal";
import { useAlbumContext } from "./hooks/useAlbumContext";
import { DownloadService } from "./services/DownloadService";
import { CryptoService } from "./services/CryptoService";
import { groupThumbnailsByDate } from "../../utils/groupThumbnailsByDate";
import { Metadata } from "../../../../backend/src/services/MetadataService";
import { AlbumContent } from "./components/AlbumContent";

const imageResizeService = new CanvasService();
const cryptoService = new CryptoService();
const uploadService = new UploadService(imageResizeService, cryptoService);
const imageQueryService = new ImageQueryService(cryptoService);
const downloadService = new DownloadService(imageQueryService);

export type ThumbnailGroup = {
  date: string;
  thumbnails: {
    thumbnail: string | undefined;
    id: string;
    name: string;
    isVideo: boolean;
  }[];
};

export default function Album() {
  const albumContext = useAlbumContext();
  const { metadata, key, refreshMetadata, decodedValues } = albumContext;
  const [fullscreenImage, setFullscreenImage] = useState<{ fileId: string } | null>(null);
  const { albumId } = useParams();
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<ThumbnailGroup[]>([]);
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

    if (responses.result !== "success") return;

    setThumbnails((prev) =>
      prev.filter((img) => {
        // eslint-disable-next-line sonarjs/no-nested-functions
        img.thumbnails.map((element) => !ids.includes(element.id));
      }),
    );
    setSelectedImages((prev) => prev.filter((imgId) => !ids.includes(imgId)));
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
  async function onDownloadAll(selectedImages: string[]) {
    if (metadata) await downloadService.download({ albumContext, selectedImages });
  }

  function onUncheckSelected() {
    setSelectedImages([]);
  }
  function onSelectAll() {
    if (metadata?.files) {
      setSelectedImages(metadata?.files.map((file) => file.fileId));
    }
  }

  async function getThumbnails(thumbnails: Metadata["files"]) {
    if (albumId === undefined) return;
    let thumbArr: {
      thumbnail: string | undefined;
      id: string;
      name: string;
      date: string;
      isVideo: boolean;
    }[] = [];
    for (const file of thumbnails) {
      const result = await imageQueryService.getImg(
        albumId,
        file,
        key,
        file.thumbnail !== undefined ? "thumbnail" : "unsupportedFile",
      );
      if (result === undefined) return;
      const thumb = {
        thumbnail: result.img,
        id: result.id,
        date: result.date,
        name: result.fileName,
        isVideo: !!file.originalVideo,
      };
      thumbArr = [...thumbArr, thumb];
    }
    return thumbArr;
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
          fileName={
            thumbnails.map((thumbnailsGroup) =>
              thumbnailsGroup.thumbnails.find(
                (thumb) => thumb.id === fullscreenImage.fileId,
              ),
            )[0]?.name ?? ""
          }
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
        onSelectAll={onSelectAll}
        onUnselectAll={onUncheckSelected}
        selectedAll={selectedImages.length === metadata?.files.length}
      />
      {
        //TODO
        //album buttons
        //downloaded zip name .zip
      }
      <AlbumContent
        uploadService={uploadService}
        showUploader={showUploader}
        isUploading={isUploading}
        onUploadStarted={() => setIsUploading(true)}
        onUploadFinished={() => setIsUploading(false)}
        onDownloadAll={(files: string[]) => onDownloadAll(files)}
        thumbnailGroups={thumbnails}
        onAddThumbnail={(result) => {
          setThumbnails((thumbnails) => {
            const group = thumbnails.find((g) => g.date === result.date);

            if (!group) {
              const newGroup = { date: result.date, thumbnails: [result] };
              thumbnails.push(newGroup);
              return thumbnails;
            }

            group.thumbnails.push(result);
            return thumbnails;
          });
        }}
        selectedImages={selectedImages}
        isSelected={(id) => selectedImages.includes(id)}
        onSelect={(id: string[]) => setSelectedImages([...selectedImages, ...id])}
        onDeSelect={(id: string[]) => {
          if (id) {
            setSelectedImages(selectedImages.filter((imgId) => !id.includes(imgId)));
          }
        }}
        onOpen={(id) => {
          setFullscreenImage({ fileId: id });
          setShowOrigin(true);
        }}
      />
      <Toolbar
        selectedImages={selectedImages}
        onDeleteSelected={onDeleteSelected}
        onUncheckSelected={onUncheckSelected}
        onDownloadSelected={onDownloadSelected}
      />
    </Container>
  );
}

const Container = styled("div", {
  width: "100%",
  minHeight: "100vh",
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
