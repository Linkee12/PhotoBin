import BirdUrl from "@assets/images/icons/bird.svg?no-inline";
import { Link } from "react-router";
import { pressableNoScale } from "../../../pressable";
import { styled } from "../../../stitches.config";

/** The footer's height; the page reserves it as bottom padding so the footer never covers content. */
const FOOTER_HEIGHT = "4rem";

/** The album page: header, panel and the footer anchored at its bottom. */
export const AlbumFrame = styled("div", {
  width: "100%",
  minHeight: "100vh",
  boxSizing: "border-box",
  // Room for the footer, which is anchored to this box.
  position: "relative",
  paddingBottom: FOOTER_HEIGHT,
  fontFamily: "Open Sans",
  display: "flex",
  flexDirection: "column",
  variants: {
    isEmptyAlbum: {
      true: {
        backgroundColor: "rgba(51, 51, 51)",
      },
      false: {
        backgroundColor: "#181818",
      },
    },
  },
});

/**
 * The page's last row: the PhotoBin bird (home), "Refresh thumbnails" and
 * "Delete this album". `busy` names why the two buttons are disabled.
 */
export function AlbumFooter(props: {
  onRefreshThumbnails: () => void;
  isRefreshingThumbnails: boolean;
  onDeleteAlbum: () => void;
  isDeletingAlbum: boolean;
  busy?: string;
}) {
  const isBusy = props.busy !== undefined;
  return (
    <Footer>
      <HomeLink to="/" aria-label="PhotoBin home" title="PhotoBin home">
        <Bird src={BirdUrl} alt="" />
        <Wordmark>
          Photo<b>Bin</b>
        </Wordmark>
      </HomeLink>
      <Dot aria-hidden="true">·</Dot>
      <FooterLink
        type="button"
        disabled={isBusy || props.isRefreshingThumbnails || props.isDeletingAlbum}
        title={props.busy ?? "Redo old thumbnails so they show each photo's whole frame"}
        onClick={props.onRefreshThumbnails}
      >
        Refresh thumbnails
      </FooterLink>
      <Dot aria-hidden="true">·</Dot>
      {/* An upload finishing after the delete would recreate nothing (the
          server refuses writes into a missing album), but it would still
          fail noisily: keep the two apart. */}
      <FooterLink
        type="button"
        disabled={isBusy || props.isDeletingAlbum}
        title={props.busy}
        onClick={props.onDeleteAlbum}
      >
        Delete this album
      </FooterLink>
    </Footer>
  );
}

/** Sits at the very bottom of the page, even when the page is shorter than the viewport. */
export const Footer = styled("footer", {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: FOOTER_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.25rem",
  padding: "0 1rem",
  boxSizing: "border-box",
});

/** A quiet text link. */
export const FooterLink = styled("button", {
  ...pressableNoScale,
  background: "none",
  border: "none",
  padding: "0.5rem",
  fontFamily: "inherit",
  fontSize: "0.85rem",
  color: "#8B8B8B",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  "&:hover:not(:disabled)": { color: "#fff" },
});

const HomeLink = styled(Link, {
  ...pressableNoScale,
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem",
  color: "#8B8B8B",
  textDecoration: "none",
  fontSize: "0.85rem",
  opacity: 0.8,
  "&:hover": { color: "#fff", opacity: 1 },
});

const Bird = styled("img", {
  height: "0.9rem",
  width: "auto",
});

/** The landing page's wordmark, small; left out on phones, where the bird is enough. */
const Wordmark = styled("span", {
  "@narrow": { display: "none" },
});

const Dot = styled("span", {
  color: "#5a5a5a",
});
