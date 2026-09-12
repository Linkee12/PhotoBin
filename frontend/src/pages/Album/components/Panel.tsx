import { ReactNode } from "react";
import { styled } from "../../../stitches.config";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";

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
  /** Colour of the section above, which the wave strip curves out of. */
  bandVariant: PanelVariant;
  /**
   * The first section of the album: the toolbar shelf (wide) or the bottom
   * sheet bar (narrow) already draws the curve above it, so it has no strip.
   */
  first?: boolean;
  header: ReactNode;
  children: ReactNode;
};

/** Height of the curved strip between two sections. */
export const WAVE_HEIGHT = "3rem";

/**
 * A group of the album, laid out as in the design: a curved strip where the
 * previous section's colour gives way to this section's body colour, then the
 * header row on the body colour with clear space under the curve, then the
 * tiles.
 */
export function SectionPanel(props: SectionPanelProps) {
  const first = props.first === true;
  return (
    <Section>
      {!first && (
        <WaveStrip data-group-band band={props.bandVariant} aria-hidden="true">
          <WaveEdge body={props.variant} />
        </WaveStrip>
      )}
      <SectionBody body={props.variant} data-section-body>
        <HeaderRow>{props.header}</HeaderRow>
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

/** The strip holding the curve; painted in the previous section's colour. */
const WaveStrip = styled("div", {
  position: "relative",
  width: "100%",
  height: WAVE_HEIGHT,
  pointerEvents: "none",
  transition: "background-color 0.3s",
  variants: { band: bandColors },
});

/**
 * Body colour rising from the bottom-left of the strip over the previous
 * section's colour: the curve of the design.
 */
const WaveEdge = styled("div", {
  position: "absolute",
  inset: 0,
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

/** The header row, on the body colour, kept clear of the curve above it. */
const HeaderRow = styled("div", {
  width: "100%",
  boxSizing: "border-box",
  paddingTop: "1.5rem",
  paddingBottom: "0.5rem",
});

const SectionBody = styled("div", {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  transition: "background-color 0.3s",
  variants: { body: bandColors },
});
