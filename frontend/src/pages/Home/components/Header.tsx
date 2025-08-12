import headerEnd from "@assets/images/headerEnd.svg?no-inline";
import headerStart from "@assets/images/headerStart.svg?no-inline";
import bird from "@assets/images/icons/bird.svg?no-inline";
import title from "@assets/images/icons/title.svg?no-inline";
import git from "@assets/images/icons/git.svg?no-inline";
import { styled } from "../../../stitches.config";

export default function Header() {
  return (
    <HeaderContainer>
      <Icons>
        <Bird src={bird} alt="Bird Icon" />
        <Title src={title} alt="Title Icon" />
        <Git
          src={git}
          onClick={() =>
            window.open(
              "https://github.com/Linkee12/PhotoBin/",
              "_blank",
              "noopener,noreferrer",
            )
          }
          alt="Git Icon"
        />
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
  cursor: "pointer",
});
const Icons = styled("div", {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  padding: "50px ",
  boxSizing: "border-box",
  position: "absolute",
});
