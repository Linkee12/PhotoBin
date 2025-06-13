import { createStitches } from "@stitches/react";
import { AlbumItem } from "./AlbumItem";
import header from "@assets/images/albumItemsBg.svg?no-inline";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check3 from "@assets/images/icons/check3.svg?react";

type AlbumItemContainerProps = {
  group: { date: string; thumbnails: { thumbnail: string; id: string }[] };
  index: number;
  selectedImages: string[];
  isUploading: boolean;
  isSelected: (imageId: string) => boolean;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;
};

export function AlbumItemContainer(props: AlbumItemContainerProps) {
  const includeAllImages = props.group.thumbnails.every((img) =>
    props.selectedImages.includes(img.id),
  );

  return (
    <AlbumBgContainer bg={props.index === 0 ? "first" : props.index % 2 === 1}>
      <AlbumBg bg={props.index % 2 === 0}>
        <HeaderContainer bg={props.index === 0 ? "first" : props.index % 2 === 1}>
          <Header bg={props.index % 2 === 1}>
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
        </HeaderContainer>

        <Images>
          {props.group.thumbnails !== undefined &&
            props.group.thumbnails.map((image) => (
              <AlbumItem
                key={image.id}
                imageSrc={image.thumbnail}
                isSelected={props.isSelected(image.id)}
                onSelect={() => props.onSelect([image.id])}
                onDeselect={() => props.onDeSelect([image.id])}
                onOpen={() => props.onOpen(image.id)}
              />
            ))}
        </Images>
      </AlbumBg>
    </AlbumBgContainer>
  );
}
export const { styled, css } = createStitches({
  media: {
    portrait: "(orientation: portrait)",
    landscape: "(orientation: landscape)",
  },
});
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
const AlbumBgContainer = styled("div", {
  display: "flex",
  width: "100%",
  flex: 1,
  variants: {
    bg: {
      true: {
        backgroundColor: "#333333",
      },
      false: {
        backgroundColor: "#666666",
      },
      first: {
        backgroundColor: "#181818",
      },
    },
  },
});
const Images = styled("div", {
  display: "flex",
  gap: "10px",
  maxWidth: "100%",
  flex: 1,
  justifyContent: "center",
  "@portrait": {
    alignItems: "center",
    justifyContent: "center",
  },
  "@landscape": {
    alignContent: "flex-start",
  },
  flexWrap: "wrap",
});
const AlbumBg = styled("div", {
  width: "100%",
  display: "flex",
  padding: "0rem 0rem 1.28rem 1.28rem",
  gap: "2rem",
  justifyContent: "space-between",
  boxSizing: "border-box",
  transition: "background-color 0.3s",
  flexDirection: "column",
  variants: {
    bg: {
      true: {
        backgroundColor: "#333333",
      },
      false: {
        backgroundColor: "#666666",
      },
    },
  },
});
const Header = styled("div", {
  width: "100%",
  display: "flex",
  height: "3.3rem",
  alignItems: "center",
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  transition: "background-color 0.3s",
  variants: {
    bg: {
      true: {
        backgroundColor: "#666666",
      },
      false: {
        backgroundColor: "#333333",
      },
      first: {
        backgroundColor: "#181818",
      },
    },
  },
});
const HeaderContainer = styled("div", {
  width: "100%",
  display: "flex",
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  transition: "background-color 0.3s",
  variants: {
    bg: {
      true: {
        backgroundColor: "#333333",
      },
      false: {
        backgroundColor: "#666666",
      },
      first: {
        backgroundColor: "#181818",
      },
    },
  },
});

const CheckIcon = styled("div", {
  width: "1.35rem",
  height: "1.35rem",
});
