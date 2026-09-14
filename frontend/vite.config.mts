import "dotenv/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import viteCompression from "vite-plugin-compression";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

const THEME_COLOR = "#0E0E10";

export default defineConfig(() => {
  return {
    optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
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
      // Installable app. The service worker precaches the built assets only:
      // `/api/` is never cached, so encrypted parts never land in the cache
      // (no runtime caching is configured and the navigate fallback skips it).
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "PhotoBin",
          short_name: "PhotoBin",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: THEME_COLOR,
          theme_color: THEME_COLOR,
          // Open album links inside the installed app, in its existing window,
          // with the hash (the key) intact.
          handle_links: "preferred",
          launch_handler: { client_mode: "navigate-existing" },
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "pwa-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        },
      }),
    ],
    server: {
      host: "0.0.0.0",
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
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
