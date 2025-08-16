import { ReactNode } from "react";
import { styled } from "../../../stitches.config";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";

const COLORS = ["#181818", "#333333", "#666666"];

type PanelProps = {
  children: ReactNode;
  variant: 0 | 1 | 2;
};
export function Panel(props: PanelProps) {
  return (
    <Content>
      <ContentHeader style={{ background: COLORS[props.variant] }} />
      <ContentBody style={{ background: COLORS[props.variant] }}>
        {props.children}
      </ContentBody>
    </Content>
  );
}

export const PushDown = styled("div", {
  width: "100%",
  height: "3rem",
});

const Content = styled("div", {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  marginTop: "-3rem",
});

const ContentBody = styled("div", {
  flex: "1",
  width: "100%",
  transition: "background-color 0.3s",
  display: "flex",
  flexDirection: "column",
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
