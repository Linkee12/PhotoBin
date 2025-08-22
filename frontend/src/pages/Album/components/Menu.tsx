import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import albumItemsBg from "@assets/images/albumItemsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import SlideUp from "@assets/images/icons/slideUp.svg?react";
import LandscapeAddIcon from "@assets/images/icons/landscapeAddIcon.svg?react";
import { styled } from "../../../stitches.config";
import { useEffect, useState } from "react";

type MenuProps = {
  onDownloadAll: () => void;
  onAddPhoto: () => void;
  isBusy: boolean;
};

export function Menu(props: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShowButton(true), 400);
    } else {
      setShowButton(false);
    }
  }, [isOpen]);

  return (
    <>
      <LandscapeButtonsBg>
        <Button disabled={props.isBusy}>
          <ButtonText onClick={props.onDownloadAll}>DOWNLOAD ALL</ButtonText>
          <LandscapeDownloadIcon />
        </Button>
        <Button>
          <ButtonText onClick={props.onAddPhoto}> ADD PHOTO</ButtonText>
          <LandscapeAddIcon />
        </Button>
      </LandscapeButtonsBg>
      <PortraitButtonsContainer onClick={() => setIsOpen(!isOpen)}>
        <PortraitButtonsHeader isOpen={isOpen} />
        <Bottom isOpen={isOpen}>
          <SlideUp />
          <Button disabled={props.isBusy} isOpen={showButton && isOpen}>
            <div></div>
            <ButtonText onClick={props.onDownloadAll}>DOWNLOAD ALL</ButtonText>
            <LandscapeDownloadIcon />
          </Button>
          <Button isOpen={showButton && isOpen}>
            <div></div>
            <ButtonText onClick={props.onAddPhoto}> ADD PHOTO</ButtonText>
            <LandscapeAddIcon />
          </Button>
        </Bottom>
      </PortraitButtonsContainer>
    </>
  );
}

const LandscapeButtonsBg = styled("div", {
  "@portrait": { display: "none" },
  "@landscape": { display: "flex" },
  maskRepeat: "no-repeat",
  backgroundSize: "100% 100%",
  height: "5rem",
  justifyContent: "right",
  alignItems: "center",
  maskSize: "cover",
  backgroundColor: "#0E0E0E",
  maskImage: `url(${landscapeButtonsBg})`,
  variants: {
    show: {
      true: {
        display: "grid",
      },
      false: { display: "none" },
    },
  },
});

const PortraitButtonsContainer = styled("div", {
  "@portrait": { display: "flex" },
  "@landscape": { display: "none" },
  cursor: "pointer",
  flexDirection: "column",
  transition: "display 0.3s , height 0.4s",
  justifyContent: "flex-end",
  alignItems: "center",
  height: "6rem",
  variants: {
    show: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
  },
});
const Bottom = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  height: "3rem",
  cursor: "pointer",
  width: "100%",
  backgroundColor: "#0E0E0E",
  transition: "margin 0.4s , height 0.4s",
  variants: {
    isOpen: {
      true: { marginTop: "-18rem", height: "18rem" },
      false: { height: "3rem" },
    },
  },
});

const PortraitButtonsHeader = styled("div", {
  display: "flex",
  width: "100%",
  maskRepeat: "no-repeat",
  maskSize: "100% 100%",
  maskPosition: "bottom",
  height: "3rem",
  backgroundColor: "#0E0E0E",
  maskImage: `url(${albumItemsBg})`,
  variants: {
    isOpen: {
      true: { height: "0rem", overflow: "hidden" },
      false: { height: "3rem" },
    },
  },
});

const Button = styled("button", {
  zIndex: "1",
  background: "#0e0e0e",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#fff",
  border: "solid 2px #333333",
  fontSize: "0.7rem",
  fontWeight: "bold",
  marginRight: "0.6rem",
  borderRadius: "1.5rem",
  height: "2.5rem",
  padding: "0.5rem",
  cursor: "pointer",
  "@landscape": { display: "flex" },
  variants: {
    isOpen: {
      true: {
        "@portrait": { display: "flex", marginTop: "1rem", width: "90%" },
      },
      false: {
        "@portrait": { display: "none" },
      },
    },
  },
});

const ButtonText = styled("div", {
  paddingRight: "0.5rem",
});
