import { AlbumItem } from "./AlbumItem";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import { styled } from "../../../stitches.config";
import { Panel, PanelHeader, PushDown } from "./Panel";

type AlbumSectionProps = {
  group: {
    date: string;
    thumbnails: {
      thumbnail: string | undefined;
      name: string;
      id: string;
      isVideo: boolean;
    }[];
  };
  index: number;
  selectedImages: string[];
  isUploading: boolean;
  isSelected: (imageId: string) => boolean;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;
};

export function AlbumSection(props: AlbumSectionProps) {
  const includeAllImages = props.group.thumbnails.every((img) =>
    props.selectedImages.includes(img.id),
  );

  return (
    <Panel zIndex={0} variant={props.index % 2 == 0 ? 1 : 2}>
      <PanelHeader>
        <Header>
          <ShowDate>
            {props.group.date}

            <SelectAll
              onClick={() => {
                if (includeAllImages) {
                  props.onDeSelect(props.group.thumbnails.map((thumb) => thumb.id));
                } else {
                  props.onSelect(props.group.thumbnails.map((thumb) => thumb.id));
                }
              }}
            >
              {includeAllImages ? <CheckIcon as={Check} /> : <CheckIcon as={Check2} />}
            </SelectAll>
          </ShowDate>
        </Header>
      </PanelHeader>
      <PanelBody>
        <Images>
          {props.group.thumbnails !== undefined &&
            props.group.thumbnails.map((image) => (
              <AlbumItem
                key={image.id}
                isVideo={image.isVideo}
                imageSrc={image.thumbnail}
                fileName={image.name}
                isSelected={props.isSelected(image.id)}
                onSelect={() => props.onSelect([image.id])}
                onDeselect={() => props.onDeSelect([image.id])}
                onOpen={() => props.onOpen(image.id)}
              />
            ))}
        </Images>
      </PanelBody>
      <PushDown />
    </Panel>
  );
}

const PanelBody = styled("div", {});
const ShowDate = styled("div", {
  display: "flex",
  alignItems: "center",
  fontSize: "1.42rem",
  color: "#fff",
  marginRight: "1rem",
  fontFamily: "SourceCodeVF",
  height: "3rem",
});

const SelectAll = styled("div", {
  cursor: "pointer",
  width: "1.4rem",
  height: "1.4rem",
  marginLeft: "0.5rem",
});

const Images = styled("div", {
  display: "flex",
  gap: "10px",
  maxWidth: "100%",
  flex: 1,
  justifyContent: "center",
  "@portrait": {
    justifyContent: "center",
    margin: "1rem 1.28rem 1.28rem 1.28rem",
  },
  "@landscape": {
    justifyContent: "flex-start",
    margin: "1.9rem 1.9rem 1.9rem 1.9rem",
  },
  flexWrap: "wrap",
});
const Header = styled("div", {
  width: "100%",
  display: "flex",
  height: "3rem",
  alignItems: "center",
  "@portrait": {
    paddingLeft: "1.28rem",
  },
  "@landscape": {
    paddingLeft: "5rem",
  },
});

const CheckIcon = styled("div", {
  overflow: "visible",
});
