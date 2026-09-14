import { useState } from "react";
import { styled } from "../../../stitches.config";
import { pressable } from "../../../pressable";
import {
  DangerButton,
  Dialog,
  DialogActions,
  SecondaryButton,
} from "../../../components/Dialog";
import {
  VisitedAlbum,
  forgetVisitedAlbum,
  listVisitedAlbums,
} from "../../../services/visitedAlbums";
import { formatTimeLeft } from "../../../utils/formatTimeLeft";

/**
 * The albums this browser has opened, newest visit first. A card reopens
 * the album with a full navigation: the stored URL carries the key in its
 * hash, and only a real load re-runs the album context for it. The URL is
 * never shown.
 */
export default function VisitedAlbums() {
  const [albums, setAlbums] = useState(() => listVisitedAlbums());
  const [removing, setRemoving] = useState<VisitedAlbum | null>(null);
  if (albums.length === 0) return null;

  function remove() {
    if (removing) forgetVisitedAlbum(removing.albumId);
    setAlbums(listVisitedAlbums());
    setRemoving(null);
  }

  return (
    <Section aria-label="Your albums">
      <Title>YOUR ALBUMS</Title>
      <Grid>
        {albums.map((album) => (
          <Card key={album.albumId}>
            <Open type="button" onClick={() => window.location.assign(album.url)}>
              <Name>{album.title || "Untitled album"}</Name>
              <Meta>
                {formatTimeLeft(album.expiresAt) || "No expiry"} ·{" "}
                {album.itemCount === 1 ? "1 item" : `${album.itemCount} items`}
              </Meta>
            </Open>
            <Remove
              type="button"
              aria-label="Remove from this list"
              onClick={() => setRemoving(album)}
            >
              ×
            </Remove>
          </Card>
        ))}
      </Grid>
      <Dialog
        open={removing !== null}
        title="Remove from this list"
        onClose={() => setRemoving(null)}
      >
        <p>Remove this album from the list? This does not delete the album.</p>
        <DialogActions>
          <SecondaryButton type="button" onClick={() => setRemoving(null)}>
            Cancel
          </SecondaryButton>
          <DangerButton type="button" onClick={remove}>
            Remove
          </DangerButton>
        </DialogActions>
      </Dialog>
    </Section>
  );
}

const Section = styled("section", {
  width: "min(100% - 2em, 60em)",
  margin: "2em auto 0",
});

const Title = styled("h2", {
  margin: "0 0 1em",
  fontSize: "1rem",
  fontWeight: 700,
});

const Grid = styled("ul", {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(16em, 1fr))",
  gap: "0.75em",
});

const Card = styled("li", {
  position: "relative",
  display: "flex",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#181818",
  border: "solid 2px #333333",
  borderRadius: "1.5rem",
  transition: "border-color 0.15s ease",
  "&:hover": { borderColor: "#4a4a4a" },
});

const Open = styled("button", {
  ...pressable,
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.3em",
  textAlign: "left",
  background: "none",
  border: "none",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: "inherit",
  padding: "1em 3em 1em 1.25em",
  borderRadius: "1.5rem",
});

const Name = styled("span", {
  fontWeight: 700,
  overflowWrap: "anywhere",
});

const Meta = styled("span", {
  fontSize: "0.8em",
  color: "#A8A8A8",
});

const Remove = styled("button", {
  ...pressable,
  position: "absolute",
  top: "0.5em",
  right: "0.6em",
  width: "2rem",
  height: "2rem",
  lineHeight: 1,
  fontSize: "1.5rem",
  background: "none",
  border: "none",
  borderRadius: "50%",
  padding: 0,
  color: "#9A9A9A",
  "&:hover": { color: "#fff", background: "#333333" },
});
