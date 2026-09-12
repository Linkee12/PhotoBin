import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { styled } from "../../../stitches.config";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import {
  PANEL_COLORS as COLORS,
  SHEET_BAR_HEIGHT,
  SHELF_COLOR,
  TOOLBAR_HEIGHT,
  WAVE_HEIGHT,
} from "./layout";

export type PanelVariant = 0 | 1 | 2;

type PanelProps = {
  children: ReactNode;
  variant: PanelVariant;
  zIndex?: number;
};
export function Panel(props: PanelProps) {
  return (
    <Content>
      <ContentHeader style={{ background: COLORS[props.variant] }} />
      <ContentBody style={{ background: COLORS[props.variant], zIndex: props.zIndex }}>
        {props.children}
      </ContentBody>
    </Content>
  );
}

type SectionPanelProps = {
  /** Colour of the section body. */
  variant: PanelVariant;
  /** Colour of the band the header sits in — the panel above ends with it. */
  bandVariant: PanelVariant;
  /**
   * The first section of the album: its band continues the bottom sheet's bar
   * it sits on (the toolbar is that sheet whenever the section has no
   * `headerSlot`).
   */
  first?: boolean;
  /**
   * Where the toolbar shelf shares its row with this section's header: the
   * header is rendered there instead of in a band of its own, and the shelf
   * draws the wave (see `Menu`).
   */
  headerSlot?: HTMLElement | null;
  header: ReactNode;
  children: ReactNode;
};

/**
 * A group of the album. The header sits in the water of the wave: a band
 * whose height comes from the header's content and padding, with the curved
 * edge between the band colour and the body colour drawn as its background.
 * With the wide toolbar the curve is stretched to the band, exactly like the
 * toolbar row the first group's header is in; with the bottom sheet it spans
 * the top `WAVE_HEIGHT` of the band, the same span as the sheet's handle, so
 * the two run parallel.
 */
export function SectionPanel(props: SectionPanelProps) {
  const first = props.first === true;
  return (
    <Section>
      {props.headerSlot ? (
        createPortal(props.header, props.headerSlot)
      ) : (
        <Band data-group-band first={first} band={props.bandVariant}>
          <BandWave body={props.variant} aria-hidden="true" />
          <BandContent>{props.header}</BandContent>
        </Band>
      )}
      <SectionBody body={props.variant} data-section-body>
        {props.children}
      </SectionBody>
    </Section>
  );
}

const bandColors = {
  0: { background: COLORS[0] },
  1: { background: COLORS[1] },
  2: { background: COLORS[2] },
};

export const PanelInteractive = styled("div", {});

export const PushDown = styled("div", {
  width: "100%",
  height: "3rem",
});

export const PanelHeader = styled("div", {
  marginTop: "-3rem",
  pointerEvents: "auto",
  width: "0",
});

const Content = styled("div", {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  marginTop: "-3rem",
  pointerEvents: "none",
});

const ContentBody = styled("div", {
  flex: "1",
  width: "100%",
  transition: "background-color 0.3s",
  display: "flex",
  flexDirection: "column",
  pointerEvents: "auto",
});

const ContentHeader = styled("div", {
  display: "flex",
  width: "100%",
  flex: "3rem",
  maxHeight: "3rem",
  maskImage: `url(${albumItemsBg})`,
  maskRepeat: "no-repeat",
  "@narrow": {
    maskSize: "100% 100%",
  },
  "@wide": {
    maskSize: "min(800px, 100%) 100%",
  },
  transition: "background-color 0.3s",
});

const Section = styled("section", {
  display: "flex",
  flexDirection: "column",
  width: "100%",
});

const Band = styled("div", {
  // Painted above the (masked) toolbar shelf it may overlap; only the header
  // row itself takes clicks so the toolbar buttons beside it stay reachable.
  position: "relative",
  pointerEvents: "none",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  width: "100%",
  boxSizing: "border-box",
  // As tall as the toolbar row the first group's header shares.
  "@toolbarInline": { minHeight: TOOLBAR_HEIGHT },
  transition: "background-color 0.3s",
  variants: {
    band: bandColors,
    first: {
      // Continues the bottom sheet's (empty) bar, which it sits on.
      true: {
        marginTop: `-${SHEET_BAR_HEIGHT}`,
        minHeight: SHEET_BAR_HEIGHT,
        background: SHELF_COLOR,
      },
      false: {},
    },
  },
});

/** The header row, painted inside the wave. Its own padding keeps it under the curve. */
const BandContent = styled("div", {
  position: "relative",
  // The left third of the wave, as in the toolbar row.
  "@toolbarInline": { width: "33.333%" },
  "@toolbarStacked": { width: "100%" },
});

/**
 * The water: body colour under a curve descending from the top-left of the
 * band to its bottom-right, over the band colour. The mask is stretched over
 * the whole band, so the slope is gentle at any width and a header at the
 * left stays inside the curve. Also drawn by the toolbar shelf for the first
 * group's header (`Menu`).
 */
export const WaveEdge = styled("div", {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  maskImage: `url(${albumItemsBg})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  transition: "background-color 0.3s",
  variants: { body: bandColors },
});

/**
 * The band's water. With the bottom sheet: the curve over the top
 * `WAVE_HEIGHT` of the band and solid body colour under it.
 */
const BandWave = styled(WaveEdge, {
  "@toolbarStacked": {
    maskImage: `url(${albumItemsBg}), linear-gradient(#000, #000)`,
    maskRepeat: "no-repeat, no-repeat",
    maskSize: `100% ${WAVE_HEIGHT}, 100% calc(100% - ${WAVE_HEIGHT})`,
    maskPosition: "left top, left bottom",
  },
});

const SectionBody = styled("div", {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  transition: "background-color 0.3s",
  variants: { body: bandColors },
});
