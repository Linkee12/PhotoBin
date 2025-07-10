/* eslint-disable sonarjs/no-duplicate-string */
import { Route, Routes } from "react-router";
import { globalCss } from "@stitches/react";
import Album from "./pages/Album/Album";
import Home from "./pages/Home/Home";
import { AlbumContextProvider } from "./pages/Album/hooks/useAlbumContext";

function App() {
  globalStyles();

  return (
    <Routes>
      <Route path={"/"} element={<Home />}></Route>
      <Route
        path={"/bin/:albumId"}
        element={
          <AlbumContextProvider>
            <Album />
          </AlbumContextProvider>
        }
      ></Route>
    </Routes>
  );
}
export default App;

const globalStyles = globalCss({
  body: {
    backgroundColor: "#0E0E10",
    color: "#fff",
  },
  "@keyframes spin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
});
