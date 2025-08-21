import { styled } from "../../../stitches.config";
import Cloud from "@assets/images/icons/cloud.svg?react";
import SimpleCloud from "@assets/images/icons/cloud2.svg?react";
import Trash from "@assets/images/icons/trash.svg?react";
import UnCheckAll from "@assets/images/icons/unCheckAll.svg?react";
export default function Toolbar(props: {
  selectedImages: string[];
  isBusy: boolean;
  onDeleteSelected: () => void;
  onUncheckSelected: () => void;
  onDownloadSelected: () => void;
}) {
  return (
    <ToolBar isVisible={props.selectedImages.length > 0}>
      <Button
        onClick={() => {
          props.onDeleteSelected();
        }}
      >
        <ToolbarIcons as={Trash} />
      </Button>
      <Button disabled={props.isBusy}>
        <ToolbarIcons as={SimpleCloud} onClick={() => props.onDownloadSelected()} />
      </Button>
      <Button>
        <ToolbarIcons as={Cloud} />
      </Button>
      {props.selectedImages.length} item(s) selected
      <Button>
        <ToolbarIcons as={UnCheckAll} onClick={() => props.onUncheckSelected()} />
      </Button>
    </ToolBar>
  );
}

const ToolbarIcons = styled("svg", {
  height: "1.5rem",
  width: "2rem",
  "&:hover": {
    color: "#fff",
  },
});
const ToolBar = styled("div", {
  width: "330px",
  height: "50px",
  borderRadius: "10px",
  backgroundColor: "#1A1A1A",
  boxSizing: "border-box",
  justifyContent: "space-around",
  alignItems: "center",
  position: "fixed",
  bottom: "10px",
  left: "50%",
  transform: "translateX(-50%)",
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
