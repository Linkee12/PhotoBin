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
    <div onClick={() => (props.isSelected ? props.onDeselect() : props.onSelect())}>
      <Preview isSelected={props.isSelected}>
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
    </div>
  );
}

const Image = styled("img", {
  display: "block",
  width: "var(--width, 300px)",
  height: "var(--height, 200px)",
  transition: "width 0.2s, height 0.2s, padding 0.2s, border-radius 0.2s",
  objectFit: "cover",
  variants: {
    isSelected: {
      true: {
        borderRadius: "4px",
        "@portrait": {
          width: "calc(100% - 20px)",
          height: "calc(100% - 20px)",
        },
        "@landscape": {
          width: 280,
          height: 180,
        },
      },
      false: {
        borderRadius: "10px",
        "@portrait": {
          width: "100%",
          height: "auto",
        },
        "@landscape": {
          width: 300,
          height: 200,
        },
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
        "@portrait": {
          width: "calc(100% - 20px)",
          height: "calc(100% - 20px)",
        },
        "@landscape": {
          objectFit: "cover",
          width: 280,
          height: 180,
        },
      },
      false: {
        borderRadius: "10px",
        "@portrait": {
          width: "100%",
          height: "auto",
        },
        "@landscape": {
          width: 300,
          height: 200,
        },
      },
    },
  },
});
const UnsupportedFileName = styled("p", {
  fontSize: "1.2rem",
  fontFamily: "Open Sans",
});

const Preview = styled("div", {
  variants: {
    isSelected: {
      true: {
        "@portrait": {
          width: "90vw",
        },
        "@landscape": {
          width: 300,
        },
      },
      false: {
        "@portrait": {
          width: "90vw",
        },
        "@landscape": {
          width: 300,
        },
      },
    },
  },
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
