import { AlbumItem } from "./AlbumItem";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check3 from "@assets/images/icons/check3.svg?react";
import { styled } from "../../../stitches.config";
import { Panel, PushDown } from "./Panel";

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
    <Panel variant={props.index % 2 == 0 ? 1 : 2}>
      <PanelBody>
        <Header>
          <ShowDate>{props.group.date}</ShowDate>
          <SelectAll
            onClick={() => {
              if (includeAllImages) {
                props.onDeSelect(props.group.thumbnails.map((thumb) => thumb.id));
              } else {
                props.onSelect(props.group.thumbnails.map((thumb) => thumb.id));
              }
            }}
          >
            {includeAllImages ? <CheckIcon as={Check3} /> : <CheckIcon as={Check2} />}
          </SelectAll>
        </Header>
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
  fontSize: "1.42rem",
  color: "#fff",
  marginRight: "1rem",
  fontFamily: "SourceCodeVF",
});

const SelectAll = styled("div", {
  cursor: "pointer",
  width: "1.4rem",
  height: "1.4rem",
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
  alignItems: "end",
  "@portrait": {
    paddingLeft: "1.28rem",
  },
  "@landscape": {
    paddingLeft: "5rem",
  },
});

const CheckIcon = styled("div", {
  width: "1.35rem",
  height: "1.35rem",
});
