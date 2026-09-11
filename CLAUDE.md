# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

PhotoBin is a temporary, E2E-encrypted photo album sharing app. Users create an album, share the link, and all participants can upload/download photos. The encryption key lives only in the URL hash fragment — the server never sees plaintext data. Albums auto-expire after 30 days (configurable via `ALBUM_TTL_MS`); `AlbumService.cleanStorage` is invoked on backend startup and every `CLEANUP_INTERVAL_MS` (default 1 hour) by a `setInterval` registered in `backend/src/index.ts`.

## Development

```bash
# First-time setup
make install   # copies frontend .env.sample → .env, runs npm i in containers

# Daily workflow
make start     # docker-compose up -d (frontend :3000, backend :3001, caddy :8080/:8443)
make stop      # docker-compose down
```

Run frontend or backend independently (outside Docker):
```bash
cd frontend && npm run dev
cd backend  && npm run dev
```

Lint and type-check:
```bash
# In frontend/ or backend/
npm run lint
npm run lint:fix
npm run type-check   # frontend only
npm run build        # tsc + vite build (frontend) / tsc (backend)
```

There are no automated tests in this codebase.

## Architecture

### Monorepo layout
- `frontend/` — React 19 + Vite + TypeScript SPA
- `backend/` — Express + TypeScript RPC server
- `infra/` — production Docker Compose and Kubernetes (GKE) manifests
- `Caddyfile` — local TLS reverse proxy for dev

### Type-safe RPC with @cuple
The frontend and backend share types via `@cuple/client` and `@cuple/server`. All routes are defined in `backend/src/index.ts` as a `routes` object and exported as `Routes`. The frontend imports this type directly:

```ts
// frontend/src/cuple.ts
import type { Routes } from "../../backend/src/index";
export const client = createClient<Routes>({ path: "/api/rpc" });
```

This means the frontend also directly imports the `Metadata` type from `backend/src/services/MetadataService.ts`. Changes to either must keep both sides in sync.

### E2E encryption flow
1. On album creation the frontend generates a 256-bit AES-GCM key (`utils/key.ts: genKey`).
2. The key is stored only in the URL hash (`/bin/:albumId#<base64key>`), never transmitted to the server.
3. Before upload, `CryptoService` encrypts each file (and its filename/date) using `window.crypto.subtle`. In plain mode (`key === null`, album URL without a hash) every `CryptoService` method is a passthrough.
4. Encrypted bytes are split into 2 MB chunks and sent as raw `application/octet-stream` bodies (`PartTransport.ts`), up to 4 chunks in flight per file. Only the small metadata (encrypted name/date, ivs, chunk counts) goes through the cuple JSON RPC.
5. On download, `ImageQueryService` fetches chunks as raw bytes (in parallel), reassembles them, then `CryptoService` decrypts client-side.

### Binary part transport
Chunks do not go through cuple. `backend/src/index.ts` registers two plain express routes, validated with the shared zod schemas:
- `PUT /parts/:albumId/:fileId/:type/:part` — `express.raw` body (limit `MAX_PART_BYTES`, 8 MB), stored as raw bytes.
- `GET /parts/:albumId/:fileId/:type/:part` — serves the part as raw bytes, whatever its on-disk format.

The frontend reaches them at `/api/parts/...` (same `/api` → backend prefix as the RPC). The old cuple routes `uploadFilePart` / `getPartOfImage` (base64 inside JSON) still work and read/write both on-disk formats; they exist only for backward compatibility.

Performance notes (measured with `?profile`, which logs per-stage timings to the console): AES-GCM is a small share of upload time. The big costs were full-resolution WebP encoding of the "reduced" rendition (now capped at 2560 px, JPEG for JPEG sources, skipped for small originals), base64 + JSON transport, and — in Chromium — `fetch` with an `ArrayBuffer` body, which uploads at ~10 MB/s while a `Blob` body is near-instant. Always send chunks as `Blob`s.

### File storage on the backend
Files live under `backend/albums/` (gitignored in prod, mounted as a PVC in k8s):
```
albums/<albumId>/metadata.json              ← album name + file list (values encrypted unless plain mode)
albums/<albumId>/<fileId>/thumbnail/0.bin   ← single chunk
albums/<albumId>/<fileId>/reduced/0.bin..N.bin   ← 2 MB chunks; absent for small originals
albums/<albumId>/<fileId>/original/0.bin..N.bin
albums/<albumId>/<fileId>/originalVideo/0.bin..N.bin   ← video only (its `original` is the poster frame)
albums/<albumId>/<fileId>/unsupportedFile/0.bin..N.bin ← non-image/video files
```
Parts written through the binary route are raw bytes named `<part>.bin`. Albums uploaded before that route existed have base64 text files named `<part>` (no suffix); `AlbumService` checks for `<part>.bin` first and falls back to decoding `<part>`, so both layouts stay readable. Do not write both names for the same part.

### Frontend page structure
- `/` → `pages/Home` — landing page, album creation
- `/bin/:albumId` → `pages/Album` — upload, view, download
  - `AlbumContextProvider` (`hooks/useAlbumContext.tsx`) fetches metadata and decrypts the album name; exposes `{ key, metadata, decodedValues, refreshMetadata }` via context.
  - Service classes (`UploadService`, `ImageQueryService`, `DownloadService`, `CanvasService`, `CryptoService`) handle all media logic; they are plain classes instantiated in components/hooks, not singletons.

### Styling
CSS-in-JS via `@stitches/react`. The config (`stitches.config.ts`) defines two breakpoints: `portrait` and `landscape` (orientation-based, not width-based). Use the exported `styled` from there rather than importing from `@stitches/react` directly.

