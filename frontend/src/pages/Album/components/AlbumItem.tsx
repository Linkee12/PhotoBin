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
  borderRadius: "10px",
  width: "var(--width, 300px)",
  height: "var(--height, 200px)",
  transition: "width 0.2s, height 0.2s, padding 0.2s",
  objectFit: "contain",
  variants: {
    isSelected: {
      true: {
        "@portrait": {
          width: "calc(100% - 20px)",
          height: "calc(100% - 20px)",
          paddingTop: "10px",
          paddingBottom: "10px",
        },
        "@landscape": {
          width: 280,
          height: 180,
        },
      },
      false: {
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
  borderRadius: "10px",
  width: "var(--width, 300px)",
  aspectRatio: "3 / 2",
  transition: "width 0.2s, height 0.2s",
  variants: {
    isSelected: {
      true: {
        "@portrait": {
          width: "calc(100% - 20px)",
        },
        "@landscape": {
          width: 280,
        },
      },
      false: {
        "@portrait": {
          width: "100%",
        },
        "@landscape": {
          width: 300,
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
          height: 200,
        },
      },
      false: {
        "@portrait": {
          width: "90vw",
        },
        "@landscape": {
          width: 300,
          height: 200,
        },
      },
    },
  },
  margin: "1rem",
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
