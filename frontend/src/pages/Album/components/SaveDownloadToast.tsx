import { toast } from "react-toastify";
import { styled } from "../../../stitches.config";
import { NoticeAction } from "../../../components/notifications";
import { needsTapToSave, SavedFile, saveFiles } from "../../../utils/saveBlob";

const Row = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
});

/** Offers finished files on a fresh tap, which iOS requires to save them (`needsTapToSave`). */
function SaveDownloadToast({ name, onSave }: { name: string; onSave: () => void }) {
  return (
    <Row>
      <span>{name} is ready</span>
      <NoticeAction type="button" onClick={onSave}>
        Save
      </NoticeAction>
    </Row>
  );
}

function save(files: SavedFile[]) {
  saveFiles(files).catch((e: unknown) => {
    console.error(e);
    toast.error("Could not save the download");
  });
}

/**
 * Saves files that took a while to prepare: right away where the browser
 * allows it, otherwise behind a Save button in a toast.
 */
export function offerDownload(files: SavedFile[]) {
  if (files.length === 0) return;
  if (!needsTapToSave()) {
    save(files);
    return;
  }
  const name = files.length > 1 ? `${files[0].name} +${files.length - 1}` : files[0].name;
  const toastId = toast(
    <SaveDownloadToast
      name={name}
      onSave={() => {
        save(files);
        toast.dismiss(toastId);
      }}
    />,
    { autoClose: false, closeOnClick: false },
  );
}
