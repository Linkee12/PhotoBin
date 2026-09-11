# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

PhotoBin is a temporary, E2E-encrypted photo album sharing app. Users create an album, share the link, and all participants can upload/download photos. The encryption key lives only in the URL hash fragment — the server never sees plaintext data. Albums auto-expire after 30 days (configurable via `ALBUM_TTL_MS`); `AlbumService.cleanStorage` is invoked on backend startup and every `CLEANUP_INTERVAL_MS` (default 1 hour) by a `setInterval` registered in `backend/src/index.ts`. The same pass also deletes unfinalized file directories (not referenced in `metadata.json`) that have not been written to for `ORPHAN_TTL_MS` (default 24 hours).

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
3. Before upload, `CryptoService` encrypts each file (and its filename/date) using `window.crypto.subtle`.
4. Encrypted bytes are base64-encoded and sent to the backend as JSON.
5. On download, `ImageQueryService` reassembles chunks, then `CryptoService` decrypts client-side.

Uploads are resumable: `UploadService` asks `getUploadedParts` which chunks the server already has and sends only the missing ones. Across reloads, `PendingUploadStore` keeps a small localStorage record per album (fingerprint, fileId, IVs, chunk counts, encrypted name/date, never file bytes) so re-picking the same file re-encrypts with the stored IV (AES-GCM is deterministic for the same key + IV + plaintext). Only `original` / `originalVideo` / `unsupportedFile` are resumed; canvas-derived `thumbnail` / `reduced` are always re-uploaded with fresh IVs.

### File storage on the backend
Files live under `backend/albums/` (gitignored in prod, mounted as a PVC in k8s):
```
albums/<albumId>/metadata.json          ← album name + file list (all values encrypted)
albums/<albumId>/<fileId>/thumbnail/0   ← single encrypted chunk
albums/<albumId>/<fileId>/reduced/0..N  ← 1 MB chunks
albums/<albumId>/<fileId>/original/0..N
albums/<albumId>/<fileId>/originalVideo/0..N   ← video only
albums/<albumId>/<fileId>/unsupportedFile/0..N ← non-image/video files
```

### Frontend page structure
- `/` → `pages/Home` — landing page, album creation
- `/bin/:albumId` → `pages/Album` — upload, view, download
  - `AlbumContextProvider` (`hooks/useAlbumContext.tsx`) fetches metadata and decrypts the album name; exposes `{ key, metadata, decodedValues, refreshMetadata }` via context.
  - Service classes (`UploadService`, `ImageQueryService`, `DownloadService`, `CanvasService`, `CryptoService`) handle all media logic; they are plain classes instantiated in components/hooks, not singletons.

### Styling
CSS-in-JS via `@stitches/react`. The config (`stitches.config.ts`) defines two breakpoints: `portrait` and `landscape` (orientation-based, not width-based). Use the exported `styled` from there rather than importing from `@stitches/react` directly.

