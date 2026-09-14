/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

type ImportMetaEnv = {
  API_URL?: string;
};

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
