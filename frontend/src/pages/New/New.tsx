import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { toast } from "react-toastify";
import { styled } from "../../stitches.config";
import { pressableNoScale } from "../../pressable";
import { ACCENT_COLOR } from "../../theme";
import { client } from "../../cuple";
import { genKey } from "../../utils/key";

/**
 * Creates an album on the server and opens it. The key is generated here and
 * goes straight into the URL hash; `?plain` skips it for an unencrypted album.
 */
export default function New() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  // StrictMode runs the effect twice; one album per visit.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const plain = params.has("plain");
    createAlbum(plain)
      .then((url) => navigate(url, { replace: true }))
      .catch((error: unknown) => {
        console.error(error);
        toast.error("Could not create the album");
        setFailed(true);
      });
  }, []);

  return (
    <Page>
      {failed ? (
        <>
          <Text>The album could not be created.</Text>
          <Retry href={location.pathname + location.search}>Try again</Retry>
        </>
      ) : (
        <>
          <Spinner />
          <Text>Creating your album…</Text>
        </>
      )}
    </Page>
  );
}

async function createAlbum(plain: boolean) {
  const albumId = crypto.randomUUID();
  const key = plain ? null : await genKey();
  const response = await client.createAlbum.post({ body: { albumId } });
  if (response.result !== "success") throw new Error(response.message);
  return key === null ? `/bin/${albumId}` : `/bin/${albumId}#${key}`;
}

const Page = styled("div", {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  fontFamily: "Open Sans",
});

const Spinner = styled("div", {
  width: "3rem",
  height: "3rem",
  border: "5px solid rgba(255, 255, 255, 0.2)",
  borderTop: `5px solid ${ACCENT_COLOR}`,
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const Text = styled("p", {
  margin: 0,
  color: "#c0c0c0",
});

// A plain link: reloading the route is what restarts the creation.
const Retry = styled("a", {
  ...pressableNoScale,
  color: ACCENT_COLOR,
  fontWeight: "bold",
  textDecorationThickness: "2px",
  textUnderlineOffset: "0.2em",
  "&:hover": { color: "#fff" },
});
