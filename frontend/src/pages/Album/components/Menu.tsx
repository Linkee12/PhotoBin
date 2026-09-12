import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import SlideUp from "@assets/images/icons/slideUp.svg?react";
import SlideDown from "@assets/images/icons/slideDown.svg?react";
import AddIcon from "@assets/images/icons/addIcon.svg?react";
import { styled } from "../../../stitches.config";
import { useState } from "react";
import { AlbumView } from "../../../utils/groupFiles";

/** Background of the toolbar shelf and the narrow bottom sheet. */
export const SHELF_COLOR = "#0E0E0E";
/** Height of the wide toolbar shelf; the first group's band overlaps it on `@toolbarInline`. */
export const TOOLBAR_HEIGHT = "5rem";
/** Width kept free at the right of the first group's header for the toolbar buttons. */
export const TOOLBAR_RESERVED_WIDTH = "27rem";
/** Height of the narrow bottom-sheet's closed bar; the first group's header sits on it. */
export const SHEET_BAR_HEIGHT = "3rem";

type MenuProps = {
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
      <LandscapeButtonsBg>
        <ViewToggle view={props.view} onChangeView={props.onChangeView} />
        <Button disabled={props.isBusy} onClick={props.onDownloadAll}>
          <ButtonText>DOWNLOAD ALL</ButtonText>
          <LandscapeDownloadIcon />
        </Button>
        <Button onClick={props.onAddPhoto}>
          <ButtonText>ADD PHOTO</ButtonText>
          <AddIcon />
        </Button>
      </LandscapeButtonsBg>
      <PortraitButtonsContainer onClick={() => setIsOpen(!isOpen)}>
        <PortraitHeader isOpen={isOpen} data-sheet-handle>
          <SlideIconUp as={SlideUp} />
        </PortraitHeader>
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

/** Wide toolbar: a dark shelf with the buttons right-aligned; wraps when the row is short. */
const LandscapeButtonsBg = styled("div", {
  "@narrow": { display: "none" },
  "@wide": { display: "flex" },
  flexWrap: "wrap",
  gap: "0.6rem",
  justifyContent: "flex-end",
  alignItems: "center",
  boxSizing: "border-box",
  minHeight: TOOLBAR_HEIGHT,
  padding: "0.6rem 0.6rem 0.6rem 8rem",
  backgroundColor: SHELF_COLOR,
  // The curve only spans the part left of the buttons; the reserved part under
  // the buttons is solid, so the curve never crosses them however wide they get.
  maskImage: `url(${landscapeButtonsBg}), linear-gradient(#000, #000)`,
  maskRepeat: "no-repeat, no-repeat",
  maskSize: `calc(100% - ${TOOLBAR_RESERVED_WIDTH}) 100%, ${TOOLBAR_RESERVED_WIDTH} 100%`,
  maskPosition: "left top, right top",
});

const PortraitButtonsContainer = styled("div", {
  "@narrow": { display: "flex" },
  "@wide": { display: "none" },
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

const PortraitHeader = styled("div", {
  display: "flex",
  width: "100%",
  justifyContent: "center",
  alignItems: "end",
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "bottom",
  height: SHEET_BAR_HEIGHT,
  backgroundColor: SHELF_COLOR,
  maskImage: `url(${albumItemsBg})`,
  transition: "height 0.4s",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  variants: {
    isOpen: {
      true: { height: "0rem", overflow: "hidden" },
      false: { height: SHEET_BAR_HEIGHT },
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
  "@narrow": { width: "100%" },
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
  color: "#8B8B8B",
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
});
const ButtonText = styled("div", {
  paddingRight: "0.5rem",
});
const SlideIconUp = styled("div", {
  margin: "0.5rem",
});
const SlideIconDown = styled("div", {
  margin: "1.5rem 0 3.5rem",
});
