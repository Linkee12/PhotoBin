import "dotenv/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import viteCompression from "vite-plugin-compression";
import svgr from "vite-plugin-svgr";

export default defineConfig(() => {
  return {
    resolve: {
      alias: [
        {
          find: "@",
          replacement: path.resolve(__dirname, "src"),
        },
      ],
    },
    plugins: [
      react({
        babel: { babelrc: true },
      }),
      viteCompression(),
      svgr({}),
      tsconfigPaths(),
    ],
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: ["photobin.dev", "localhost", "127.0.0.1"],
      proxy: {
        "/api": {
          target: process.env.API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
