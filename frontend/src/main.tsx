import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { registerSW } from "virtual:pwa-register";

import { Boundary, CupleProvider } from "@cuple/react";
import App from "./App";
import { ErrorScreen } from "./components/ErrorScreen";
import { NoticeCloseButton, noticeGlobalStyles } from "./components/notifications";
import { cupleConfig, store } from "./cuple";
import { ToastContainer } from "react-toastify";
import { requestPersistentStorage } from "./services/visitedAlbums";

registerSW();
noticeGlobalStyles();
requestPersistentStorage();

const node = document.getElementById("root");
if (!node) throw new Error("root is not found");
const root = createRoot(node);

root.render(
  <BrowserRouter>
    <ToastContainer
      theme="dark"
      position="bottom-center"
      hideProgressBar
      closeButton={NoticeCloseButton}
    />
    <CupleProvider store={store} config={cupleConfig}>
      {/* Last resort: anything a page did not catch itself. */}
      <Boundary error={(error, retry) => <ErrorScreen error={error} onRetry={retry} />}>
        <App />
      </Boundary>
    </CupleProvider>
  </BrowserRouter>,
);
