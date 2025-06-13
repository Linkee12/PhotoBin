import Check from "@assets/images/icons/check.svg?react";
import Zoom from "@assets/images/icons/zoom.svg?react";
import { styled } from "../../../stitches.config";

type AlbumItemProps = {
  imageSrc: string;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
};

export function AlbumItem(props: AlbumItemProps) {
  return (
    <div onClick={() => (props.isSelected ? props.onDeselect() : props.onSelect())}>
      <Preview>
        <CheckIcon isVisible={props.isSelected} />
        <Image src={props.imageSrc} isSelected={props.isSelected}></Image>
        <ZoomIcon
          onClick={() => {
            props.onOpen();
          }}
        />
      </Preview>
    </div>
  );
}

const Image = styled("img", {
  display: "block",
  borderRadius: "10px",
  width: "var(--width, 300px)",
  height: "var(--height, 200px)",
  transition: "width 0.2s, height 0.2s",

  variants: {
    isSelected: {
      true: { width: 280, height: 180 },
      false: { width: 300, height: 200 },
    },
  },
});

const Preview = styled("div", {
  width: "300px",
  height: "200px",
  borderRadius: "10px",
  backgroundColor: "#232323",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
});

const CheckIcon = styled(Check, {
  position: "absolute",
  top: "5px",
  left: "5px",
  variants: {
    isVisible: {
      true: {
        visibility: "visible",
      },
      false: {
        visibility: "hidden",
      },
    },
  },
});
const ZoomIcon = styled(Zoom, {
  position: "absolute",
  width: "30px",
  height: "30px",
  bottom: "5px",
  right: "5px",
  cursor: "pointer",
});
