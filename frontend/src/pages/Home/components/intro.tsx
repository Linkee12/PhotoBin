import { useEffect, useMemo, useState } from "react";
import { styled } from "../../../stitches.config";
import BirdArrowUrl from "@assets/images/birdarrow.svg?no-inline";

export default function Intro() {
  console.log(BirdArrowUrl);

  return (
    <Container>
      <Section>/bin/</Section>
      <Section>
        <Explanation>Album Identifier</Explanation>
        <Arrow reversed />
        <Code offset={0} />
        <ArrowSpace />
        <Explanation />
      </Section>
      <Section>#</Section>
      <Section>
        <Explanation></Explanation>
        <ArrowSpace />
        <Code offset={50} />
        <Arrow />
        <Explanation>Encryption / Decryption Key</Explanation>
      </Section>
    </Container>
  );
}

const Container = styled("div", {
  padding: "1em",
  font: '1.5em "Droid Sans Mono", sans-serif, monospace',
  display: "flex",
  alignItems: "center",
  gap: "1em",
  color: "#999999",
  whiteSpace: "nowrap",
});
const Section = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.25em",

  img: {
    height: "1em",
    width: "100%",
  },
});
const Explanation = styled("div", {
  font: '0.6em "Open Sans", sans-serif',
  height: "1em",
  display: "flex",
  alignItems: "center",
});

const ArrowSpace = styled("div", {
  height: "1em",
  width: "100%",
});
const Arrow = styled(ArrowSpace, {
  background: `url("${BirdArrowUrl}")`,
  backgroundSize: "100% 100%",
  variants: {
    reversed: {
      true: {
        transform: "scaleY(-1)",
      },
    },
  },
});

const CODE = `cxGkD24MysvbX4YxxOjdncwdudyuYqu7q+h/P8FpVdb58mSRZFNvEIpR4aaUO7T1BWJmfQlVVWCh7vra88xNvo22gZfwmpB4YewPh/TOtFtnSMh4FYmfUFNN7JxnlEayO7Diu+2OeQH7LwrW2ZeaYRcsnFWHcL+O0P9mBCKznQBAXwD+VmrsYsNC+bje0hJFzaJ4Lx6IZ3ywzn/0d6j6eVEA1WJYIqd1QrcZafKYUp5ORn0DeiGzP21OovmbhVkCpIZ/JZ43MYkEQFyHDYy9YNQdLLE93SGsCrZjzi2WKUc4gScUUmaDn9flHWDzsSn+eyjDyTG8mxOa7g==`;
const CODE_WINDOW_LEN = 10;
const NUM_SLIDES = CODE.length - CODE_WINDOW_LEN;
function Code(props: { offset: number }) {
  const [slide, setSlide] = useState(props.offset);
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((slide) => (slide + 1) % NUM_SLIDES);
    }, 500);
    return () => {
      clearInterval(interval);
    };
  }, []);
  const shortened = useMemo(() => {
    const codePart = CODE.slice(slide);
    return `${codePart.slice(0, 5)}...${codePart.slice(5, 10)}`;
  }, [slide]);
  return <CodeContainer>{shortened}</CodeContainer>;
}

const CodeContainer = styled("div", {
  color: "#ffa021",
});
