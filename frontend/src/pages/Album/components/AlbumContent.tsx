import { styled } from "../../../stitches.config";
import { Cloud } from "@assets/images/cloud";
import { DragNdrop } from "./DragNdrop";
import { AlbumSection } from "./AlbumSection";
import header from "@assets/images/albumItemsBg.svg?no-inline";
import { useRef, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { UploadService } from "../services/UploadService";
import { ThumbnailGroup } from "../Album";

type AlbumContentProps = {
  showUploader: boolean;
  isUploading: boolean;
  thumbnailGroups: ThumbnailGroup[];

  uploadService: UploadService;

  // selection
  selectedImages: string[];
  isSelected: (imageId: string) => boolean;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;

  onUploadStarted: () => void;
  onUploadFinished: () => void;
  onAddThumbnail: (thumbnail: {
    date: string;
    id: string;
    name: string;
    thumbnail: string | undefined;
    isVideo: boolean;
  }) => void;
};

export function AlbumContent(props: AlbumContentProps) {
  const [maskHeight, setMaskHeight] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const { metadata, refreshMetadata, key } = useAlbumContext();

  function setProgress(percentage: number) {
    const height = 445 * (percentage / 100);
    setMaskHeight(height);
  }

  async function uploadImages(files: File[]) {
    if (!metadata) return;
    props.onUploadStarted();
    const results = upload({ uploadService: props.uploadService, files, key, metadata });

    for await (const result of results) {
      if (result.result === "progress") {
        setProgress(result.progress);
      } else {
        if (result.thumbnail !== undefined) {
          props.onAddThumbnail(result.thumbnail);
        }
      }

      refreshMetadata();
    }
    props.onUploadFinished();
  }

  return (
    <Content bgColor={props.showUploader}>
      <ContentHeaderBg show={props.showUploader}>
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
      {props.thumbnailGroups.map((group, i) => (
        <AlbumSection
          key={i}
          group={group}
          index={i}
          isUploading={props.isUploading}
          selectedImages={props.selectedImages}
          isSelected={props.isSelected}
          onSelect={props.onSelect}
          onDeSelect={props.onDeSelect}
          onOpen={props.onOpen}
        />
      ))}
      <CloudContainer
        isVisible={props.showUploader}
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
  );
}

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
        marginTop: "-3rem",
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
  maxHeight: "3rem",
  flex: 1,
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  "@portrait": {
    maskSize: "100% 100%",
  },
  "@landscape": {
    maskSize: "800px 100%",
  },
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
  maxHeight: "3rem",
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
  top: "18rem",
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

async function* upload(params: {
  uploadService: UploadService;
  files: File[];
  key: string;
  metadata: { albumId: string };
}) {
  const arrLength = params.files.length;
  const totalSize = params.files.reduce((acc, file) => file.size + acc, 0);
  let currentSize = 0;
  for (let i = 0; i < arrLength; ++i) {
    const uploadData = params.uploadService.upload(params.files[i], {
      albumId: params.metadata.albumId,
      key: params.key,
    });
    for await (const response of uploadData) {
      if (response.result === "progress") {
        currentSize += response.bytes;
        yield { result: "progress", progress: (currentSize / totalSize) * 100 };
      } else {
        yield {
          thumbnail: {
            result: "thumbnail",
            thumbnail: response.thumbnail,
            id: response.fileId,
            name: response.name,
            date: response.date,
            isVideo: response.isVideo,
          },
        };
      }
    }
  }
}
