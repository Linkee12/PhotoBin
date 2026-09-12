import { ReactNode } from "react";
import { styled } from "../../../stitches.config";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import {
  SHEET_BAR_HEIGHT,
  SHELF_COLOR,
  TOOLBAR_HEIGHT,
  TOOLBAR_RESERVED_WIDTH,
} from "./Menu";

const COLORS = ["#181818", "#333333", "#666666"];

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
   * The first section of the album: its band is transparent so the toolbar
   * shelf shows through, and on wide viewports it shares the toolbar's row.
   */
  first?: boolean;
  header: ReactNode;
  children: ReactNode;
};

/**
 * A group of the album. The header sits in the wave: a band whose height
 * comes from the header's content and padding, with the curved edge between
 * the band colour and the body colour drawn as its background, stretched to
 * the band. Whatever the header's height, it stays inside the curve.
 */
export function SectionPanel(props: SectionPanelProps) {
  const first = props.first === true;
  return (
    <Section>
      <Band data-group-band first={first} band={props.bandVariant}>
        <WaveEdge body={props.variant} aria-hidden="true" />
        <BandContent>{props.header}</BandContent>
      </Band>
      <SectionBody body={props.variant}>{props.children}</SectionBody>
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
  transition: "background-color 0.3s",
  variants: {
    band: bandColors,
    first: {
      true: {
        // Transparent so the toolbar shelf shows through. Share the row with
        // the toolbar buttons where there is room; keep clear of them (they
        // are right-aligned) with reserved padding.
        "@wide": { background: "none" },
        "@toolbarInline": {
          marginTop: `-${TOOLBAR_HEIGHT}`,
          minHeight: TOOLBAR_HEIGHT,
          paddingRight: TOOLBAR_RESERVED_WIDTH,
        },
        // Continues the bottom sheet's (empty) bar, which it sits on.
        "@narrow": {
          marginTop: `-${SHEET_BAR_HEIGHT}`,
          minHeight: SHEET_BAR_HEIGHT,
          background: SHELF_COLOR,
        },
      },
      false: {},
    },
  },
});

/** The header row, painted above the curve. */
const BandContent = styled("div", {
  position: "relative",
  width: "100%",
});

/**
 * Curved edge of the body colour rising from the bottom-left of the band over
 * the band colour; the mask stretches to whatever height the band has.
 */
const WaveEdge = styled("div", {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  maskImage: `url(${albumItemsBg})`,
  maskRepeat: "no-repeat",
  "@narrow": {
    maskSize: "100% 100%",
  },
  "@wide": {
    maskSize: "min(800px, 100%) 100%",
  },
  transition: "background-color 0.3s",
  variants: { body: bandColors },
});

const SectionBody = styled("div", {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  transition: "background-color 0.3s",
  variants: { body: bandColors },
});
