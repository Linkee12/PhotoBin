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
});

/** A quiet text link; the footer's only content. */
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
