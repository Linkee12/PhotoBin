import { useEffect, useState } from "react";
import { styled } from "../../../stitches.config";
import BirdArrowUrl from "@assets/images/birdarrow.svg?no-inline";
import { keyframes } from "@stitches/react";

export default function Intro() {
  console.log(BirdArrowUrl);

  return (
    <Container>
      <Section>
        <UrlPart className="appear a1">/bin/</UrlPart>
      </Section>
      <Section>
        <Explanation top className="appear a7">
          Album Id<HideOnSm>entifier</HideOnSm>
        </Explanation>
        <Arrow reversed className="appear a6" />
        <UrlPart className="appear a2">
          <Code offset={0} />
        </UrlPart>
        <ArrowSpace />
      </Section>
      <Section>
        <UrlPart className="appear a3">#</UrlPart>
      </Section>
      <Section>
        <Explanation bottom className="appear a9">
          <HideOnSm>Encryption / Decryption</HideOnSm> Key
        </Explanation>
        <ArrowSpace />
        <UrlPart className="appear a4">
          <Code offset={50} />
        </UrlPart>
        <Arrow className="appear a10" />
      </Section>
    </Container>
  );
}

const UrlPart = styled("div", {
  lineHeight: "1.5em",
});

const deblurKeyframes = keyframes({
  "0%": { filter: "blur(8px)", opacity: 0 },
  "100%": { filter: "blur(0px)", opacity: 1 },
});

const Container = styled("div", {
  cursor: "default",
  position: "relative",
  padding: "1em",
  fontSize: "1.5em",
  fontWeight: "900",
  fontFamily: "Offside",
  display: "flex",
  container: "intro",
  alignItems: "center",
  maxWidth: "100%",
  gap: "1em",
  color: "#999999",
  whiteSpace: "nowrap",
  ".appear": { opacity: 0, animation: `${deblurKeyframes} 1.2s ease-out forwards` },
  ".appear.a1": { animationDelay: "calc(0s / 4)" },
  ".appear.a2": { animationDelay: "calc(1s / 4)" },
  ".appear.a3": { animationDelay: "calc(2s / 4)" },
  ".appear.a4": { animationDelay: "calc(3s / 4)" },
  ".appear.a5": { animationDelay: "calc(4s / 4)" },
  ".appear.a6": { animationDelay: "calc(5s / 4)" },
  ".appear.a7": { animationDelay: "calc(6s / 4)" },
  ".appear.a8": { animationDelay: "calc(7s / 4)" },
  ".appear.a9": { animationDelay: "calc(8s / 4)" },
  ".appear.a10": { animationDelay: "calc(9s / 4)" },

  ":before": {
    mask: "linear-gradient(transparent 20%, rgba(255, 255, 255, .7) 95%)",
    transform: "rotatex(180deg) translatey(15px) skew(135deg) translatex(-10px)",
  },
});
const Section = styled("div", {
  flex: 1,
  display: "flex",
  position: "relative",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.25em",

  img: {
    height: "1em",
    width: "100%",
  },
});
const Explanation = styled("div", {
  position: "absolute",
  fontWeight: "300",
  fontSize: "0.6em",
  display: "flex",
  alignItems: "center",
  whiteSpace: "break-spaces",
  textAlign: "center",
  variants: {
    bottom: {
      true: {
        top: "calc(1.5em / 0.6 + 4 * 0.25em / 0.6 + min(clamp(3.34em, 20vw, 10em), 10vh))",
      },
    },
    top: {
      true: {
        bottom:
          "calc(1.5em / 0.6 + 4 * 0.25em / 0.6 + min(clamp(3.34em, 20vw, 10em), 10vh))",
      },
    },
  },
});

const ArrowSpace = styled("div", {
  height: "min(clamp(1em, 10vw, 3em), 5vh)",
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
const NUM_SLIDES = CODE.length - 50;
function Code(props: { offset: number }) {
  const [slide, setSlide] = useState(props.offset);
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((slide) => (slide + 1) % NUM_SLIDES);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return <CodeContainer>{CODE.slice(slide)}</CodeContainer>;
}

const CodeContainer = styled("div", {
  color: "#ffa021",
  width: "min(calc(35vw - 2em), 9em)",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const HideOnSm = styled("span", {
  display: "none",
  "@media (min-width: 645px)": {
    display: "contents",
  },
});
