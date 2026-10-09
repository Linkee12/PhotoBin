import AddIcon from "@assets/images/icons/addIcon.svg?react";
import CloudIcon from "@assets/images/icons/cloud2.svg?react";
import { ComponentType, SVGProps } from "react";
import { Dialog, DialogActions, SecondaryButton } from "../../../components/Dialog";
import { pressable } from "../../../pressable";
import { styled } from "../../../stitches.config";
import { ACCENT_COLOR } from "../../../theme";

/**
 * Where new photos come from: this device's file picker or Google Photos. A
 * source that cannot be used right now is shown greyed out with the reason,
 * so the choice is always visible. A screen of its own on phones, where the
 * toolbar's sheet has no room for a button per source.
 */
export function AddPhotosDialog(props: {
  open: boolean;
  onClose: () => void;
  /** Opens the file picker; called straight from the click, as browsers require. */
  onPickFiles: () => void;
  onImportGooglePhotos: () => void;
  /** Why Google Photos cannot be used now, or `null` when it can. */
  googlePhotosUnavailable: string | null;
}) {
  function choose(action: () => void) {
    props.onClose();
    action();
  }
  return (
    <Dialog open={props.open} title="Add photos" onClose={props.onClose} screen>
      <p>Everything is encrypted in this browser before it is uploaded.</p>
      <Sources>
        <Source
          icon={AddIcon}
          title="From this device"
          text="Photos, videos and RAW files"
          onClick={() => choose(props.onPickFiles)}
        />
        <Source
          icon={CloudIcon}
          title="From Google Photos"
          text={props.googlePhotosUnavailable ?? "Pick photos from your Google account"}
          disabled={props.googlePhotosUnavailable !== null}
          onClick={() => choose(props.onImportGooglePhotos)}
        />
      </Sources>
      <DialogActions>
        <SecondaryButton type="button" onClick={props.onClose}>
          Cancel
        </SecondaryButton>
      </DialogActions>
    </Dialog>
  );
}

function Source(props: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  text: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = props.icon;
  return (
    <SourceButton type="button" disabled={props.disabled} onClick={props.onClick}>
      <IconBox aria-hidden="true">
        <Icon />
      </IconBox>
      <SourceText>
        <SourceTitle>{props.title}</SourceTitle>
        <SourceHint>{props.text}</SourceHint>
      </SourceText>
    </SourceButton>
  );
}

const Sources = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: "0.75em",
  "@narrow": { flex: 1 },
});

const SourceButton = styled("button", {
  ...pressable,
  display: "flex",
  alignItems: "center",
  gap: "1em",
  width: "100%",
  minHeight: "4.5em",
  padding: "0.9em 1.1em",
  boxSizing: "border-box",
  textAlign: "left",
  background: "#0e0e0e",
  color: "#fff",
  border: "solid 2px #333333",
  borderRadius: "1.25em",
  fontFamily: "inherit",
  fontSize: "inherit",
  "&:hover:not(:disabled)": { borderColor: ACCENT_COLOR },
  "&:focus-visible": { outline: `2px solid ${ACCENT_COLOR}`, outlineOffset: "2px" },
  "&:disabled": { opacity: 0.45, cursor: "not-allowed" },
});

const IconBox = styled("span", {
  flexShrink: 0,
  width: "2.5em",
  height: "2.5em",
  borderRadius: "50%",
  background: ACCENT_COLOR,
  color: "#181818",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& svg": { width: "1.3em", height: "1.3em", fill: "#181818" },
  [`${SourceButton}:disabled &`]: { background: "#4a4a4a" },
});

const SourceText = styled("span", {
  display: "flex",
  flexDirection: "column",
  gap: "0.2em",
});

const SourceTitle = styled("span", {
  fontWeight: 700,
});

const SourceHint = styled("span", {
  fontSize: "0.85em",
  color: "#a8a8a8",
});
