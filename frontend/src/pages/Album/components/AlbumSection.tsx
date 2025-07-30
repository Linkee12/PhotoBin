import { AlbumItem } from "./AlbumItem";
import header from "@assets/images/albumItemsBg.svg?no-inline";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check3 from "@assets/images/icons/check3.svg?react";
import { styled } from "../../../stitches.config";

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
    <AlbumBgContainer>
      <AlbumBg bg={props.index % 2 === 0} isUploading={props.isUploading}>
        <HeaderContainer
          bg={props.index === 0 ? "first" : props.index % 2 === 0}
          isUploading={props.isUploading}
        >
          <Header bg={props.index % 2 === 0} isUploading={props.isUploading}>
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
      </AlbumBg>
    </AlbumBgContainer>
  );
}
const BG = [
  {
    bg: "true",
    isUploading: "false",
    css: {
      backgroundColor: "#333333",
    },
  },
  {
    bg: "false",
    isUploading: "false",
    css: {
      backgroundColor: "#666666",
    },
  },
  {
    bg: "true",
    isUploading: "true",
    css: {
      backgroundColor: "#181818",
    },
  },
  {
    bg: "false",
    isUploading: "true",
    css: {
      backgroundColor: "#333333",
    },
  },
];
const BGVARIANTS = {
  bg: {
    true: {},
    false: {},
  },
  isUploading: {
    true: {},
    false: {},
  },
};
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
  paddingBottom: "3rem",
  flex: 1,
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

const AlbumBg = styled("div", {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  boxSizing: "border-box",
  transition: "background-color 0.3s",
  flexDirection: "column",
  variants: BGVARIANTS,
  compoundVariants: BG,
});
const Header = styled("div", {
  width: "100%",
  display: "flex",
  height: "3rem",
  alignItems: "end",
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  "@portrait": {
    maskSize: "100% 100%",
    paddingLeft: "1.28rem",
  },
  "@landscape": {
    maskSize: "800px 100%",
    paddingLeft: "5rem",
  },
  backgroundSize: "100% 100%",
  transition: "background-color 0.3s",
  variants: BGVARIANTS,
  compoundVariants: BG,
});
const HeaderContainer = styled("div", {
  width: "100%",
  display: "flex",
  maskRepeat: "no-repeat",
  marginTop: "-3rem",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  transition: "background-color 0.3s",
  variants: {
    bg: {
      true: {},
      false: {},
      first: {},
    },
    isUploading: {
      true: {},
      false: {},
    },
  },

  compoundVariants: [
    {
      bg: "first",
      isUploading: "true",
      css: {
        backgroundColor: "#333333",
      },
    },
    {
      bg: "true",
      isUploading: "false",
      css: {
        backgroundColor: "#666666",
      },
    },
    {
      bg: "false",
      isUploading: "false",
      css: {
        backgroundColor: "#333333",
      },
    },
    {
      bg: "first",
      isUploading: "false",
      css: {
        backgroundColor: "#181818",
      },
    },
    {
      bg: "true",
      isUploading: "true",
      css: {
        backgroundColor: "#333333",
      },
    },
    {
      bg: "false",
      isUploading: "true",
      css: {
        backgroundColor: "#181818",
      },
    },
  ],
});

const CheckIcon = styled("div", {
  width: "1.35rem",
  height: "1.35rem",
});
