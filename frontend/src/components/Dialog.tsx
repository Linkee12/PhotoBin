import { ReactNode, useEffect, useRef } from "react";
import { styled } from "../stitches.config";
import { pressable } from "../pressable";

type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Called on Escape, on a click outside the box and after a `close()`. */
  onClose: () => void;
};

/**
 * A modal box on the native `<dialog>` top layer. The caller owns `open`:
 * the element is shown with `showModal()` while it is true, and every way
 * the platform closes it (Escape) or the user dismisses it (backdrop click)
 * reports through `onClose`, so the caller only has to flip its state.
 */
export function Dialog(props: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open === props.open) return;
    if (props.open) dialog.showModal();
    else dialog.close();
  }, [props.open]);
  return (
    <Box
      ref={ref}
      onClose={props.onClose}
      // The box itself is only hit outside its padded body: on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      aria-label={props.title}
    >
      <Body>
        <Title>{props.title}</Title>
        {props.children}
      </Body>
    </Box>
  );
}

const Box = styled("dialog", {
  padding: 0,
  border: "solid 2px #333333",
  borderRadius: "1.5rem",
  background: "#181818",
  color: "#fff",
  fontFamily: "Open Sans",
  fontSize: "clamp(14px, 1.5vw, 18px)",
  width: "min(calc(100vw - 2rem), 26em)",
  boxSizing: "border-box",
  boxShadow: "0 1rem 3rem rgba(0, 0, 0, 0.6)",
  "&::backdrop": { background: "rgba(0, 0, 0, 0.6)" },
});

const Body = styled("div", {
  padding: "1.5em 1.75em",
  display: "flex",
  flexDirection: "column",
  gap: "1em",
  "& p": { margin: 0, color: "#c0c0c0", lineHeight: 1.5 },
});

const Title = styled("h2", {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 700,
});

/** The row of buttons at the bottom of a dialog, right-aligned. */
export const DialogActions = styled("div", {
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "0.5em",
  marginTop: "0.5em",
});

const button = {
  ...pressable,
  boxSizing: "border-box",
  height: "2.25rem",
  padding: "0 1.1rem",
  borderRadius: "1.5rem",
  border: "solid 2px #333333",
  fontFamily: "inherit",
  fontSize: "0.8rem",
  fontWeight: "bold",
} as const;

export const SecondaryButton = styled("button", {
  ...button,
  background: "#181818",
  color: "#A8A8A8",
  "&:hover:not(:disabled)": { color: "#fff", borderColor: "#4a4a4a" },
});

export const DangerButton = styled("button", {
  ...button,
  background: "#b3261e",
  borderColor: "#b3261e",
  color: "#fff",
  "&:hover:not(:disabled)": { filter: "brightness(1.12)" },
});
