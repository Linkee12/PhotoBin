import { ReactNode } from "react";
import { styled } from "../../../stitches.config";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";

const COLORS = ["#181818", "#333333", "#666666"];

type PanelProps = {
  children: ReactNode;
  variant: 0 | 1 | 2;
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
  "@portrait": {
    maskSize: "100% 100%",
  },
  "@landscape": {
    maskSize: "min(800px, 100%) 100%",
  },
  transition: "background-color 0.3s",
});
