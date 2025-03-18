/* eslint-disable react/no-unescaped-entities */
import { styled } from "@stitches/react";
import bottomBg from "./images/bottomBg.svg";
import button from "./images/button.svg";
import Header from "./components/Header";
import IntroImg from "./images/intro";
import { useEffect, useState } from "react";

export default function App() {
  const [intro, setIntro] = useState<{ first: string; second: string }>({
    first: "f7ze4s7ztghji76rdfdft43w",
    second: "f7ze4s7ztghji7",
  });
  const introTextBank = [
    {
      first: "a8kd9z3nvpq7c6rft5x2jv",
      second: "r3wz1gt8v6pnf7",
    },
    {
      first: "b4qm1p7twzv6e8yr2kd9nh",
      second: "k9xq4v5jd1m3tw",
    },
    {
      first: "c9xw3d1qjpl6v7t8f2m5yk",
      second: "p6zv8q7lh3ft5d",
    },
    {
      first: "f7ze4s7ztghji76rdfdft43w",
      second: "f7ze4s7ztghji7",
    },
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      // eslint-disable-next-line sonarjs/pseudo-random
      const random = Math.floor(Math.random() * 4);
      setIntro(introTextBank[random]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Body>
      <Container>
        <Header />
        <Intro>
          <IntroImg firstText={intro.first} secondText={intro.second} />
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

            <Button>
              <Text css={{ "--weight": "bold" }}>NEW ALBUM</Text>
            </Button>
          </ButtonContainer>
        </Panel>
      </Container>
    </Body>
  );
}

const Body = styled("div", {
  background: "radial-gradient(rgba(134, 147, 192, 0.25), rgba(32, 32, 32, 0.25))",
  opacity: 25,
  width: "100vw",
  height: "auto",
  display: "flex",
  flex: 1,
  justifyContent: "center",
  fontFamily: "sans-serif",
});
const Container = styled("div", {
  maxWidth: "1500px",
  width: "100%",
  height: "auto",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
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
  padding: "1rem",
  paddingTop: "2rem",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  alignItems: "center",
  background: `url(${bottomBg})`,
  backgroundSize: "100% 100%",
  justifyContent: "space-between",
});

const Button = styled("div", {
  height: "40%",
  width: "100%",
  fontWeight: "bold",
  display: "flex",
  justifyContent: "center",
  background: `url(${button}) 100%`,
});
const ButtonContainer = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "bottom",
  flex: 1,
});
const Text = styled("h1", {
  fontSize: "var(--size, 1.5rem)",
  color: "var(--color)",
  fontWeight: "var(--weight, 500)",
});
const TextContainer = styled("div", {
  width: "81%",
  display: "flex",
  flex: 2.5,
  flexDirection: "column",
});
const Paragraph = styled("div", {
  marginLeft: "1rem",
});
