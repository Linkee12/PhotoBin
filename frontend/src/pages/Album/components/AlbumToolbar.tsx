import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import SlideDown from "@assets/images/icons/slideDown.svg?react";
import AddIcon from "@assets/images/icons/addIcon.svg?react";
import { styled } from "../../../stitches.config";
import { Ref, useState } from "react";
import { AlbumView } from "../utils/groupFiles";
import { ACCENT_COLOR } from "../../../theme";
import {
  CONTROL_HEIGHT,
  SHEET_BAR_HEIGHT,
  SHELF_COLOR,
  TOOLBAR_HEIGHT,
  WAVE_HEIGHT,
} from "../layout";
import { WaveEdge } from "./Panel";
import { pressable, pressableNoScale } from "../../../pressable";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { useTimeLeft } from "../hooks/useTimeLeft";
import { WaveMenuIcon } from "./WaveMenuIcon";

/**
 * The hamburger of the collapsed sheet, in px (`WAVE_HEIGHT` and
 * `SHEET_BAR_HEIGHT` are 3rem = 48px at the default root font size). The
 * collapsed sheet is the shelf between the handle's curve and the first
 * group's water, `SHEET_BAR_HEIGHT` thick; the bars are centred in it.
 */
const MENU_ICON_WIDTH_PX = 28;
const MENU_ICON_WAVE_HEIGHT_PX = 48;
const MENU_ICON_HEIGHT_PX = 96;
const MENU_ICON_CENTER_BELOW_CURVE_PX = 24;

/** Share of the toolbar row the first group's header gets: the part of the wave with the most water above it. */
const HEADER_SHARE = "33.333%";

type AlbumToolbarProps = {
  /**
   * Receives the element the first group's header is rendered into on
   * `@toolbarInline`, where it shares the toolbar row with the buttons.
   */
  headerSlotRef: Ref<HTMLDivElement>;
  onDownloadAll: () => void;
  onAddPhoto: () => void;
  isBusy: boolean;
  view: AlbumView;
  onChangeView: (view: AlbumView) => void;
};

const VIEW_LABELS: { view: AlbumView; label: string }[] = [
  { view: "history", label: "HISTORY" },
  { view: "date", label: "DATE" },
];

/** Segmented "group by" switch: upload history or photo date. */
function ViewToggle(props: { view: AlbumView; onChangeView: (view: AlbumView) => void }) {
  return (
    <Segmented role="radiogroup" aria-label="Group photos by" data-view-toggle>
      {VIEW_LABELS.map(({ view, label }) => (
        <Segment
          key={view}
          role="radio"
          aria-checked={props.view === view}
          active={props.view === view}
          data-view={view}
          onClick={(e) => {
            e.stopPropagation();
            props.onChangeView(view);
          }}
        >
          {label}
        </Segment>
      ))}
    </Segmented>
  );
}

type ControlsProps = Pick<
  AlbumToolbarProps,
  "onDownloadAll" | "onAddPhoto" | "isBusy" | "view" | "onChangeView"
>;

/**
 * The three controls, in the wide row (`data-toolbar-control`, measured by
 * the layout check) or in the bottom sheet, where a button fills the width
 * with its label centred between a spacer and the icon, is only tabbable
 * while the sheet is open, and closes the sheet once used.
 */
function Controls(
  props: ControlsProps & { sheet?: { isOpen: boolean; close: () => void } },
) {
  const { sheet } = props;
  const inRow = sheet === undefined;
  const control = inRow
    ? { "data-toolbar-control": true }
    : { tabIndex: sheet.isOpen ? 0 : -1 };
  const act = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    sheet?.close();
  };
  const toggle = <ViewToggle view={props.view} onChangeView={props.onChangeView} />;
  return (
    <>
      {inRow ? <div data-toolbar-control>{toggle}</div> : toggle}
      <Button disabled={props.isBusy} onClick={act(props.onDownloadAll)} {...control}>
        {!inRow && <div />}
        <span>DOWNLOAD ALL</span>
        <LandscapeDownloadIcon />
      </Button>
      <Button accent onClick={act(props.onAddPhoto)} {...control}>
        {!inRow && <div />}
        <span>ADD PHOTO</span>
        <AddIcon />
      </Button>
    </>
  );
}

export function AlbumToolbar(props: AlbumToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeLeft = useTimeLeft(useAlbumContext().expiresAt);

  return (
    <>
      <Toolbar data-toolbar>
        <Wave>
          <Shelf aria-hidden="true" />
          <WaveEdge body={1} aria-hidden="true" />
          <HeaderSlot ref={props.headerSlotRef} />
        </Wave>
        <ToolbarControls>
          <Controls {...props} />
        </ToolbarControls>
      </Toolbar>
      <PortraitButtonsContainer
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close the menu" : "Open the menu"}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <PortraitHeader isOpen={isOpen} data-sheet-handle />
        {!isOpen && timeLeft && <HandleTimeLeft>{timeLeft}</HandleTimeLeft>}
        {!isOpen && (
          <MenuIcon
            width={MENU_ICON_WIDTH_PX}
            height={MENU_ICON_HEIGHT_PX}
            waveHeight={MENU_ICON_WAVE_HEIGHT_PX}
            centerBelowCurve={MENU_ICON_CENTER_BELOW_CURVE_PX}
          />
        )}
        <Sheet isOpen={isOpen} aria-hidden={!isOpen}>
          <SheetContent>
            <Buttons>
              <Controls {...props} sheet={{ isOpen, close: () => setIsOpen(false) }} />
            </Buttons>
            <SlideIconDown as={SlideDown} />
          </SheetContent>
        </Sheet>
      </PortraitButtonsContainer>
    </>
  );
}

/**
 * Wide toolbar: one row shared by the first group's header (left third of the
 * wave, in its water) and the buttons (right, on the solid shelf). The row is
 * as tall as the taller of the two, and both the shelf and the water are
 * stretched to it, so the header never crosses the wave however many lines
 * it wraps to.
 */
const Toolbar = styled("div", {
  "@toolbarStacked": { display: "none" },
  "@toolbarInline": { display: "flex" },
  alignItems: "stretch",
  boxSizing: "border-box",
  minHeight: TOOLBAR_HEIGHT,
});

/**
 * The wave: everything left of the buttons. The shelf rises from its
 * bottom-left to full height before the buttons; the water descends from its
 * top-left to its bottom-right, so it reaches the bottom where the buttons
 * start and never runs under them.
 */
const Wave = styled("div", {
  position: "relative",
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
});

const Shelf = styled("div", {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundColor: SHELF_COLOR,
  maskImage: `url(${landscapeButtonsBg})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
});

const HeaderSlot = styled("div", {
  position: "relative",
  flex: `0 0 ${HEADER_SHARE}`,
  minWidth: 0,
});

const ToolbarControls = styled("div", {
  display: "flex",
  gap: "0.6rem",
  alignItems: "center",
  // The right edge lines up with the header's and the grid's 2rem gutter.
  padding: "0.6rem 2rem 0.6rem 0.6rem",
  backgroundColor: SHELF_COLOR,
});

const PortraitButtonsContainer = styled("div", {
  "@toolbarStacked": { display: "flex" },
  "@toolbarInline": { display: "none" },
  position: "relative",
  ...pressableNoScale,
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  // Handle (wave with the chevron) on top, the sheet's bar below it.
  height: `calc(${SHEET_BAR_HEIGHT} * 2)`,
});

/**
 * Bottom sheet, anchored to the bar so it grows upwards over the album header.
 * Closed it is the empty bar; open it is as tall as its buttons.
 */
const Sheet = styled("div", {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "grid",
  minHeight: SHEET_BAR_HEIGHT,
  backgroundColor: SHELF_COLOR,
  transition: "grid-template-rows 0.4s",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  variants: {
    isOpen: {
      true: { gridTemplateRows: "1fr" },
      false: { gridTemplateRows: "0fr" },
    },
  },
});

const SheetContent = styled("div", {
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
  padding: "1rem 5% 0",
});

/**
 * Over the handle and the bar (which the handle's mask would clip it to);
 * measures the container's width, which the handle's wave is stretched over.
 */
const MenuIcon = styled(WaveMenuIcon, {
  position: "absolute",
  top: 0,
  left: "50%",
  marginLeft: `-${MENU_ICON_WIDTH_PX / 2}px`,
  pointerEvents: "none",
  zIndex: 1,
  color: "#e0e0e0",
  transition: "color 0.15s ease, transform 0.15s ease",
  [`${PortraitButtonsContainer}:hover &`]: {
    color: "#fff",
    transform: "translateY(-2px)",
  },
  [`${PortraitButtonsContainer}:active &`]: { transform: "translateY(1px)" },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

// Time left in the handle's wave band, right-aligned, under the menu icon's row.
const HandleTimeLeft = styled("div", {
  position: "absolute",
  top: 0,
  right: "2rem",
  display: "flex",
  alignItems: "center",
  color: "#8B8B8B",
  fontFamily: "SourceCodeVF",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
  pointerEvents: "none",
});

const PortraitHeader = styled("div", {
  width: "100%",
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "bottom",
  height: WAVE_HEIGHT,
  backgroundColor: SHELF_COLOR,
  maskImage: `url(${albumItemsBg})`,
  transition: "height 0.4s",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  variants: {
    isOpen: {
      true: { height: "0rem", overflow: "hidden" },
      false: { height: WAVE_HEIGHT },
    },
  },
});

// Same shell as the view toggle: border, radius, text size and height.
const Button = styled("button", {
  display: "flex",
  flexShrink: 0,
  boxSizing: "border-box",
  background: SHELF_COLOR,
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
  color: "#A8A8A8",
  border: "solid 2px #333333",
  fontSize: "0.7rem",
  fontWeight: "bold",
  fontFamily: "inherit",
  borderRadius: "1.5rem",
  height: CONTROL_HEIGHT,
  padding: "0 0.5rem 0 0.9rem",
  ...pressable,
  "&:hover:not(:disabled)": { color: "#fff", borderColor: "#4a4a4a" },
  "& svg": { width: "1.2rem", height: "1.2rem", flexShrink: 0 },
  // In the bottom sheet the buttons fill its width.
  "@toolbarStacked": { width: "100%" },
  variants: {
    accent: {
      true: {
        background: ACCENT_COLOR,
        borderColor: ACCENT_COLOR,
        color: "#181818",
        "& svg": { fill: "#181818" },
        "&:hover:not(:disabled)": {
          color: "#000",
          borderColor: ACCENT_COLOR,
          filter: "brightness(1.08)",
        },
      },
      false: {},
    },
  },
});
const Segmented = styled("div", {
  display: "inline-flex",
  flexShrink: 0,
  boxSizing: "border-box",
  height: CONTROL_HEIGHT,
  border: "solid 2px #333333",
  borderRadius: "1.5rem",
  overflow: "hidden",
  background: SHELF_COLOR,
});
const Segment = styled("button", {
  background: "none",
  border: "none",
  color: "#A8A8A8",
  fontSize: "0.7rem",
  fontWeight: "bold",
  fontFamily: "inherit",
  padding: "0 0.9rem",
  ...pressableNoScale,
  "&:hover": { color: "#fff", background: "rgba(255, 255, 255, 0.06)" },
  "&:active": { background: "rgba(255, 255, 255, 0.12)" },
  // Inside the pill the ring would be clipped: draw it inside instead.
  "&:focus-visible": { outline: `2px solid ${ACCENT_COLOR}`, outlineOffset: "-2px" },
  variants: {
    active: {
      true: {
        background: "#333333",
        color: "#fff",
        "&:hover": { background: "#333333" },
      },
      false: {},
    },
  },
});
const Buttons = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
  width: "100%",
  // The sheet also serves landscape phones and small desktop windows.
  maxWidth: "30rem",
});
const SlideIconDown = styled("div", {
  margin: "1.5rem 0 3.5rem",
});
