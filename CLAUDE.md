# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

PhotoBin is a temporary, E2E-encrypted photo album sharing app. Users create an album, share the link, and all participants can upload/download photos. The encryption key lives only in the URL hash fragment — the server never sees plaintext data. Albums auto-expire after 30 days (configurable via `ALBUM_TTL_MS`); `AlbumService.cleanStorage` is invoked on backend startup and every `CLEANUP_INTERVAL_MS` (default 1 hour) by a `setInterval` registered in `backend/src/index.ts`. The same pass also deletes unfinalized file directories (not referenced in `metadata.json`) that have not been written to for `ORPHAN_TTL_MS` (default 24 hours).

## Development

```bash
# First-time setup
make install   # copies frontend .env.sample → .env, runs npm i in containers

# Daily workflow
make start     # docker-compose up -d (frontend :3000, backend :3001)
make stop      # docker-compose down

# Production (built images, project name photobin-prod so it can run next to the dev stack)
make prod-install  # cp compose.prod.override.yml.sample → compose.prod.override.yml (gitignored), build both images
make prod-start    # docker-compose -f compose.prod.yml -f compose.prod.override.yml up -d (frontend :8080)
make prod-stop
make prod-update   # rebuild (--pull), keeps the override; then make prod-start
```

Production images: `backend/Dockerfile` (tsc build, `node dist/index.js`) and `frontend/Dockerfile` (context = repo root because the frontend type-checks against `backend/src`; static build served by Caddy with `frontend/Caddyfile.prod`, which proxies `/api/*` → `backend:3001` with the prefix stripped, like the Vite dev proxy). Albums are bind-mounted from `./data/albums`. Ports and the backend env vars live only in the override file.

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

Automated tests are vitest specs, run with `npm test` in either package: backend `backend/src/**/*.test.ts` (services and the zod schemas), frontend `frontend/src/**/*.test.ts` (pure logic only, e.g. `pages/Album/utils/groupFiles.ts`, `services/renditions.ts`, the set helpers of `hooks/useSelection.ts`, `services/visitedAlbums.ts` and `PendingUploadStore` with a stubbed `localStorage`; no component tests).

Backend env vars (all optional, read via `dotenv`): `ALBUM_TTL_MS` (album lifetime, 30 days), `CLEANUP_INTERVAL_MS` (1 hour), `ORPHAN_TTL_MS` (unfinalized upload dirs, 24 hours), `EDIT_LOCK_TTL_MS` (stale edit lock, 10 minutes). `backend/src/index.ts` passes them to `new AlbumService(metadataService, albumTtlMs, { editLockTtlMs, orphanTtlMs })`; tests additionally pass `albumsRoot`.

## Architecture

### Monorepo layout
- `frontend/` — React 19 + Vite + TypeScript SPA
- `backend/` — Express + TypeScript RPC server
- `compose.prod.yml` + `compose.prod.override.yml.sample`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/Caddyfile.prod` — production stack (see Development)
- `Caddyfile` — a local TLS proxy config for dev; not started by `docker-compose.yml`

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
5. On download, `ImageQueryService.getImg` fetches chunks as raw bytes (in parallel), reassembles them, then `CryptoService` decrypts client-side into a `Blob`. It never creates object URLs: the caller that needs one creates and owns it (the grid's `useThumbnails`, the viewer's `useViewerMedia`), so blob-only callers (zip download, rotation) leak nothing. Which part a download or the viewer uses is decided once, in `services/renditions.ts` (`downloadPart`, `viewerPart`, `editedFileName`).

### Binary part transport
Chunks do not go through cuple. `backend/src/index.ts` registers two plain express routes, validated with the shared zod schemas:
- `PUT /parts/:albumId/:fileId/:type/:part` — `express.raw` body (limit `MAX_PART_BYTES`, 8 MB), stored as raw bytes. An optional `?editId=<uuid>` routes the write into the file's edit staging dir (see "Non-destructive edits").
- `GET /parts/:albumId/:fileId/:type/:part` — serves the part as raw bytes, whatever its on-disk format.

`CHUNK_SIZE` (2 MB) and `UPLOAD_CONCURRENCY` (4) in `PartTransport.ts` are the single source of truth for chunking: `UploadService`, `RotateService` (edits) and the resume records all count chunks with it. `PartType` is defined once, in `backend/src/utils/zod.ts`, and re-exported by `PartTransport`/`ImageQueryService`.

The frontend reaches them at `/api/parts/...` (same `/api` → backend prefix as the RPC). The old cuple routes `uploadFilePart` / `getPartOfImage` (base64 inside JSON) still work and read/write both on-disk formats; they exist only for backward compatibility.

Performance notes (measured with `?profile`, which logs per-stage timings to the console): AES-GCM is a small share of upload time. The big costs were full-resolution WebP encoding of the "reduced" rendition (now capped at 2560 px, JPEG for JPEG sources, skipped for small originals), base64 + JSON transport, and — in Chromium — `fetch` with an `ArrayBuffer` body, which uploads at ~10 MB/s while a `Blob` body is near-instant. Always send chunks as `Blob`s.

Uploads are resumable: `UploadService` asks `getUploadedParts` which chunks the server already has (it recognises both `<n>.bin` and legacy `<n>` files and returns the numeric part name) and sends only the missing ones, each chunk with its own `withRetry` (`utils/retry.ts`) and the batch's `AbortSignal`. Across reloads, `PendingUploadStore` keeps a small localStorage record per album (fingerprint, fileId, IVs, chunk counts, encrypted name/date, never file bytes) so re-picking the same file re-encrypts with the stored IV (AES-GCM is deterministic for the same key + IV + plaintext; in plain mode the IV is empty and the bytes are the file itself). Only `original` / `originalVideo` / `unsupportedFile` are resumed; canvas-derived `thumbnail` / `reduced` are always re-uploaded with fresh IVs, and `reduced` may be absent altogether for small originals.

### Upload batches (groups)
Every `upload(files)` call of `hooks/useUploadRun.ts` (the drop zone, the file picker and "retry" in `AlbumContent.tsx`) is one batch: `UploadService.createBatch` gives it a uuid, a client-generated fantasy name (`pages/Album/utils/batchName.ts`, adjective + animal, encrypted once with the album key like `albumName`) and `createdAt`. Metadata carries `batches: Record<batchId, { name: EncryptedEntry, createdAt }>` and each file a `batchId`. The batch travels in the `finalizeFile` body (`batch: { batchId, name, createdAt }`) and `MetadataService.addFile` upserts it in the same write, so a batch exists exactly when at least one of its files finalized; an existing batch is never overwritten (a retried finalize cannot undo a rename). `renameBatch` (albumId, batchId, name) renames it — anyone with the link may. Resume records (`PendingUploadStore`) store the batch, so a resumed or retried file lands in the batch it was first picked with. Files without `batchId` (older albums) form the implicit, non-renameable "Earlier uploads" group; albums without `batches` keep working. A file whose `batchId` has no `batches` entry (or whose batch name cannot be decoded) still groups by its id under a placeholder title (`Upload <id prefix>`, not renameable) — never into "Earlier uploads". Resume records without a `batch` (written by older builds) or with a malformed one are upgraded on read: the file joins the batch it is picked with now. `finalizeFile` echoes `batchId`; the client warns in the console when it comes back missing, which is what happens against a backend without batch support (its `z.object` bodies silently strip the unknown `batch`/`batchId` keys — the symptom is every upload landing in "Earlier uploads").

The album grid has two views, persisted in `localStorage` (`photobin:albumView`, default `history`): **History** (one collapsible group per batch, newest first, header `<name> · <MM/DD HH:mm> · <n> photos`, click-to-edit name) and **Date** (grouped by decrypted photo date). `pages/Album/utils/groupFiles.ts: groupFiles` is the pure grouping function of `(files, decodedValues, thumbnails, view)`; it also pairs every unsupported file (no `thumbnail` part) with the first supported file of the same basename (case-insensitive, album-wide — a RAW next to its JPG) as a `sidecar`: no tile of its own, a `CR3`-style badge on the photo's tile, selection is per file — picking a tile or SELECT ALL takes only the photos, the RAWs have their own toggles (the tile badge, a `+RAW` next to SELECT ALL, a `CR3` pill in the viewer's bar) — while "Download all" and a delete from the viewer take the sidecars along (`hooks/useSelection.ts: withSidecars`); the viewer walks tiles, so it never lands on one. `hooks/useSelection.ts` owns the selection: one `Set` of file ids over the tiles and sidecars of the current groups, `toggleAllOrNothing` behind both sidecar toggles, stable per-tile callbacks (tiles are memoised). `hooks/useThumbnails.ts` keeps the `Map<fileId, { url, iv }>` of loaded thumbnails (lazy `ThumbnailLoader` + IntersectionObserver, one commit per frame, refetch on a changed iv); `Album.tsx` derives the groups from it with `useMemo`, so both views share `AlbumSection`. Collapse state lives in `AlbumContent` component state (not persisted); a group receiving freshly uploaded tiles is expanded so the pulse is visible.

### Pinch to resize the grid
Two fingers on the album grid (`AlbumSections` in `AlbumContent.tsx`, `touch-action: pan-y`, touch pointers only) step the column count one at a time: pinch in adds a column, pinch out removes one, and pinch out at a single column grows the tile under the fingers to full screen and opens `ViewOriginalModal` for it. `hooks/useGridPinch.ts` owns the gesture; `pages/Album/utils/pinchGrid.ts` (vitest) is the pure geometry: `gridLayout` (where each tile of a `repeat(n, 1fr)` grid of 3:2 tiles sits), `pinchStep` (finger-distance ratio → direction + progress; a step is complete at 1.5× out or ⅔ in), `clampColumns` (1 … as many 120 px tiles as fit). When the second finger lands the hook measures every `[data-images]` grid and `[data-tile]` tile once (gap and tile margin from computed style) and computes the target layout per direction on demand; each frame it writes a `translate/scale` transform per tile near the viewport (tiles have `transform-origin: 0 0`), animates each grid's `height` so later sections slide along, and scrolls the page so the anchored tile's centre stays put. Lifting past 50 % commits: `columns` state in `AlbumContent` (`null` = the CSS auto layout, whose count is read from the grid's resolved `grid-template-columns`) becomes explicit, `Images` gets `repeat(n, 1fr)` on every width via its `explicit` variant, and the scroll offset is applied in a `useLayoutEffect` after the relayout; otherwise the tiles animate back. `prefers-reduced-motion` skips both animations. Nothing is persisted.

### Non-destructive edits (rotation)
Rotation never touches `original/`. `RotateService.rotateTo` fetches the original, re-renders `edited` (full-res, only when rotation ≠ 0), `reduced` and `thumbnail` at the absolute rotation, and pushes them through the server-side edit lifecycle in `AlbumService`:
- `beginEdit` takes a per-file lock (`<fileId>/.edit-lock`, JSON `{ editId, startedAt }`, exclusive create; a lock older than `EDIT_LOCK_TTL_MS`, default 10 min, is taken over; a fresh one yields HTTP 409 `edit-in-progress`).
- Parts uploaded with that `editId` (binary route `?editId=` or the JSON route's `editId` field) land in `<fileId>/.edit-<editId>/<type>/`; only `edited`/`reduced`/`thumbnail` are editable.
- `commitEdit` swaps each staged `<type>` dir into place (via `<type>.old`), patches metadata (`rotation`, `edited`, `reduced`, `thumbnail`) and releases the lock; `abortEdit` drops staging + lock. `collectEditGarbage` (run by `cleanStorage`, and with `{ all: true }` at startup/shutdown) repairs stale locks, staging dirs and leftover `.old` dirs. Because whole type directories are swapped, the on-disk part naming (`.bin` or legacy) does not matter to the edit lifecycle.
`ViewOriginalModal` rotates optimistically with CSS (the zoom transform lives on a wrapper layer, the rotation on the `<img>`), coalesces quick clicks into one `rotateTo`, and resets zoom on every turn. `backend/src/services/AlbumService.edit.test.ts` (vitest, `npm test` in `backend/`) covers the lifecycle.

### File storage on the backend
Files live under `backend/albums/` (gitignored; in production a bind mount of `./data/albums`):
```
albums/<albumId>/metadata.json              ← album name, `batches` + file list (values encrypted unless plain mode)
albums/<albumId>/<fileId>/thumbnail/0.bin   ← single chunk
albums/<albumId>/<fileId>/reduced/0.bin..N.bin   ← 2 MB chunks; absent for small originals
albums/<albumId>/<fileId>/original/0.bin..N.bin
albums/<albumId>/<fileId>/originalVideo/0.bin..N.bin   ← video only (its `original` is the poster frame)
albums/<albumId>/<fileId>/unsupportedFile/0.bin..N.bin ← non-image/video files
albums/<albumId>/<fileId>/edited/0.bin..N.bin   ← full-res rotated re-encode; only when `rotation` ≠ 0
albums/<albumId>/<fileId>/.edit-lock, .edit-<editId>/   ← transient edit lock + staging (see below)
```
Parts written through the binary route are raw bytes named `<part>.bin`. Albums uploaded before that route existed have base64 text files named `<part>` (no suffix); `AlbumService` checks for `<part>.bin` first and falls back to decoding `<part>`, so both layouts stay readable. Do not write both names for the same part.

### Installable app (PWA)
`vite-plugin-pwa` (`frontend/vite.config.mts`, `registerType: "autoUpdate"`, registered by `registerSW()` in `main.tsx`) emits `manifest.webmanifest` and a Workbox `sw.js` that precaches the built assets only: there is no runtime caching and the navigation fallback denies `/^\/api\//`, so encrypted parts never enter the service worker cache — keep it that way. The manifest declares `handle_links: "preferred"` and `launch_handler: { client_mode: "navigate-existing" }` so an installed app opens `/bin/<id>#<key>` links itself with the hash intact. The PNG icons in `frontend/public/` (`pwa-192`, `pwa-512`, `pwa-maskable-512`) were rendered once from `public/favicon.svg` with `rsvg-convert`; regenerate them if the favicon changes.

### Visited albums
`services/visitedAlbums.ts` keeps the albums this browser has opened in one localStorage record (`photobin:visited`, keyed by albumId: the full URL including the key hash, the decoded title, `expiresAt`, `itemCount`, `visitedAt`). The helpers take an injected `Storage` and are vitest-covered; `listVisitedAlbums` drops expired entries and sorts newest visit first, malformed or blocked storage counts as empty. `AlbumContextProvider` calls `rememberVisitedAlbum` after every successful metadata load, `main.tsx` calls `requestPersistentStorage()` once. `pages/Home/components/VisitedAlbums.tsx` renders the list ("YOUR ALBUMS", hidden when empty, `repeat(auto-fill, minmax(16em, 1fr))` cards); a card is a full navigation (`window.location.assign`) to the stored URL because a hash-only route change would not re-run the album context, and the URL is never rendered. Its `×` confirms through `components/Dialog.tsx` (a native `<dialog>` shown with `showModal()`, closed by Escape and backdrop click, with `DialogActions`, `SecondaryButton` and `DangerButton`), shared with the delete-album dialog.

### Frontend page structure
- `/` → `pages/Home` — landing page, album creation (encrypted by default, with an "unencrypted album" toggle), the visited albums list
- `/bin/:albumId` → `pages/Album` — upload, view, download
  - `AlbumContextProvider` (`hooks/useAlbumContext.tsx`) fetches metadata and decrypts the album name, every file's name/date and every batch name; exposes `{ key, isEncrypted, metadata, expiresAt, decodedValues: { albumName, files, batches }, refreshMetadata }` via context (`key` is `null` for plain albums). Overlapping refreshes are sequenced so a slow older response cannot roll back a newer file list.
  - Service classes (`UploadService`, `ImageQueryService`, `DownloadService`, `RotateService`, `CanvasService`, `CryptoService`) handle all media logic; `services/index.ts` builds the one instance graph the album uses (`UploadService` holds in-session resume state, so everything that uploads must share it). Tests construct their own instances.
  - `ViewOriginalModal` composes `hooks/useViewerMedia.ts` (one `Media` state per shown file — image/video/unsupported — and the object URLs it owns, revoked exactly when they drop out of that state; the grid thumbnail is drawn while switching so opening never blinks; refetch is keyed on the part ivs, not the file object), `hooks/useOptimisticRotation.ts` (CSS turns at once, one coalesced `rotateTo` per 700 ms of clicks, revert on conflict/failure, flushed on close/step/unmount) and `hooks/useZoomPan.ts` (wheel/pinch/drag zoom, rAF transform writes on a wrapper layer; at 1× a horizontal drag of ≥60px is a swipe to the next/previous photo via `onSwipe`, and a pinch may shrink the picture below 1× — lifting below 0.8× calls `onPinchClose`, which closes the viewer) with the optimistic CSS rotation and a download menu (rotated vs. original) for edited photos. The invisible prev/next edge buttons are hidden on touch screens (`hover: none`) so they do not swallow swipes.

### Styling
CSS-in-JS via `@stitches/react`. The config (`stitches.config.ts`) defines two complementary breakpoints: `narrow` (≤699px wide AND portrait — phones held upright) and `wide` (everything else, including tall desktop monitors), plus a second pair for the album toolbar: `toolbarInline` (≥`TOOLBAR_INLINE_MIN_WIDTH_PX`, 1200px) and `toolbarStacked` (below it). Use the exported `styled` and `keyframes` from there rather than importing from `@stitches/react` directly.

The album toolbar (`AlbumToolbar.tsx`; the bottom bar of the selection is `SelectionBar.tsx`) has exactly two forms. On `toolbarInline` it is one row: the first group's header in the left third of the wave (the row left of the buttons, in the water of `WaveEdge`) and the buttons on the solid shelf; the row is as tall as the taller of the two and the wave is stretched to it, so a long name wraps to more lines and never crosses the curve. `AlbumContent` decides with `useMediaQuery(TOOLBAR_INLINE_QUERY)` and passes the toolbar's `headerSlot` element to the first `AlbumSection`, whose `SectionPanel` then portals its header there and renders no band of its own. On `toolbarStacked` (all narrower viewports, whatever the orientation) the toolbar is the bottom sheet and the first group's band sits on its bar — the header and the buttons are never stacked on separate rows. Every group header is laid out the same way whether it is the first or not (`AlbumSection.tsx: Header`, a grid: chevron, select-all, name; meta on the second line; the name wraps, never truncates). On `toolbarInline` a later group's band is the same shape as the toolbar row: water stretched to the band, `minHeight: TOOLBAR_HEIGHT`, header in the left third with 2rem above it. On `toolbarStacked` every `albumItemsBg` curve (the sheet's handle, each band's water) spans exactly `WAVE_HEIGHT` (`pages/Album/layout.ts`, = the sheet bar's 3rem), so the curves run parallel and the shelf between the handle and the first band's water keeps one thickness across the width; the header overlaps that span (2rem from the band top) and its name column ends at half the band, where the curve is still above the text.

