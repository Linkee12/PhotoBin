/* eslint-disable react/no-unescaped-entities */
import { styled } from "../../stitches.config";
import { pressable, pressableNoScale } from "../../pressable";
import { ACCENT_COLOR } from "../../theme";
import Header from "./components/Header";
import { useNavigate } from "react-router";
import { useState } from "react";
import { Panel, PanelHeader, PushDown } from "../Album/components/Panel";

export default function Home() {
  const navigate = useNavigate();
  const [encrypt, setEncrypt] = useState(true);

  function createAlbum() {
    navigate(encrypt ? "/new" : "/new?plain");
  }

  return (
    <Container>
      <Header />
      <Start>
        <Text css={{ "--color": "#808080" }}>
          {encrypt ? "Start your E2E encrypted album" : "Start your unencrypted album"}
        </Text>
        <EncryptToggle>
          <input
            type="checkbox"
            checked={encrypt}
            onChange={(e) => setEncrypt(e.target.checked)}
          />
          Encrypt album (recommended)
        </EncryptToggle>
        <PrimaryButton type="button" onClick={createAlbum}>
          <Text as="span" css={{ "--weight": "bold", margin: "1em 0" }}>
            NEW ALBUM
          </Text>
        </PrimaryButton>
      </Start>
      {/* The panel's wave starts 3rem above its body: this leaves the same 3em
          between the button and the wave as between the header and the text. */}
      <PushDown style={{ height: "calc(2em + 3rem)" }} />
      <Panel variant={0} zIndex={0}>
        <PanelHeader>
          <PanelTitle>ABOUT</PanelTitle>
        </PanelHeader>
        <P>
          <Text>
            Photobin is a <b>temporary</b> photo album provider with <b>E2E encryption</b>
            . You can share photos and each participant can <b>export</b> them to their
            storage of choice.
          </Text>
          <Text>
            The server has no way viewing your photos without the key, and the browser
            doesn't send the key to the server because everything after "#" is ignored in
            an http request.
          </Text>
          <Text>
            You can also create an <b>unencrypted</b> album. Its photos are stored as-is,
            so the server (and anyone with access to it) can read them. Only do this when
            you don't need privacy from the server.
          </Text>
          <Text css={{ "--size": "1.2em", "--weight": "bold" }}>
            Photobin is free and open-source!
          </Text>
        </P>
        <PushDown style={{ height: "2em" }} />
      </Panel>
    </Container>
  );
}

const Container = styled("div", {
  background:
    "radial-gradient(rgb(55, 58, 69), rgb(29, 29, 29)) center 100px / 100vw 100vw",
  width: "100%",
  height: "auto",
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  flexDirection: "column",
  position: "relative",
  fontFamily: "Open Sans",
  fontSize: "clamp(14px, 1.5vw, 18px)",
});
// The call to action, right under the header.
const Start = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: "1em",
  minHeight: "6em",
});

/** The landing page's call to action; the not-found page uses the same one. */
export const PrimaryButton = styled("button", {
  ...pressable,
  width: "min(80vw,25em)",
  fontWeight: "bold",
  fontFamily: "inherit",
  fontSize: "inherit",
  color: "inherit",
  border: "none",
  padding: 0,
  display: "flex",
  justifyContent: "center",
  background:
    "radial-gradient(circle 150px at 50% 180%, #ffa021 40%, #9d6e2f  40%, #ffffff 300%)",
  borderRadius: "40px",
  "&:hover": { transform: "scale(1.02)", filter: "brightness(1.08)" },
  "&:active:not(:disabled)": { transform: "scale(0.98)" },
});

const EncryptToggle = styled("label", {
  ...pressableNoScale,
  display: "flex",
  alignItems: "center",
  gap: "0.5em",
  fontSize: "0.9em",
  color: "#c0c0c0",
  marginBottom: "0.75em",
  "&:hover": { color: "#fff" },
  "& input": {
    accentColor: ACCENT_COLOR,
    cursor: "pointer",
    "&:focus-visible": { outline: `2px solid ${ACCENT_COLOR}`, outlineOffset: "2px" },
  },
});

const Text = styled("p", {
  fontSize: "var(--size, 1em)",
  color: "var(--color)",
  fontWeight: "var(--weight, 500)",
});

const PanelTitle = styled("h2", {
  margin: "2rem 0 0 2rem",
  fontSize: "1rem",
  fontWeight: "700",
});

const P = styled("span", {
  maxWidth: "26em",
  margin: "auto",
  padding: "2.5em",
  textAlign: "justify",
});
