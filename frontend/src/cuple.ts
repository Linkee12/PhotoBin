import { createClient } from "@cuple/client";

import type { Routes } from "../../backend/src/index";

export const RPC_PATH = "/api/rpc";

export const client = createClient<Routes>({
  path: RPC_PATH,
});
