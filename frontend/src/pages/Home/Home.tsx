/* eslint-disable promise/always-return */
/* eslint-disable react/no-unescaped-entities */
import { styled } from "../../stitches.config";
import Header from "./components/Header";
import Intro from "./components/Intro";
import { useNavigate } from "react-router";
import { useState } from "react";
import { genKey } from "../../utils/key";
import { Panel, PanelHeader, PushDown } from "../Album/components/Panel";

export default function Home() {
  const navigate = useNavigate();
  const [encrypt, setEncrypt] = useState(true);

  function createAlbum() {
    const albumId = crypto.randomUUID();
    if (!encrypt) {
      navigate(`/bin/${albumId}`);
      return;
    }
    genKey()
      .then((albumKey) => {
        navigate(`/bin/${albumId}#${albumKey}`);
      })
      .catch((e) => {
        console.error(e);
      });
  }

  return (
    <Container>
      <Header />
      <IntroContainer>
        <Intro />
      </IntroContainer>
      <PushDown style={{ height: "2.5em" }} />
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
        <PushDown style={{ height: "10em" }} />
      </Panel>

      <FloatingFooter>
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
        <Button onClick={createAlbum}>
          <Text css={{ "--weight": "bold" }}>NEW ALBUM</Text>
        </Button>
      </FloatingFooter>
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
const IntroContainer = styled("div", {
  minHeight: "6em",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: "1em",
});

const Button = styled("div", {
  width: "min(80vw,25em)",
  fontWeight: "bold",
  display: "flex",
  justifyContent: "center",
  background:
    "radial-gradient(circle 150px at 50% 180%, #ffa021 40%, #9d6e2f  40%, #ffffff 300%)",
  cursor: "pointer",
  borderRadius: "40px",
  "&:hover": {
    scale: 1.02,
    transitionDuration: 1,
  },
});

const EncryptToggle = styled("label", {
  display: "flex",
  alignItems: "center",
  gap: "0.5em",
  cursor: "pointer",
  fontSize: "0.9em",
  color: "#c0c0c0",
  marginBottom: "0.75em",
  "& input": {
    accentColor: "#ffa021",
    cursor: "pointer",
  },
});

const FloatingFooter = styled("div", {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  display: "flex",
  width: "100vw",
  justifyContent: "center",
  flexDirection: "column",
  alignItems: "center",
  flex: 1,
  backgroundColor: "#333333",
  borderRadius: "50vw 50vw 0 0 / 5vw 5vw 0 0",
  paddingBottom: "1em",
  height: "9.5em",
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
