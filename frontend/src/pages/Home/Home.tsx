/* eslint-disable promise/always-return */
/* eslint-disable react/no-unescaped-entities */
import { styled } from "../../stitches.config";
import Header from "./components/Header";
import IntroImg from "./components/intro";
import { useNavigate } from "react-router";
import { genKey } from "../../utils/key";
import { Panel, PanelHeader, PushDown } from "../Album/components/Panel";

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container>
      <Header />
      <Intro>
        <IntroImg />
      </Intro>
      <PushDown style={{ height: "2.5em" }} />
      <Panel variant={0} zIndex={0}>
        <PanelHeader>
          <PanelTitle>ABOUT</PanelTitle>
        </PanelHeader>
        <Paragraph>
          <Text>
            Photobin is a temporary photo album provider with E2E encryption. You can
            share photos and each participant can export them to their storage of choice.
          </Text>
          <Text>
            The server has no way viewing your photos without the key, and the browser
            doesn't send the key to the server because everything after "#" is ignored in
            an http request.
          </Text>
          <Text css={{ "--size": "1.6em", "--weight": "bold" }}>
            Photobin is free and open-source!
          </Text>
        </Paragraph>
        <PushDown />
        <PushDown />
        <PushDown />
      </Panel>

      <FloatingFooter>
        <Text css={{ "--color": "#808080" }}>Start your E2E encripted album</Text>
        <Button
          onClick={() => {
            genKey()
              .then((key) => {
                const albumId = encodeURIComponent(crypto.randomUUID());
                const albumKey = encodeURIComponent(key);
                navigate(`/bin/${albumId}#${albumKey}`);
              })
              .catch((e) => {
                console.error(e);
              });
          }}
        >
          <Text css={{ "--weight": "bold" }}>NEW ALBUM</Text>
        </Button>
      </FloatingFooter>
    </Container>
  );
}

const Container = styled("div", {
  background: "radial-gradient(rgba(134, 147, 192, 0.25), rgba(32, 32, 32, 0.25))",
  width: "100%",
  height: "auto",
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  flexDirection: "column",
  position: "relative",
  fontFamily: "Open Sans",

  "@mobile": {
    fontSize: "12px",
  },
});
const Intro = styled("div", {
  minHeight: "6em",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: "1em",
});

const Button = styled("div", {
  width: "25em",
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
  borderRadius: "40% 40% 0 0",
  paddingBottom: "1em",
});

const Text = styled("p", {
  fontSize: "var(--size, 1.5em)",
  color: "var(--color)",
  fontWeight: "var(--weight, 500)",
});

const PanelTitle = styled("h1", {
  margin: "1em 0 0 1em",
});

const Paragraph = styled("div", {
  padding: "0 1.5em 1.5em 1.5em",
});
