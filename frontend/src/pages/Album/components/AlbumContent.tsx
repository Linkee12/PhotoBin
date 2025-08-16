import { styled } from "../../../stitches.config";
import { Cloud } from "@assets/images/cloud";
import { DragNdrop } from "./DragNdrop";
import { AlbumSection } from "./AlbumSection";
import { useRef, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { UploadService } from "../services/UploadService";
import { ThumbnailGroup } from "../Album";
import { Panel, PushDown } from "./Panel";
import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import LandscapeAddIcon from "@assets/images/icons/landscapeAddIcon.svg?react";

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
  onDownloadAll: (files: string[]) => void;
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
  function openFilePicker() {
    if (!ref.current) return;
    ref.current.click();
  }
  function getAllId(): string[] {
    return props.thumbnailGroups.flatMap((group) =>
      group.thumbnails.map((file) => file.id),
    );
  }
  return (
    <Panel variant={0}>
      <PushDown />
      {props.thumbnailGroups.length > 0 && (
        <LandscapeButtonsBg>
          <LandscapeButton>
            <ButtonText onClick={() => props.onDownloadAll(getAllId())}>
              DOWNLOAD ALL
            </ButtonText>
            <LandscapeDownloadIcon />
          </LandscapeButton>
          <LandscapeButton>
            <ButtonText onClick={openFilePicker}> ADD PHOTO</ButtonText>
            <LandscapeAddIcon />
          </LandscapeButton>
        </LandscapeButtonsBg>
      )}

      <AlbumSections>
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
      </AlbumSections>

      <UploadSection>
        <DragNdrop
          onDroppedFiles={(files) => {
            if (files != null) {
              const fileArr = Array.from(files);
              uploadImages(fileArr).catch((e) => console.error(e));
            }
          }}
        />

        <CloudContainer isVisible={props.showUploader} onClick={openFilePicker}>
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
      </UploadSection>
    </Panel>
  );
}

const UploadSection = styled("div", {
  flex: 1,
  display: "flex",
  justifyContent: "center",
});

const AlbumSections = styled("div", {
  display: "flex",
  flexDirection: "column",
});

const LandscapeButtonsBg = styled("div", {
  display: "flex",
  height: "5rem",
  justifyContent: "right",
  alignItems: "center",
  maskSize: "cover",
  backgroundColor: "#0E0E0E",
  maskImage: `url(${landscapeButtonsBg})`,
  maskRepeat: "no-repeat",
  backgroundSize: "100% 100%",
  transition: "display 0.3s",
  variants: {
    show: {
      true: {
        display: "grid",
      },
      false: { display: "none" },
    },
  },
});
const LandscapeButton = styled("button", {
  zIndex: "1",
  background: "#0e0e0e",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#fff",
  border: "solid 2px #333333",
  fontSize: "0.7rem",
  fontWeight: "bold",
  marginRight: "0.6rem",
  borderRadius: "1.5rem",
  padding: "0.5rem",
});
const ButtonText = styled("div", {
  paddingRight: "0.5rem",
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
