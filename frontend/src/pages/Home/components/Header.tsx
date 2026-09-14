import BirdUrl from "@assets/images/icons/bird.svg?no-inline";
import GitUrl from "@assets/images/icons/git.svg?no-inline";
import { styled } from "../../../stitches.config";
import { pressable } from "../../../pressable";

export default function Header() {
  return (
    <HeaderContainer>
      <Icon>
        <BirdImg src={BirdUrl} alt="Bird Icon" />
      </Icon>
      <Title>
        Photo<b>Bin</b>
      </Title>
      <Icon right>
        <GitLink
          href="https://github.com/Linkee12/PhotoBin/"
          target="_blank"
          rel="noreferrer"
        >
          <img src={GitUrl} alt="Git Icon" />
        </GitLink>
      </Icon>
    </HeaderContainer>
  );
}

const HeaderContainer = styled("div", {
  display: "flex",
  marginBottom: "1em",
  justifyContent: "space-between",
  boxSizing: "border-box",
  padding: "50px min(10vw, 50px) min(10vw, 50px) min(10vw, 50px)",
  height: "162px",
  background:
    "radial-gradient(ellipse 70vw 70vw at 28vw 100%, #ffa021 14%, #9d6e2f 14%, #333 100%)",
  clipPath:
    "polygon( 0% 0%, 0% 95.1%, 4.9% 95.1%, 9.7% 66.7%, 12.4% 78.4%, 18.4% 66.7%, 27.8% 100%, 42.3% 88.3%, 75.1% 78.4%, 100% 90.1%, 100% 0% )",
});
const Title = styled("div", {
  fontSize: "1.6rem",
});
const BirdImg = styled("img", {
  height: "15px",
  objectFit: "cover",
});
const GitLink = styled("a", {
  ...pressable,
  display: "inline-block",
  borderRadius: "8px",
  opacity: 0.85,
  "&:hover": { opacity: 1, transform: "scale(1.06)" },
  img: {
    display: "block",
    height: "40px",
    objectFit: "cover",
  },
});
const Icon = styled("div", {
  width: "50px",
  variants: {
    right: {
      true: {
        textAlign: "right",
      },
    },
  },
});
