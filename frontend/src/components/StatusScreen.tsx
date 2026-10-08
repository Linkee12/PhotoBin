import { ReactNode } from "react";
import { styled } from "../stitches.config";
import { SadBird } from "../pages/NotFound/SadBird";

/**
 * A whole page that explains why there is nothing to show: the sad bird, a
 * headline, one sentence and the way out (`children`, usually buttons).
 */
export function StatusScreen(props: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <Page role="alert">
      <Bird />
      <Title>{props.title}</Title>
      <Text>{props.text}</Text>
      <Actions>{props.children}</Actions>
    </Page>
  );
}

const Page = styled("div", {
  minHeight: "100dvh",
  boxSizing: "border-box",
  padding: "2rem 1rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontFamily: "Open Sans",
  fontSize: "clamp(14px, 1.5vw, 18px)",
});

const Bird = styled(SadBird, {
  width: "min(60vw, 16rem)",
  height: "auto",
  marginBottom: "1rem",
});

const Title = styled("h1", {
  margin: "0 0 0.5em",
  fontSize: "1.6em",
});

const Text = styled("p", {
  margin: "0 0 2em",
  maxWidth: "28em",
  color: "#c0c0c0",
  lineHeight: 1.5,
});

const Actions = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1em",
});

/** The label inside a `PrimaryButton` on a status screen. */
export const StatusButtonLabel = styled("span", {
  margin: "1em 0",
});

/** The quiet second way out under the main button. */
export const StatusLink = styled("button", {
  background: "none",
  border: "none",
  padding: "0.5em",
  fontFamily: "inherit",
  fontSize: "0.9em",
  color: "#8B8B8B",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  cursor: "pointer",
  "&:hover": { color: "#fff" },
});
