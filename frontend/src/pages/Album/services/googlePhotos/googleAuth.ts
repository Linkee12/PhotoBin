/**
 * Google sign-in for the Google Photos import/save, entirely in the browser:
 * Google Identity Services' token model gives a short-lived access token for
 * one scope, kept in memory only. Needs `VITE_GOOGLE_CLIENT_ID` (a public
 * OAuth client id; no secret, no API key); without it the feature is hidden.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
/** A cached token is reused only while it has at least this much life left. */
const TOKEN_MARGIN_MS = 60_000;

export const PICKER_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
export const APPEND_ONLY_SCOPE =
  "https://www.googleapis.com/auth/photoslibrary.appendonly";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const isGooglePhotosEnabled = CLIENT_ID !== "";

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
};

type TokenClient = { requestAccessToken(): void };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

const tokens = new Map<string, { accessToken: string; expiresAt: number }>();
let gisLoad: Promise<void> | undefined;

/** Loads the Google Identity Services script once. Call it early: the sign-in popup must open from a click. */
export function loadGoogleIdentity(): Promise<void> {
  gisLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoad = undefined;
      script.remove();
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return gisLoad;
}

/**
 * An access token for `scope`: the cached one, or a new one from Google's
 * consent popup. Call it synchronously from a click handler (before any
 * `await`), or the browser blocks the popup.
 */
export function requestAccessToken(scope: string): Promise<string> {
  const cached = tokens.get(scope);
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) {
    return Promise.resolve(cached.accessToken);
  }
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    loadGoogleIdentity().catch(() => undefined);
    return Promise.reject(new Error("Google sign-in is still loading, please try again"));
  }
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope,
      callback: (response) => {
        if (response.error !== undefined || response.access_token === undefined) {
          reject(
            new Error(response.error_description ?? response.error ?? "Sign-in failed"),
          );
          return;
        }
        tokens.set(scope, {
          accessToken: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in ?? 0) * 1000,
        });
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Google sign-in was closed"
              : (error.message ?? "Google sign-in failed"),
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}

/** Drops a token Google rejected, so the next request signs in again. */
export function forgetAccessToken(scope: string) {
  tokens.delete(scope);
}
