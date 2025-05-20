import header from "@assets/images/header.svg?no-inline";
import Edit from "@assets/images/icons/edit.svg?react";
import Link from "@assets/images/icons/link.svg?react";
import Ok from "@assets/images/icons/ok.svg?react";
import { styled } from "../../../stitches.config";
import { useState } from "react";

type HeaderProps = {
  isEmptyAlbum: boolean;
  title: string;
  onChangeTitle: (title: string) => void;
  onSaveName: () => void;
};

export function Header(props: HeaderProps) {
  const [isEdit, setIsEdit] = useState(false);
  return (
    <HeaderBG isEmptyAlbum={props.isEmptyAlbum}>
      <Container isEmptyAlbum={props.isEmptyAlbum}>
        <TextContainer>
          {isEdit ? (
            <Title
              value={props.title}
              onChange={(e) => props.onChangeTitle(e.target.value)}
              autoCapitalize="sentences"
              onFocus={() => setIsEdit(true)}
              onBlur={() => {
                setIsEdit(false);
                props.onSaveName();
              }}
            />
          ) : (
            <Text onClick={() => setIsEdit(true)}>{props.title}</Text>
          )}
        </TextContainer>
        <Tools>
          <Button onClick={() => setIsEdit(true)}>
            <Icons as={isEdit ? Ok : Edit} />
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
  borderBottom: "1px solid",
  background: "none",
  overflow: "hidden",
  resize: "none",
  fontSize: "2rem",
  color: "#fff",
  width: "100%",
  "&:focus": { outline: "none" },
  height: "3rem",
});

const Button = styled("button", {
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
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
  alignItems: "end",
  gap: "3rem",
});
const TextContainer = styled("div", {
  display: "flex",
  width: "98%",
  height: "2rem",
});
const HeaderBG = styled("div", {
  width: "100%",
  maxHeight: "25vh",
  minHeight: "25vh",
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
        backgroundColor: "rgba(51, 51, 51)",
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
  [`${Button}:hover &`]: {
    fill: "#fff",
  },
});

const Text = styled("div", {
  fontSize: "2rem",
  height: "2rem",
});
