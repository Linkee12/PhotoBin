/* eslint-disable sonarjs/no-duplicate-string */
import { Route, Routes } from "react-router";
import { globalCss } from "@stitches/react";
import Album from "./pages/Album/Album";
import Home from "./pages/Home/Home";
import New from "./pages/New/New";
import NotFound from "./pages/NotFound/NotFound";
import { AlbumContextProvider } from "./pages/Album/hooks/useAlbumContext";

function App() {
  globalStyles();

  return (
    <Routes>
      <Route path={"/"} element={<Home />}></Route>
      <Route path={"/new"} element={<New />}></Route>
      <Route
        path={"/bin/:albumId"}
        element={
          <AlbumContextProvider>
            <Album />
          </AlbumContextProvider>
        }
      ></Route>
      <Route path={"/not-found"} element={<NotFound />}></Route>
      <Route path={"*"} element={<NotFound />}></Route>
    </Routes>
  );
}
export default App;

const globalStyles = globalCss({
  body: {
    margin: 0,
    width: "100%",
    height: "100%",
    minHeight: "100dvh",
    backgroundColor: "#0E0E10",
    color: "#fff",
    fontSize: "clamp(16px, 2.5vw, 20px)",
  },

  "@keyframes spin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
});
