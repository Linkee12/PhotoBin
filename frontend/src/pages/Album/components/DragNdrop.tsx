import { useState } from "react";
import { styled } from "../../../stitches.config";
type DragNdropProps = {
  onDroppedFiles: (file: FileList) => void;
};
export function DragNdrop(props: DragNdropProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    console.log("dragover");
  };
  const handleLeaveDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDragEnter = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.preventDefault();
    console.log(e.dataTransfer.files);
    props.onDroppedFiles(e.dataTransfer.files);
  };

  return (
    <Dropzone
      isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleLeaveDrag}
      onDrop={handleDragEnter}
    />
  );
}
const Dropzone = styled("div", {
  display: "flex",
  top: "50vh",
  borderColor: "#ff33",
  flex: 1,
  height: "60vh",
  width: "80%",
  transition: "border 0.2s",
  variants: {
    isDragOver: {
      true: {
        border: "dashed",
      },
      false: {
        border: "none",
      },
    },
  },
});
