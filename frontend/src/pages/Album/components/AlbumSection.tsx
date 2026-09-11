import { AlbumItem } from "./AlbumItem";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import { styled } from "../../../stitches.config";
import { Panel, PanelHeader, PushDown } from "./Panel";
import { Thumbnail } from "../Album";

type AlbumSectionProps = {
  group: {
    date: string;
    thumbnails: Thumbnail[];
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
  alignItems: "flex-end",
  gap: "0.5rem",
  fontSize: "1.42rem",
  color: "#fff",
  fontFamily: "SourceCodeVF",
  height: "100%",
});

const SelectAll = styled("div", {
  cursor: "pointer",
  width: "1.4rem",
  height: "1.4rem",
  display: "flex",
  alignItems: "flex-end",
});

const Images = styled("div", {
  maxWidth: "100%",
  "@narrow": {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: "1rem 1.28rem 1.28rem 1.28rem",
    gap: "10px",
  },
  "@wide": {
    display: "grid",
    gap: "20px",
    justifyItems: "center",
    // As many columns as fit; each tile is at least 230px and grows up to the
    // 300px cap set on the tile itself (see AlbumItem's Preview).
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))",
    margin: "1.9rem 1.9rem 1.9rem 1.9rem",
  },
});
const Header = styled("div", {
  width: "100%",
  display: "flex",
  height: "3rem",
  alignItems: "center",
  "@narrow": {
    paddingLeft: "1.28rem",
  },
  "@wide": {
    paddingLeft: "5rem",
  },
});

const CheckIcon = styled("div", {
  overflow: "visible",
});
