import Edit from "@assets/images/icons/edit.svg?react";
import Share from "@assets/images/icons/share.svg?react";
import Ok from "@assets/images/icons/ok.svg?react";
import { selectionIcon } from "./selectionIcon";
import { styled } from "../../../stitches.config";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { useTimeLeft } from "../hooks/useTimeLeft";
import { pressable, pressableNoScale } from "../../../pressable";
import { SUN_CENTER_BELOW_HEADER, SUN_X, sunBackground } from "../layout";

type HeaderProps = {
  isEmptyAlbum: boolean;
  title: string;
  selectedAll: boolean;
  /** Some, but not all, photos are selected. */
  selectedSome: boolean;
  /** Attached RAW files in the album; 0 hides the "+RAW" toggle. */
  sidecarCount: number;
  selectedSidecarCount: number;
  /** Selects every attached RAW, or deselects them all when all are selected. */
  onToggleAllSidecars: () => void;
  onChangeTitle: (title: string) => void;
  onSaveName: () => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
};

export function Header(props: HeaderProps) {
  const { isEncrypted, expiresAt } = useAlbumContext();
  const timeLeft = useTimeLeft(expiresAt);
  const [isEdit, setIsEdit] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const notify = () => toast.success("Copied URL");
  useEffect(() => {
    if (isEdit && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [isEdit]);
  // The textarea is as tall as its (wrapped) text, like the title it replaces.
  useEffect(() => {
    const input = inputRef.current;
    if (!isEdit || !input) return;
    input.style.height = "0";
    input.style.height = `${input.scrollHeight}px`;
  }, [isEdit, props.title]);
  const isPlaceholder = props.title.length === 0;
  return (
    <Container isEmptyAlbum={props.isEmptyAlbum}>
      {!props.isEmptyAlbum && <Sun aria-hidden="true" />}
      <TextContainer>
        {isEdit ? (
          <Title
            value={props.title}
            ref={inputRef}
            onChange={(e) => props.onChangeTitle(e.target.value)}
            autoCapitalize="sentences"
            onFocus={() => setIsEdit(true)}
            onKeyDown={(event) => {
              if (event.code === "Enter") {
                setIsEdit(false);
                props.onSaveName();
              }
            }}
            onBlur={() => {
              setIsEdit(false);
              props.onSaveName();
            }}
          />
        ) : (
          <Text isPlaceholder={isPlaceholder} onClick={() => setIsEdit(true)}>
            {props.title || "Album title"}
          </Text>
        )}
      </TextContainer>
      <EditTool
        onClick={() => {
          if (isEdit) {
            setIsEdit(false);
            props.onSaveName();
          } else {
            setIsEdit(true);
          }
        }}
      >
        <Icons as={isEdit ? Ok : Edit} />
      </EditTool>
      <BottomRow>
        {!props.isEmptyAlbum && (
          <SelectAllContainer
            type="button"
            aria-pressed={props.selectedAll}
            onClick={props.selectedAll ? props.onUnselectAll : props.onSelectAll}
          >
            <SelectIcon as={selectionIcon(props.selectedAll, props.selectedSome)} />
            <SelectAllLabel>SELECT ALL</SelectAllLabel>
          </SelectAllContainer>
        )}
        {props.sidecarCount > 0 && (
          <SelectAllContainer
            type="button"
            aria-pressed={props.selectedSidecarCount === props.sidecarCount}
            title="Also select the attached RAW files"
            onClick={props.onToggleAllSidecars}
          >
            <SelectIcon
              as={selectionIcon(
                props.selectedSidecarCount === props.sidecarCount,
                props.selectedSidecarCount > 0,
              )}
            />
            <SelectAllLabel>+RAW</SelectAllLabel>
          </SelectAllContainer>
        )}
        {!isEncrypted && (
          <Badge title="This album is stored unencrypted and is readable by the server">
            NOT ENCRYPTED
          </Badge>
        )}
      </BottomRow>
      <ShareRow>
        {timeLeft && <TimeLeft>{timeLeft}</TimeLeft>}
        <Button
          title="Copy the album link"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            notify();
          }}
        >
          <Icons as={Share} share />
        </Button>
      </ShareRow>
    </Container>
  );
}
/**
 * The header's part of the sun; its centre lies below the header, in the
 * toolbar band, which paints the rest (`AlbumContent`). A positioned layer
 * rather than the header's background: the album panel's masked top wave
 * (`Panel`) overlaps the bottom 3rem of the header and would cut the disc with
 * the header's colour (a mask paints in the z-index 0 layer, hence the 1). The
 * box ends with the header, so nothing below it is covered. An empty album has
 * no toolbar to set behind, so it has no sun.
 */
const Sun = styled("div", {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  "@toolbarInline": { backgroundImage: sun(SUN_X.inline) },
  "@toolbarStacked": { backgroundImage: sun(SUN_X.stacked) },
});
function sun(x: string) {
  return sunBackground("transparent", x, `calc(100% + ${SUN_CENTER_BELOW_HEADER})`);
}

const TITLE_FONT_SIZE = "2rem";
const TITLE_LINE_HEIGHT = 1.2;

const Title = styled("textarea", {
  fontFamily: "inherit",
  border: "none",
  borderBottom: "1px solid",
  background: "none",
  overflow: "hidden",
  resize: "none",
  fontSize: TITLE_FONT_SIZE,
  lineHeight: TITLE_LINE_HEIGHT,
  color: "#fff",
  width: "100%",
  padding: 0,
  margin: 0,
  display: "block",
  boxSizing: "border-box",
  "&:focus": { outline: "none" },
});

const Button = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  "&:hover": {
    color: "#fff",
  },
  fontSize: "2rem",
  background: "none",
  border: "none",
  padding: "0px",
  margin: "0px",
});

// Right column, first row: the edit button, centred on the title's first line.
const EditTool = styled(Button, {
  gridArea: "1 / 2",
  justifySelf: "end",
  alignSelf: "start",
  marginTop: `calc((${TITLE_FONT_SIZE} * ${TITLE_LINE_HEIGHT} - 2rem) / 2)`,
  zIndex: 1,
});
// Right column, second row: the share button, on the row of the select-all.
const ShareRow = styled("div", {
  gridArea: "2 / 2",
  justifySelf: "end",
  alignSelf: "center",
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  zIndex: 1,
});
// With the stacked toolbar the time left sits on the sheet handle (Menu) instead.
const TimeLeft = styled("div", {
  color: "#8B8B8B",
  fontFamily: "SourceCodeVF",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
  "@toolbarStacked": { display: "none" },
});
const TextContainer = styled("div", {
  gridArea: "1 / 1",
  minWidth: 0,
  // Above the sun's glow.
  position: "relative",
  zIndex: 1,
});

/**
 * Two columns (title and select-all; edit and share) in two rows. The title
 * wraps and the header grows with it; the second row fills the rest, so the
 * select-all and the share button sit centred between the title and the wave.
 * No bottom padding: the album panel's wave overlaps the bottom 3rem.
 */
const Container = styled("div", {
  position: "relative",
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gridTemplateRows: "auto minmax(4rem, 1fr)",
  columnGap: "2rem",
  padding: "2rem 2rem 0",
  boxSizing: "border-box",
  transition: "background-color 0.3s",
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "rgba(51, 51, 51)",
        minHeight: "11rem",
        // No toolbar below: the panel's wave crosses the bottom 3rem, so the
        // rows keep above it.
        paddingBottom: "3rem",
      },
      false: {
        backgroundColor: "#181818",
        minHeight: "9rem",
      },
    },
  },
});
const BottomRow = styled("div", {
  gridArea: "2 / 1",
  alignSelf: "center",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem 1rem",
  // Above the sun's glow.
  position: "relative",
  zIndex: 1,
});
const Badge = styled("span", {
  fontSize: "0.7rem",
  fontWeight: "700",
  letterSpacing: "0.05em",
  color: "#ffa021",
  border: "1px solid #ffa021",
  borderRadius: "1em",
  padding: "0.15em 0.6em",
  whiteSpace: "nowrap",
});
const SelectAllContainer = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  zIndex: 1,
  background: "none",
  border: "none",
  padding: "0.2rem 0.4rem",
  margin: "0 -0.4rem",
  borderRadius: "1rem",
  color: "#fff",
  fontFamily: "inherit",
  "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.08)" },
});
// Same ring / checked circle as the group headers and the tiles.
const SelectIcon = styled("svg", {
  width: "1.2rem",
  height: "1.2rem",
  overflow: "visible",
});
const SelectAllLabel = styled("span", {
  fontSize: "0.9rem",
  letterSpacing: "0.05em",
});
const Icons = styled("svg", {
  width: "2rem",
  height: "2rem",
  boxSizing: "border-box",
  [`${Button}:hover &`]: {
    fill: "#fff",
  },
  variants: {
    // The share glyph fills its box; the pencil has room around it.
    share: { true: { padding: "0.2rem" }, false: {} },
  },
});

const Text = styled("div", {
  ...pressableNoScale,
  cursor: "text",
  fontSize: TITLE_FONT_SIZE,
  lineHeight: TITLE_LINE_HEIGHT,
  overflowWrap: "anywhere",
  borderRadius: "0.25rem",
  "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.06)" },
  variants: {
    isPlaceholder: {
      true: {
        opacity: 0.5,
      },
      false: {
        opacity: 1,
      },
    },
  },
});
