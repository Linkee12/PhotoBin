import Edit from "@assets/images/icons/edit.svg?react";
import Link from "@assets/images/icons/link.svg?react";
import Ok from "@assets/images/icons/ok.svg?react";
import SelectAll from "@assets/images/icons/selectAll.svg?react";
import UnselectAll from "@assets/images/icons/unselectAll.svg?react";
import { styled } from "../../../stitches.config";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type HeaderProps = {
  isEmptyAlbum: boolean;
  title: string;
  selectedAll: boolean;
  onChangeTitle: (title: string) => void;
  onSaveName: () => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
};

export function Header(props: HeaderProps) {
  const [isEdit, setIsEdit] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const notify = () => toast.success("Copied URL");
  useEffect(() => {
    if (isEdit && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [isEdit]);
  const isPlaceholder = props.title.length === 0;
  return (
    <Container isEmptyAlbum={props.isEmptyAlbum}>
      <StartContainer>
        <TextContainer>
          {isEdit ? (
            <Title
              value={props.title}
              ref={inputRef}
              onChange={(e) => props.onChangeTitle(e.target.value)}
              autoCapitalize="sentences"
              onFocus={() => setIsEdit(true)}
              onKeyDown={(event) => {
                if (event.code === "Enter") {
                  setIsEdit(false);
                  props.onSaveName();
                }
              }}
              onBlur={() => {
                setIsEdit(false);
                props.onSaveName();
              }}
            />
          ) : (
            <Text isPlaceholder={isPlaceholder} onClick={() => setIsEdit(true)}>
              {props.title || "Album title"}
            </Text>
          )}
        </TextContainer>
        <SelectAllContainer
          onClick={props.selectedAll ? props.onUnselectAll : props.onSelectAll}
        >
          {props.isEmptyAlbum ? (
            <></>
          ) : (
            <>
              <Icons as={props.selectedAll ? SelectAll : UnselectAll} />
              <p>SELECT ALL</p>
            </>
          )}
        </SelectAllContainer>
      </StartContainer>
      <Tools>
        <Button
          onClick={() => {
            setIsEdit(true);
          }}
        >
          <Icons as={isEdit ? Ok : Edit} />
        </Button>
        <Button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            notify();
          }}
        >
          <Icons as={Link} />
        </Button>
      </Tools>
    </Container>
  );
}
const Title = styled("textarea", {
  fontFamily: "Open Sans",
  border: "none",
  borderBottom: "1px solid",
  background: "none",
  overflow: "hidden",
  resize: "none",
  fontSize: "1.71rem",
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
  flex: 1,
  height: "2rem",
});

const Container = styled("div", {
  width: "100%",
  display: "flex",
  gap: "2rem",
  justifyContent: "space-between",
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
const StartContainer = styled("div", {
  display: "flex",
  flexDirection: "column",
});
const SelectAllContainer = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "3px",
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
  flex: 1,
  variants: {
    isPlaceholder: {
      true: {
        opacity: 0.5,
      },
      false: {
        opacity: 1,
      },
    },
  },
});
