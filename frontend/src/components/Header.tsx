import headerEnd from "../images/headerEnd.svg";
import headerStart from "../images/headerStart.svg";
import bird from "../images/icons/bird.svg";
import title from "../images/icons/title.svg";
import git from "../images/icons/git.svg";
import { styled } from "@stitches/react";

export default function Header() {
  return (
    <HeaderContainer>
      <Icons>
        <Bird src={bird} alt="Bird Icon" />
        <Title src={title} alt="Title Icon" />
        <Git src={git} alt="Git Icon" />
      </Icons>
      <HeaderStart />
      <HeaderEnd />
    </HeaderContainer>
  );
}
const HeaderContainer = styled("div", {
  display: "flex",
  height: "200px",
  position: "relative",
});

const HeaderStart = styled("div", {
  flex: "0 0 421px",
  background: `url(${headerStart}) no-repeat center center`,
  backgroundSize: "cover",
});
const HeaderEnd = styled("div", {
  flex: 1,
  background: `url(${headerEnd}) no-repeat center center`,
  backgroundSize: "100% 100%",
});
const Bird = styled("img", {
  height: "25px",
  objectFit: "cover",
});
const Title = styled("img", {
  height: "40px",
  objectFit: "cover",
});
const Git = styled("img", {
  height: "40px",
  objectFit: "cover",
});
const Icons = styled("div", {
  width: "clamp(400px, 100vw, 1500px)",
  display: "flex",
  justifyContent: "space-between",
  padding: "50px ",
  boxSizing: "border-box",
  position: "absolute",
});
