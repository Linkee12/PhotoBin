import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { styled } from "../../../stitches.config";
import { ACCENT_COLOR } from "../../../theme";
import { Dialog, DialogActions, SecondaryButton } from "../../../components/Dialog";
import { isAbortError } from "../../../utils/retry";
import {
  forgetAccessToken,
  PICKER_SCOPE,
  requestAccessToken,
} from "../services/googlePhotos/googleAuth";
import {
  createPickingSession,
  deletePickingSession,
  downloadPickedItem,
  GooglePhotosError,
  listPickedItems,
  PickingSession,
  pickerWindowUrl,
  waitForPickedItems,
} from "../services/googlePhotos/googlePhotosApi";

/**
 * signin      → nothing asked of Google yet
 * ready       → signed in, picking session created: the next click opens it
 * picking     → the user is choosing in Google Photos' window
 * downloading → the picked files are being fetched into this browser
 */
type Step =
  | { name: "signin" }
  | { name: "ready"; token: string; session: PickingSession }
  | { name: "picking"; token: string; session: PickingSession }
  | { name: "downloading"; done: number; total: number };

/**
 * Import from Google Photos in two clicks: sign in (Google's popup), then open
 * the picker (a second popup, so it needs a click of its own). The picked
 * files are downloaded here and handed to `onFiles`, which uploads them like
 * dropped files: they are encrypted before they leave the browser.
 */
export function GooglePhotosImportDialog(props: {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}) {
  const [step, setStep] = useState<Step>({ name: "signin" });
  const [isBusy, setIsBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<{ token: string; id: string } | null>(null);

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) deletePickingSession(session.token, session.id).catch(() => undefined);
    setStep({ name: "signin" });
    setIsBusy(false);
  }

  // Closing (or unmounting) drops whatever was running.
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    if (!props.open) resetRef.current();
  }, [props.open]);
  useEffect(() => () => resetRef.current(), []);

  function fail(e: unknown) {
    if (isAbortError(e)) return;
    console.error(e);
    // A revoked or expired token: sign in again next time.
    if (e instanceof GooglePhotosError && e.status === 401)
      forgetAccessToken(PICKER_SCOPE);
    toast.error(e instanceof Error ? e.message : "Google Photos import failed");
    reset();
  }

  function signIn() {
    // Synchronously from the click: Google's popup needs the user gesture.
    const token = requestAccessToken(PICKER_SCOPE);
    setIsBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    token
      .then(async (token) => {
        const session = await createPickingSession(token, abort.signal);
        sessionRef.current = { token, id: session.id };
        setStep({ name: "ready", token, session });
        setIsBusy(false);
      })
      .catch(fail);
  }

  function openPicker(token: string, session: PickingSession) {
    window.open(pickerWindowUrl(session.pickerUri), "_blank");
    if (step.name === "picking") return;
    setStep({ name: "picking", token, session });
    const signal = abortRef.current?.signal ?? new AbortController().signal;
    (async () => {
      await waitForPickedItems(token, session, signal);
      const items = await listPickedItems(token, session.id, signal);
      setStep({ name: "downloading", done: 0, total: items.length });
      const files: File[] = [];
      for (const item of items) {
        try {
          files.push(await downloadPickedItem(token, item, signal));
        } catch (e) {
          if (isAbortError(e)) throw e;
          console.error(`Downloading ${item.id} from Google Photos failed`, e);
        }
        setStep((s) => (s.name === "downloading" ? { ...s, done: s.done + 1 } : s));
      }
      if (files.length < items.length) {
        toast.error(
          `${items.length - files.length} of ${items.length} files could not be downloaded`,
        );
      }
      reset();
      props.onClose();
      if (files.length > 0) props.onFiles(files);
    })().catch(fail);
  }

  return (
    <Dialog open={props.open} title="Import from Google Photos" onClose={props.onClose}>
      {step.name === "signin" && (
        <p>
          Sign in with Google and pick the photos to add. They are downloaded to this
          browser and encrypted before upload, like any other photo.
        </p>
      )}
      {step.name === "ready" && <p>Signed in. Choose the photos in Google Photos.</p>}
      {step.name === "picking" && (
        <p>
          Waiting for your selection in Google Photos… Click “Done” there when you have
          picked.
        </p>
      )}
      {step.name === "downloading" && (
        <p>
          Downloading {step.done} of {step.total}…
        </p>
      )}
      <DialogActions>
        <SecondaryButton type="button" onClick={props.onClose}>
          Cancel
        </SecondaryButton>
        {step.name === "signin" && (
          <AccentButton type="button" disabled={isBusy} onClick={signIn}>
            {isBusy ? "Signing in…" : "Continue with Google"}
          </AccentButton>
        )}
        {(step.name === "ready" || step.name === "picking") && (
          <AccentButton
            type="button"
            onClick={() => openPicker(step.token, step.session)}
          >
            {step.name === "ready" ? "Choose photos" : "Open Google Photos again"}
          </AccentButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

const AccentButton = styled(SecondaryButton, {
  background: ACCENT_COLOR,
  borderColor: ACCENT_COLOR,
  color: "#181818",
  "&:hover:not(:disabled)": {
    color: "#000",
    borderColor: ACCENT_COLOR,
    filter: "brightness(1.08)",
  },
  "&:disabled": { opacity: 0.6 },
});
