import header from "@assets/images/header.svg?no-inline";
import Edit from "@assets/images/icons/edit.svg?react";
import Link from "@assets/images/icons/link.svg?react";
import { styled } from "../../../stitches.config";

type HeaderProps = {
  isEmptyAlbum: boolean;
  title: string;
  onChangeTitle: (title: string) => void;
};

export function Header(props: HeaderProps) {
  return (
    <HeaderBG isEmptyAlbum={props.isEmptyAlbum}>
      <Container isEmptyAlbum={props.isEmptyAlbum}>
        <TextContainer>
          <Title
            value={props.title}
            placeholder="Title"
            onChange={(e) => props.onChangeTitle(e.target.value)}
            autoCapitalize="sentences"
          />
        </TextContainer>
        <Tools>
          <Button onClick={() => console.log("asd")}>
            <Icons as={Edit} />
          </Button>
          <Button onClick={() => console.log("asd")}>
            <Icons as={Link} />
          </Button>
        </Tools>
      </Container>
    </HeaderBG>
  );
}
const Title = styled("textarea", {
  fontFamily: "Open Sans",
  border: "none",
  background: "none",
  overflow: "hidden",
  resize: "none",
  fontSize: "2rem",
  color: "#fff",
  width: "100%",
  "&:focus": { outline: "none" },
});

const Button = styled("button", {
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  width: "2rem",
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

const Tools = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: "3rem",
});
const TextContainer = styled("div", {
  display: "flex",
  flex: 1,
  flexDirection: "column",
});
const HeaderBG = styled("div", {
  width: "100%",
  flex: 1,
  display: "flex",
  transition: "background-color 0.3s",
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "#181818",
      },
      false: {
        backgroundColor: "#333333",
      },
    },
  },
});

const Container = styled("div", {
  width: "100%",
  minHeight: "20vh",
  display: "flex",
  justifyContent: "space-between",
  maskImage: `url(${header})`,
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "center",
  backgroundSize: "100% 100%",
  padding: "2rem",
  boxSizing: "border-box",
  transition: "background-color 0.3s",
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "#333333",
      },
      false: {
        backgroundColor: "#181818",
      },
    },
  },
});

const Icons = styled("svg", {
  width: "2rem",
  height: "2rem",
  "&:hover": {
    color: "#fff",
  },
});
