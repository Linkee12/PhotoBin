import { styled } from "../../../stitches.config";
import { SecondaryButton } from "../../../components/Dialog";

const Row = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75em",
});

/** Offers the finished zip on a fresh tap, which iOS requires to save it (`needsTapToSave`). */
export function SaveDownloadToast({
  name,
  onSave,
}: {
  name: string;
  onSave: () => void;
}) {
  return (
    <Row>
      <span>{name} is ready</span>
      <SecondaryButton type="button" onClick={onSave}>
        Save
      </SecondaryButton>
    </Row>
  );
}
