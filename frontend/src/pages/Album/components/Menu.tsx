import landscapeButtonsBg from "@assets/images/landscapeButtonsBg.svg?no-inline";
import LandscapeDownloadIcon from "@assets/images/icons/landscapeDownloadIcon.svg?react";
import LandscapeAddIcon from "@assets/images/icons/landscapeAddIcon.svg?react";
import { styled } from "../../../stitches.config";

type MenuProps = {
  onDownloadAll: () => void;
  onAddPhoto: () => void;
  isBusy: boolean;
};

export function Menu(props: MenuProps) {
  return (
    <LandscapeButtonsBg>
      <LandscapeButton disabled={props.isBusy}>
        <ButtonText onClick={props.onDownloadAll}>DOWNLOAD ALL</ButtonText>
        <LandscapeDownloadIcon />
      </LandscapeButton>
      <LandscapeButton>
        <ButtonText onClick={props.onAddPhoto}> ADD PHOTO</ButtonText>
        <LandscapeAddIcon />
      </LandscapeButton>
    </LandscapeButtonsBg>
  );
}

const LandscapeButtonsBg = styled("div", {
  display: "flex",
  height: "5rem",
  justifyContent: "right",
  alignItems: "center",
  maskSize: "cover",
  backgroundColor: "#0E0E0E",
  maskImage: `url(${landscapeButtonsBg})`,
  maskRepeat: "no-repeat",
  backgroundSize: "100% 100%",
  transition: "display 0.3s",
  variants: {
    show: {
      true: {
        display: "grid",
      },
      false: { display: "none" },
    },
  },
});

const LandscapeButton = styled("button", {
  zIndex: "1",
  background: "#0e0e0e",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#fff",
  border: "solid 2px #333333",
  fontSize: "0.7rem",
  fontWeight: "bold",
  marginRight: "0.6rem",
  borderRadius: "1.5rem",
  padding: "0.5rem",
  cursor: "pointer",
});

const ButtonText = styled("div", {
  paddingRight: "0.5rem",
});
