import { ReactNode, useEffect, useRef } from "react";
import { styled } from "../stitches.config";
import { pressable } from "../pressable";
import { ACCENT_COLOR } from "../theme";

/**
 * A modal on the native `<dialog>`: `open` drives `showModal()`; Escape and a
 * click on the backdrop close it through `onClose`.
 */
export function Dialog(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (props.open && !dialog.open) dialog.showModal();
    else if (!props.open && dialog.open) dialog.close();
  }, [props.open]);

  return (
    <Modal
      ref={ref}
      onClose={props.onClose}
      // The content box fills the dialog, so a click landing on the dialog
      // element itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <Content>
        <Title>{props.title}</Title>
        {props.children}
      </Content>
    </Modal>
  );
}

const Modal = styled("dialog", {
  padding: 0,
  border: "none",
  borderRadius: "12px",
  backgroundColor: "#1A1A1A",
  color: "#fff",
  width: "min(90vw, 26rem)",
  fontFamily: "Open Sans",
  fontSize: "1rem",
  boxShadow: "0 1rem 3rem rgba(0, 0, 0, 0.6)",
  "&::backdrop": { backgroundColor: "rgba(0, 0, 0, 0.6)" },
});

const Content = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  padding: "1.5rem",
});

const Title = styled("h2", {
  margin: 0,
  fontSize: "1.2rem",
});

/** The row of buttons at the bottom of a dialog, right-aligned. */
export const DialogActions = styled("div", {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.5rem",
});

const button = {
  ...pressable,
  fontFamily: "inherit",
  fontSize: "0.95rem",
  fontWeight: "bold",
  padding: "0.6rem 1.2rem",
  borderRadius: "999px",
  border: "1px solid transparent",
};

/** The destructive action of a dialog. */
export const DangerButton = styled("button", {
  ...button,
  color: "#fff",
  backgroundColor: "#c93838",
  "&:hover:not(:disabled)": { backgroundColor: "#e04545" },
});

/** The safe way out of a dialog. */
export const SecondaryButton = styled("button", {
  ...button,
  color: "#e0e0e0",
  backgroundColor: "transparent",
  borderColor: "#555",
  "&:hover:not(:disabled)": { color: "#fff", borderColor: ACCENT_COLOR },
});
