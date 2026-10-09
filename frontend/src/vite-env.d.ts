/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

type ImportMetaEnv = {
  API_URL?: string;
  /** OAuth client id for the Google Photos import/save; the feature is hidden without it. */
  VITE_GOOGLE_CLIENT_ID?: string;
};

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
