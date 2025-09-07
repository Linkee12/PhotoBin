import Check from "@assets/images/icons/check.svg?react";
import Zoom from "@assets/images/icons/zoom.svg?react";
import Play from "@assets/images/icons/play.svg?react";
import { styled } from "../../../stitches.config";

type AlbumItemProps = {
  imageSrc: string | undefined;
  fileName: string;
  isSelected: boolean;
  isVideo: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
};

export function AlbumItem(props: AlbumItemProps) {
  return (
    <Preview onClick={() => (props.isSelected ? props.onDeselect() : props.onSelect())}>
      <CheckIcon isVisible={props.isSelected} />
      {props.isVideo === true ? <PlayIcon /> : <></>}
      {props.imageSrc !== undefined ? (
        <Image src={props.imageSrc} isSelected={props.isSelected}></Image>
      ) : (
        <UnsupportedFile isSelected={props.isSelected}>
          <UnsupportedFileName>{formatFilename(props.fileName)}</UnsupportedFileName>
        </UnsupportedFile>
      )}
      <ZoomIcon
        onClick={() => {
          props.onOpen();
        }}
      />
    </Preview>
  );
}

const Image = styled("img", {
  display: "block",
  transition: "width 0.2s, height 0.2s, padding 0.2s, border-radius 0.2s",
  objectFit: "cover",
  variants: {
    isSelected: {
      true: {
        borderRadius: "4px",
        width: "calc(100% - 20px)",
        height: "calc(100% - 20px)",
      },
      false: {
        borderRadius: "10px",
        width: "100%",
        height: "auto",
      },
    },
  },
});

const UnsupportedFile = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#595959",
  transition: "width 0.2s, height 0.2s",
  aspectRatio: "3 / 2",
  variants: {
    isSelected: {
      true: {
        borderRadius: "4px",
        width: "calc(100% - 20px)",
        height: "calc(100% - 20px)",
      },
      false: {
        borderRadius: "10px",
        width: "100%",
        height: "auto",
      },
    },
  },
});
const UnsupportedFileName = styled("p", {
  fontSize: "1.2rem",
  fontFamily: "Open Sans",
});

const Preview = styled("div", {
  "@landscape": {
    minWidth: "150px",
    maxWidth: "300px",
  },
  "@portrait": {
    width: "90vw",
  },
  width: "100%",
  aspectRatio: "3/2",
  margin: "0.5rem",
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

const PlayIcon = styled(Play, {
  position: "absolute",
  width: "60px",
  height: "60px",
  alignItems: "center",
  cursor: "pointer",
});
function formatFilename(filename: string): string {
  if (filename.length <= 20) {
    return filename;
  }

  const lastDotIndex = filename.lastIndexOf(".");
  const fileType = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : "";
  const namePart = filename.slice(0, 15);

  return `${namePart}... ${fileType}`;
}
