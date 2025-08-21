import { ReactNode, useState } from "react";
import { styled } from "../../../stitches.config";
type DragNdropProps = {
  onDroppedFiles: (file: FileList) => void;
  children: ReactNode;
};
export function DragNdrop(props: DragNdropProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleLeaveDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.preventDefault();
    console.log(e.dataTransfer.files);
    props.onDroppedFiles(e.dataTransfer.files);
  };

  return (
    <Dropzone
      isDragOver={isDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleLeaveDrag}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {props.children}
    </Dropzone>
  );
}
const Dropzone = styled("div", {
  display: "flex",
  flexDirection: "column",
  borderColor: "#ff33",
  justifyContent: "center",
  flex: 1,
  alignItems: "stretch",
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
