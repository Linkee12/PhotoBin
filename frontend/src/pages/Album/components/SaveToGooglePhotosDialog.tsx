import {
  AccentButton,
  Dialog,
  DialogActions,
  SecondaryButton,
} from "../../../components/Dialog";

/**
 * Asks before the selection is sent to Google Photos: the copy there is not
 * encrypted, so a stray click on the cloud button must not be enough.
 */
export function SaveToGooglePhotosDialog(props: {
  /** Files to save; the dialog is open while this is not `null`. */
  count: number | null;
  onClose: () => void;
  /** Called from the click, so Google's sign-in popup may open. */
  onConfirm: () => void;
}) {
  const count = props.count ?? 0;
  return (
    <Dialog
      open={props.count !== null}
      title="Save to Google Photos?"
      onClose={props.onClose}
    >
      <p>
        {count === 1 ? "The selected file is" : `The ${count} selected files are`}{" "}
        decrypted and added to a new album in your Google Photos. That copy is not
        encrypted: Google, and anyone you share it with there, can see it.
      </p>
      <DialogActions>
        <SecondaryButton type="button" autoFocus onClick={props.onClose}>
          Cancel
        </SecondaryButton>
        <AccentButton type="button" onClick={props.onConfirm}>
          Save {count === 1 ? "1 file" : `${count} files`}
        </AccentButton>
      </DialogActions>
    </Dialog>
  );
}
