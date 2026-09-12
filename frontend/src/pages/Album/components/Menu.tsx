import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import SlideDown from "@assets/images/icons/slideDown.svg?react";
import AddIcon from "@assets/images/icons/addIcon.svg?react";
import { styled } from "../../../stitches.config";
import { Ref, useState } from "react";
import { AlbumView } from "../../../utils/groupFiles";
import { SHEET_BAR_HEIGHT, SHELF_COLOR, TOOLBAR_HEIGHT, WAVE_HEIGHT } from "./layout";
import { WaveEdge } from "./Panel";
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

type MenuProps = {
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

export function Menu(props: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Toolbar data-toolbar>
        <Wave>
          <Shelf aria-hidden="true" />
          <WaveEdge body={1} aria-hidden="true" />
          <HeaderSlot ref={props.headerSlotRef} />
        </Wave>
        <ToolbarControls>
          <div data-toolbar-control>
            <ViewToggle view={props.view} onChangeView={props.onChangeView} />
          </div>
          <Button
            disabled={props.isBusy}
            onClick={props.onDownloadAll}
            data-toolbar-control
          >
            <ButtonText>DOWNLOAD ALL</ButtonText>
            <LandscapeDownloadIcon />
          </Button>
          <Button onClick={props.onAddPhoto} data-toolbar-control>
            <ButtonText>ADD PHOTO</ButtonText>
            <AddIcon />
          </Button>
        </ToolbarControls>
      </Toolbar>
      <PortraitButtonsContainer onClick={() => setIsOpen(!isOpen)}>
        <PortraitHeader isOpen={isOpen} data-sheet-handle />
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
              <ViewToggle view={props.view} onChangeView={props.onChangeView} />
              <Button
                disabled={props.isBusy}
                tabIndex={isOpen ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDownloadAll();
                  setIsOpen(false);
                }}
              >
                <div />
                <ButtonText>DOWNLOAD ALL</ButtonText>
                <LandscapeDownloadIcon />
              </Button>
              <Button
                tabIndex={isOpen ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onAddPhoto();
                  setIsOpen(false);
                }}
              >
                <div />
                <ButtonText>ADD PHOTO</ButtonText>
                <AddIcon />
              </Button>
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
  padding: "0.6rem",
  backgroundColor: SHELF_COLOR,
});

const PortraitButtonsContainer = styled("div", {
  "@toolbarStacked": { display: "flex" },
  "@toolbarInline": { display: "none" },
  position: "relative",
  cursor: "pointer",
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

const Button = styled("button", {
  display: "flex",
  flexShrink: 0,
  background: SHELF_COLOR,
  justifyContent: "space-between",
  alignItems: "center",
  color: "#fff",
  border: "solid 2px #333333",
  fontSize: "0.7rem",
  fontWeight: "bold",
  fontFamily: "inherit",
  borderRadius: "1.5rem",
  height: "2.5rem",
  padding: "0.5rem",
  cursor: "pointer",
  // In the bottom sheet the buttons fill its width.
  "@toolbarStacked": { width: "100%" },
});
const Segmented = styled("div", {
  display: "inline-flex",
  flexShrink: 0,
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
  padding: "0.5rem 0.9rem",
  cursor: "pointer",
  "&:hover": { color: "#fff" },
  variants: {
    active: {
      true: { background: "#333333", color: "#fff" },
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
const ButtonText = styled("div", {
  paddingRight: "0.5rem",
});
const SlideIconDown = styled("div", {
  margin: "1.5rem 0 3.5rem",
});
