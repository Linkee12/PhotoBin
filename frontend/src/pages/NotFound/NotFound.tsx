/* eslint-disable react/no-unescaped-entities */
import { useNavigate } from "react-router";
import { styled } from "../../stitches.config";
import { PrimaryButton } from "../Home/Home";
import { SadBird } from "./SadBird";

/** Shown for an album that does not exist (any more) and for unknown routes. */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Page>
      <Bird />
      <Title>This album doesn't exist</Title>
      <Text>It may have expired, been deleted, or the link is wrong.</Text>
      <PrimaryButton type="button" onClick={() => navigate("/")}>
        <ButtonLabel>Go back home</ButtonLabel>
      </PrimaryButton>
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
  color: "#c0c0c0",
});

const ButtonLabel = styled("span", {
  margin: "1em 0",
});
