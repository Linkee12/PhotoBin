/* eslint-disable sonarjs/no-duplicate-string */
import { Route, Routes } from "react-router";
import { globalCss } from "@stitches/react";
import NewAlbum from "./pages/NewAlbum";
import Home from "./pages/Home";

function App() {
  globalStyles();

  return (
    <Routes>
      <Route path={"/"} element={<Home />}></Route>
      <Route path={"/new"} element={<NewAlbum />}></Route>
    </Routes>
  );
}
export default App;

const globalStyles = globalCss({
  body: {
    backgroundColor: "#0E0E10",
    color: "#fff",
  },
});
