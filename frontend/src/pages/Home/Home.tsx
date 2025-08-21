/* eslint-disable promise/always-return */
/* eslint-disable react/no-unescaped-entities */
import { styled } from "../../stitches.config";
import bottomBg from "@assets/images/bottomBg.svg?no-inline";
import bottomBg2 from "@assets/images/bottomBg2.svg?no-inline";
import Header from "./components/Header";
import IntroImg from "@assets/images/intro";
import { useNavigate } from "react-router";
import { genKey } from "../../utils/key";
export default function Home() {
  const navigate = useNavigate();

  return (
    <Container>
      <Header />
      <Intro>
        <IntroImg />
      </Intro>
      <Panel>
        <TextContainer>
          <Text css={{ "--weight": "bold" }}>ABOUT</Text>
          <Paragraph>
            <Text>
              Photobin is a temporary photo album provider with E2E encryption. You can
              share photos and each participant can export them to their storage of
              choice.
            </Text>
            <Text>
              The server has no way viewing your photos without the key, and the browser
              doesn't send the key to the server because everything after "#" is ignored
              in an http request.
            </Text>
            <Text css={{ "--size": "1.6rem", "--weight": "bold" }}>
              Photobin is free and open-source!
            </Text>
          </Paragraph>
        </TextContainer>
        <ButtonContainer>
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
        </ButtonContainer>
      </Panel>
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
});
const Intro = styled("div", {
  minHeight: "150px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: "1rem",
});
const Panel = styled("div", {
  minHeight: "350px",
  paddingTop: "2rem",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  alignItems: "center",
  backgroundImage: `url(${bottomBg})`,
  backgroundSize: "100% 100%",
  justifyContent: "space-between",
});

const Button = styled("div", {
  width: "25rem",
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

const ButtonContainer = styled("div", {
  display: "flex",
  width: "100%",
  justifyContent: "center",
  flexDirection: "column",
  alignItems: "center",
  flex: 1,
  backgroundImage: `url(${bottomBg2})`,
  backgroundSize: "100% 100%",
  paddingBottom: "1rem",
});
export const Text = styled("h1", {
  fontSize: "var(--size, 1.5rem)",
  color: "var(--color)",
  fontWeight: "var(--weight, 500)",
});

export const TextContainer = styled("div", {
  width: "81%",
  display: "flex",
  flex: 2.5,
  flexDirection: "column",
});
const Paragraph = styled("div", {
  marginLeft: "1rem",
});
