import { styled } from "../../../stitches.config";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import Exit from "@assets/images/icons/exit.svg?react";

type OriginalImgProps = {
  url: string;
  visible: boolean;
  onDelete: () => void;
  show: (visible: boolean) => void;
};
export function OriginalImg(props: OriginalImgProps) {
  return (
    <Container isVisible={props.visible}>
      <ButtonBar>
        <ButtonGroup>
          {" "}
          <Button
            onClick={() => {
              props.show(!props.visible);
              props.onDelete();
            }}
          >
            <Icons as={Trash} />
          </Button>
          <Button>
            <Icons as={SimpleCloud} />
          </Button>
        </ButtonGroup>
        <Button onClick={() => props.show(!props.visible)}>
          <Icons as={Exit} />
        </Button>
      </ButtonBar>
      <FullScreenImg src={props.url} key={"1"} />
    </Container>
  );
}

const Container = styled("div", {
  top: "15%",
  left: "15%",
  display: "flex",
  position: "absolute",
  justifyContent: "center",
  width: "70%",
  backgroundColor: "#000",
  zIndex: "9",
  border: "2px solid #444444",
  variants: {
    isVisible: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
  },
});
const FullScreenImg = styled("img", {
  display: "block",
  position: "absolute",
  width: "100%",
  backgroundColor: "#000",
  zIndex: "1",
});
const Button = styled("button", {
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  borderRadius: "1rem",
  height: "2rem",
  size: "2rem",
  color: "#9A9A9A",
  "&:hover": {
    backgroundColor: "#000",
  },
  padding: "5px",
  fontSize: "2rem",
  background: "none",
  border: "none",
  margin: "10px",
});
const Icons = styled("svg", {
  height: "1.5rem",
  width: "2rem",
  color: "#fff",
});
const ButtonBar = styled("div", {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  flex: 1,
  position: "absolute",
  top: "0px",
  zIndex: "2",
});
const ButtonGroup = styled("div", {
  display: "flex",
});
