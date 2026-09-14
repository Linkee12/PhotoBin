import { useEffect, useState } from "react";
import { styled } from "../../../stitches.config";
import { ACCENT_COLOR } from "../../../theme";
import {
  DangerButton,
  Dialog,
  DialogActions,
  SecondaryButton,
} from "../../../components/Dialog";
import { confirmsDeletion, requiredPhrase } from "../utils/deleteConfirmation";

/** Asks the user to type the album's title before the album is deleted for everyone. */
export function DeleteAlbumDialog(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [input, setInput] = useState("");
  useEffect(() => {
    if (props.open) setInput("");
  }, [props.open]);
  const phrase = requiredPhrase(props.title);

  return (
    <Dialog open={props.open} title="Delete this album?" onClose={props.onClose}>
      <Text>
        Every photo in it is deleted for everyone you shared the link with. This cannot be
        undone.
      </Text>
      {/* method="dialog": Enter in the input submits and closes; a disabled
          button blocks the implicit submission. */}
      <Form method="dialog" onSubmit={props.onConfirm}>
        <Label>
          <span>
            Type <Phrase>&quot;{phrase}&quot;</Phrase> to confirm
          </span>
          <Input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Label>
        <DialogActions>
          <SecondaryButton type="button" onClick={props.onClose}>
            Cancel
          </SecondaryButton>
          <DangerButton type="submit" disabled={!confirmsDeletion(input, props.title)}>
            Delete album
          </DangerButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

const Text = styled("p", {
  margin: 0,
  color: "#c0c0c0",
  lineHeight: 1.5,
});

const Form = styled("form", {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
});

const Label = styled("label", {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  fontSize: "0.9rem",
  color: "#c0c0c0",
});

const Phrase = styled("b", {
  color: "#fff",
  overflowWrap: "anywhere",
});

const Input = styled("input", {
  fontFamily: "inherit",
  fontSize: "1rem",
  color: "#fff",
  backgroundColor: "#0E0E0E",
  border: "1px solid #444",
  borderRadius: "8px",
  padding: "0.6rem 0.8rem",
  "&:focus-visible": { outline: `2px solid ${ACCENT_COLOR}`, outlineOffset: "1px" },
});
