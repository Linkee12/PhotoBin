import Check from "@assets/images/icons/check.svg?react";
import Circle from "@assets/images/icons/circle.svg?react";
import Zoom from "@assets/images/icons/zoom.svg?react";
import Play from "@assets/images/icons/play.svg?react";
import { keyframes, styled } from "../../../stitches.config";
import { MouseEvent, useEffect, useRef } from "react";

/** Length of the "just uploaded" highlight pulse. */
export const PULSE_MS = 800;

type AlbumItemProps = {
  imageSrc: string | undefined;
  fileName: string;
  isSelected: boolean;
  /** at least one photo is selected: tapping toggles selection instead of opening */
  isSelectionMode: boolean;
  isVideo: boolean;
  /** just uploaded: play the highlight pulse */
  isNew: boolean;
  /** just uploaded and first of its batch: bring it on screen */
  scrollIntoView: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
};

export function AlbumItem(props: AlbumItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.scrollIntoView) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [props.scrollIntoView]);

  const toggleSelect = () => (props.isSelected ? props.onDeselect() : props.onSelect());

  return (
    <Preview
      ref={ref}
      isNew={props.isNew}
      isSelectionMode={props.isSelectionMode}
      onClick={() => (props.isSelectionMode ? toggleSelect() : props.onOpen())}
    >
      {props.isSelected ? (
        <SelectIcon as={Check} data-select-icon isSelectionMode={props.isSelectionMode} />
      ) : (
        <SelectIcon
          as={Circle}
          data-select-icon
          isSelectionMode={props.isSelectionMode}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            toggleSelect();
          }}
        />
      )}
      {props.isVideo === true ? <PlayIcon /> : <></>}
      {props.imageSrc !== undefined ? (
        <Image src={props.imageSrc} isSelected={props.isSelected}></Image>
      ) : (
        <UnsupportedFile isSelected={props.isSelected}>
          <UnsupportedFileName>{formatFilename(props.fileName)}</UnsupportedFileName>
        </UnsupportedFile>
      )}
      {props.isSelectionMode && (
        <ZoomIcon
          onClick={(e) => {
            e.stopPropagation();
            props.onOpen();
          }}
        />
      )}
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

const ACCENT = "#EFC15C";

// Two gentle glows, then gone.
const highlightPulse = keyframes({
  "0%, 50%, 100%": { boxShadow: `0 0 0 0 ${ACCENT}00` },
  "25%, 75%": { boxShadow: `0 0 0 5px ${ACCENT}b3` },
});

const Preview = styled("div", {
  cursor: "pointer",
  variants: {
    isSelectionMode: {
      true: {},
      // In viewing mode the select ring only shows up on hover.
      false: { "&:hover [data-select-icon]": { opacity: 1 } },
    },
    isNew: {
      true: {
        animation: `${highlightPulse} ${PULSE_MS}ms ease-in-out`,
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          boxShadow: `0 0 0 4px ${ACCENT}b3`,
        },
      },
      false: {},
    },
  },
  "@wide": {
    minWidth: "150px",
    maxWidth: "300px",
  },
  "@narrow": {
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

const SelectIcon = styled("svg", {
  position: "absolute",
  top: "5px",
  left: "5px",
  width: "26px",
  height: "26px",
  cursor: "pointer",
  filter: "drop-shadow(0 0 2px rgba(0, 0, 0, 0.8))",
  transition: "opacity 0.15s",
  variants: {
    isSelectionMode: {
      true: { opacity: 1 },
      false: { opacity: 0, "@media (hover: none)": { opacity: 0.7 } },
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
  width: "48px",
  height: "48px",
  color: "#fff",
  opacity: 0.9,
  filter: "drop-shadow(0 0 3px rgba(0, 0, 0, 0.8))",
  pointerEvents: "none",
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
