import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App";
import { ToastContainer } from "react-toastify";

const node = document.getElementById("root");
if (!node) throw new Error("root is not found");
const root = createRoot(node);

root.render(
  <BrowserRouter>
    <ToastContainer theme="dark" />
    <App />
  </BrowserRouter>,
);
