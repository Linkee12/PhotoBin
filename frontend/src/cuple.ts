import { createClient } from "@cuple/client";
import { createCupleStore, type CupleConfig } from "@cuple/react";
import { toast } from "react-toastify";

import type { Routes } from "../../backend/src/index";

export const RPC_PATH = "/api/rpc";

export const client = createClient<Routes>({
  path: RPC_PATH,
});

/** The cache of every `useGet` read; refresh it from plain code with `store.refresh`. */
export const store = createCupleStore();

export const cupleConfig: CupleConfig = {
  errors: {
    notify: (error) => toast.error(error.message),
    // A dropped connection is a toast and the page stays; anything else
    // nobody handled goes to the nearest <Boundary>.
    onError: (error) => (error.kind === "transport" ? "notify" : "boundary"),
    fallbackMessage: "Something went wrong. Check your connection and try again.",
  },
};
