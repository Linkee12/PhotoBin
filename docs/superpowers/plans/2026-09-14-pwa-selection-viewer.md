# PWA, selection and viewer batch — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Four workstreams run in parallel worktrees; each task is one feature isolated into its own files. Steps use checkbox syntax.

**Goal:** Ship the twelve album UX changes of the spec as one PR, each feature in its own component/hook/service with vitest coverage of its pure logic.

**Architecture:** Frontend React 19 + Vite + stitches, backend Express + cuple RPC (types shared through `backend/src/index.ts: Routes`). New behaviour is added as new files (`services/visitedAlbums.ts`, `hooks/useLongPressSelect.ts`, `components/Footer.tsx`, …) and wired in with minimal edits to the existing pages. Pure logic goes in `utils/*.ts` with a sibling `*.test.ts`.

**Tech Stack:** TypeScript, React 19, react-router 7, @stitches/react, vitest, vite-plugin-pwa (new), Express, zod, @cuple.

**Spec:** `docs/superpowers/specs/2026-09-14-pwa-selection-viewer-design.md`

## Global Constraints

- Run `npm run lint`, `npm run type-check` (frontend), `npm test` in the package you touched before every commit; `npm run build` before the final commit of a workstream.
- Prefer removing code over adding it; no new dependencies beyond `vite-plugin-pwa` (+ `@vite-pwa/assets-generator` as a dev tool if needed once).
- Every new pure function gets a vitest spec next to it. Components are not unit-tested (repo convention).
- Follow repo idioms: `styled` from `stitches.config.ts`, `pressable` from `pressable.ts`, `toast` from react-toastify, `client` from `cuple.ts`.
- Touch gestures: `touch-action` and pointer events, never `touchstart` listeners with React (passive issues).
- Keep the URL hash (the key) out of every log, toast and rendered string.
- Update `CLAUDE.md` for every new subsystem (one short paragraph each, in the existing style).

---

## Workstream A — PWA + visited albums + Home list (spec §1, §2)

### Task A1: vite-plugin-pwa

**Files:** Modify `frontend/vite.config.mts`, `frontend/package.json`, `frontend/index.html`; Create `frontend/public/pwa-192.png`, `frontend/public/pwa-512.png`, `frontend/public/pwa-maskable-512.png`.

- [ ] `npm i -D vite-plugin-pwa` in `frontend/`.
- [ ] Add `VitePWA({ registerType: "autoUpdate", includeAssets: ["favicon.svg"], manifest: { name: "PhotoBin", short_name: "PhotoBin", start_url: "/", scope: "/", display: "standalone", background_color: "#0E0E10", theme_color: "#0E0E10", handle_links: "preferred", launch_handler: { client_mode: "navigate-existing" }, icons: [...] }, workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] } })` — cast the manifest to allow `handle_links` / `launch_handler` if the plugin's type lacks them.
- [ ] Generate the PNG icons from `frontend/src/favicon.svg` (e.g. `npx @vite-pwa/assets-generator --preset minimal-2023 src/favicon.svg` and move/rename, or any one-off script) and commit the PNGs. Add `<meta name="theme-color" content="#0E0E10">` and `<link rel="apple-touch-icon" href="/pwa-192.png">` to `index.html`.
- [ ] Add `import { registerSW } from "virtual:pwa-register"` (or `virtual:pwa-register/react`) in `main.tsx`; add `/// <reference types="vite-plugin-pwa/client" />` to `vite-env.d.ts`.
- [ ] `npm run build` and check `dist/manifest.webmanifest` + `dist/sw.js` exist, and that `sw.js` never caches `/api/`.
- [ ] Commit: `feat: install as a PWA`.

### Task A2: visitedAlbums store

**Files:** Create `frontend/src/services/visitedAlbums.ts`, `frontend/src/services/visitedAlbums.test.ts`.

**Produces:**
```ts
export type VisitedAlbum = { albumId: string; url: string; title: string; expiresAt: number | null; itemCount: number; visitedAt: number };
export function listVisitedAlbums(now = Date.now(), storage: Storage = localStorage): VisitedAlbum[]; // visitedAt desc, expired (expiresAt < now) dropped
export function rememberVisitedAlbum(album: Omit<VisitedAlbum, "visitedAt">, now = Date.now(), storage = localStorage): void;
export function forgetVisitedAlbum(albumId: string, storage = localStorage): void;
export function requestPersistentStorage(): void; // navigator.storage?.persist?.() once, errors swallowed
export const VISITED_STORAGE_KEY = "photobin:visited";
```
- [ ] Tests (stub `Storage` like `PendingUploadStore.test.ts` does): remember then list returns it; remember twice updates title/itemCount/visitedAt and keeps one entry; forget removes; expired dropped from list; malformed JSON → empty list; storage throwing → no crash.
- [ ] Implement; commit `feat: remember visited albums`.

### Task A3: wire remembering into the album

**Files:** Modify `frontend/src/pages/Album/hooks/useAlbumContext.tsx`, `frontend/src/main.tsx`.

- [ ] After a successful metadata load call `rememberVisitedAlbum({ albumId, url: window.location.href, title: decoded.albumName, expiresAt: response.expiresAt, itemCount: response.metadata.files.length })`.
- [ ] Call `requestPersistentStorage()` once in `main.tsx`.
- [ ] Commit.

### Task A4: Dialog + VisitedAlbums list on Home

**Files:** Create `frontend/src/components/Dialog.tsx`, `frontend/src/pages/Home/components/VisitedAlbums.tsx`; Modify `frontend/src/pages/Home/Home.tsx`.

**Produces:** `Dialog({ open, title, children, onClose })` — native `<dialog>` opened with `showModal()`, closes on Escape/backdrop click, dark styling in the app's fonts; `DialogActions` row; `DangerButton`, `SecondaryButton` exports (used by workstream B's delete dialog).

- [ ] `VisitedAlbums`: `listVisitedAlbums()` in state, hidden when empty, section title "YOUR ALBUMS", grid `repeat(auto-fill, minmax(16em, 1fr))`, card = `<button>` navigating to `album.url` (use `window.location.assign(url)` — react-router `navigate` would not re-run the album context for a hash-only change; a full navigation is fine), text: title or "Untitled album", `expires in …` via `utils/formatTimeLeft`, `N items` (1 item), `×` button (aria-label "Remove from this list") that opens `Dialog` with "Remove this album from the list? This does not delete the album." and Cancel / Remove; Remove calls `forgetVisitedAlbum` and refreshes the list.
- [ ] Place it in `Home.tsx` between `<Start>` and the ABOUT panel. Check at 400px, 800px, 1400px widths.
- [ ] Commit `feat: list visited albums on the home page`.

---

## Workstream B — `/new`, not found, delete album (spec §3, §4)

### Task B1: backend createAlbum / deleteAlbum / not-found

**Files:** Modify `backend/src/services/AlbumService.ts`, `backend/src/index.ts`; Create `backend/src/services/AlbumService.lifecycle.test.ts`.

**Produces:**
```ts
// AlbumService
async createAlbum(albumId: string): Promise<void>   // mkdir -p + save default metadata; existing album untouched
async exists(albumId: string): Promise<boolean>
async deleteAlbum(albumId: string): Promise<void>   // rm -rf, idempotent
// routes
createAlbum: post { albumId } → success({})
deleteAlbum: delete { albumId } → success({})
getAlbumMetadata: get { id } → success({ metadata, expiresAt }) | apiResponse("not-found", 404, { message })
```
- [ ] Tests (tmp dir like `AlbumService.edit.test.ts`): createAlbum creates dir + metadata.json with `albumName.value === ""`; createAlbum on an existing album keeps its metadata; exists true/false; deleteAlbum removes dir; deleteAlbum on missing dir resolves.
- [ ] Implement. Note `MetadataService.get` returns default metadata for a missing album — keep that, the route checks `exists` first.
- [ ] Commit `feat: create, delete and 404 albums on the server`.

### Task B2: `/new` page

**Files:** Create `frontend/src/pages/New/New.tsx`; Modify `frontend/src/App.tsx`, `frontend/src/pages/Home/Home.tsx`.

- [ ] `New`: on mount `genKey()` unless `?plain` in `useSearchParams`, `client.createAlbum.post({ body: { albumId } })`, then `navigate(\`/bin/${albumId}#${key}\`, { replace: true })`. Spinner + "Creating your album…"; on failure toast + "Try again" link to the same URL. Guard against double run in StrictMode (ref).
- [ ] Home's NEW ALBUM button → `navigate(encrypt ? "/new" : "/new?plain")`; remove `genKey` from Home.
- [ ] Commit `feat: create albums on /new`.

### Task B3: not-found page

**Files:** Create `frontend/src/pages/NotFound/NotFound.tsx`, `frontend/src/pages/NotFound/SadBird.tsx`; Modify `frontend/src/App.tsx`, `frontend/src/pages/Album/hooks/useAlbumContext.tsx`.

- [ ] `SadBird`: inline SVG, drawn by hand (≈ 40 path/circle elements max): a round bird with drooping wings, a tear, sitting on a broken branch; colours from `theme.ts` accent + greys; `aria-hidden`.
- [ ] `NotFound`: centred, "This album doesn't exist" / "It may have expired, been deleted, or the link is wrong.", `Go back home` button (`pressable`, same look as Home's NEW ALBUM). Routes: `/not-found` and `*`.
- [ ] `useAlbumContext`: when `response.result === "not-found"` → `forgetVisitedAlbum(albumId)` (from workstream A; if not merged yet, leave a one-line TODO-free call behind an `import` that A provides — coordinate: the function signature is fixed in the plan) and `navigate("/not-found", { replace: true })`.
- [ ] Commit `feat: album not found page`.

### Task B4: footer + delete album dialog

**Files:** Create `frontend/src/components/Footer.tsx`, `frontend/src/pages/Album/components/DeleteAlbumDialog.tsx`, `frontend/src/pages/Album/utils/deleteConfirmation.ts`, `frontend/src/pages/Album/utils/deleteConfirmation.test.ts`; Modify `frontend/src/pages/Album/Album.tsx`.

**Produces:**
```ts
export const DELETE_FALLBACK_PHRASE = "I want to delete this album";
export function requiredPhrase(title: string): string;           // title.trim() || fallback
export function confirmsDeletion(input: string, title: string): boolean; // exact match, trimmed
```
- [ ] Tests: empty title → fallback; whitespace title → fallback; exact match true; case mismatch false; surrounding spaces ok.
- [ ] `Footer`: `position: absolute; left: 0; right: 0; bottom: 0; height: FOOTER_HEIGHT (4rem)`; export `FOOTER_HEIGHT`; children centred; Album's `Container` gets `position: relative; paddingBottom: FOOTER_HEIGHT` (respect the existing bottom `SelectionBar` — check it still sits above the footer when a selection is active).
- [ ] `DeleteAlbumDialog({ open, title, onClose, onConfirm })` using `Dialog` from workstream A (if not merged yet, build on a local native `<dialog>` with the same props; the merge keeps one). Copy: "Delete this album? Every photo in it is deleted for everyone you shared the link with. This cannot be undone." + `Type "<phrase>" to confirm` + input + red `Delete album` button disabled until `confirmsDeletion`.
- [ ] `Album.tsx`: footer with a text-link button "Delete this album"; on confirm `client.deleteAlbum.delete({ body: { albumId } })`, `forgetVisitedAlbum`, `navigate("/")`, `toast.success("Album deleted")`.
- [ ] Commit `feat: delete an album from its footer`.

---

## Workstream C — viewer (spec §5)

### Task C1: video inside the zoom wrapper (items 1, 6)

**Files:** Modify `frontend/src/pages/Album/hooks/useZoomPan.ts`, `frontend/src/pages/Album/components/ViewOriginalModal.tsx`.

- [ ] `useZoomPan` option `zoomable?: boolean` (default true): when false, wheel/pinch/double-tap never change the scale (pinch is swallowed, so the page never zooms), only drag→swipe. Pointer handlers already `touch-action: none` on the wrapper.
- [ ] Render the video branch inside the same `ZoomWrapper` (`zoom.wrapperRef`, `zoom.handlers`); `FullScreenVideo` keeps `controls`; a tap on the controls must still reach the video (drag threshold 5px already lets clicks through — verify play/pause works on desktop with Playwright).
- [ ] Commit `fix: swipe and no page zoom on videos`.

### Task C2: pinch to close only from 1×, progressive fade (item 2)

**Files:** Modify `useZoomPan.ts`, `ViewOriginalModal.tsx`; Create `frontend/src/pages/Album/utils/pinchClose.ts` + test.

**Produces:** `export function closeProgress(scale: number, closeScale = 0.8): number` — 0 at ≥1, 1 at ≤closeScale, linear between.
- [ ] Tests: 1 → 0; 0.8 → 1; 0.9 → 0.5; 1.5 → 0; 0.4 → 1.
- [ ] Hook: record `pinchStartedAtRest = transform.scale === 1` when the second finger lands; allow scale < 1 only then; call `onPinchProgress?.(closeProgress(scale))` every frame while below 1 and `onPinchProgress(0)` when the pinch is released above the threshold. On release below threshold call `onPinchClose`.
- [ ] Modal: `onPinchProgress` sets `wrapper.style.backgroundColor = rgba(0,0,0, 1 - t)` and the button bar opacity `1 - t` directly via refs; `close()` resets both.
- [ ] Commit `feat: pinch out from 1x fades the viewer away`.

### Task C3: swipe preview (item 7)

**Files:** Create `frontend/src/pages/Album/utils/swipeStrip.ts` + test; Modify `useZoomPan.ts`, `ViewOriginalModal.tsx`.

**Produces:** `stripOffset(dx: number, { canGoPrev, canGoNext }): number` — dx passed through, but resisted (`dx / 3`) past an edge with no neighbour; `swipeDecision(dx, width, { canGoPrev, canGoNext }): -1 | 0 | 1` — commit when |dx| ≥ SWIPE_PX (60) and neighbour exists.
- [ ] Tests for both.
- [ ] Hook: at 1× (and `zoomable` both true/false) expose `onSwipeMove(dx)` / `onSwipeEnd(direction)`; the existing `onSwipe` stays for the commit.
- [ ] Modal: `SwipeStrip` layer (three slots at `-100vw / 0 / 100vw`), neighbours draw `gridThumbnail(props.thumbnails, id)` of the prev/next tile (needs `props.onNext`'s neighbour id — add `neighbourIds: { prev?: string; next?: string }` prop computed in `Album.tsx` from `tileIds`), `transition: transform 200ms` only while animating to the neighbour, then `goTo(direction)` and reset without transition (`prefers-reduced-motion` → no animation). Zoomed state: strip disabled.
- [ ] Commit `feat: swiping previews the neighbouring photo`.

---

## Workstream D — grid (spec §6)

### Task D1: columns remembered per orientation (item 5)

**Files:** Create `frontend/src/pages/Album/utils/columnsStore.ts` + test; Modify `frontend/src/pages/Album/components/AlbumContent.tsx`.

**Produces:** `readStoredColumns(orientation: "portrait" | "landscape", storage = localStorage): number | null`; `storeColumns(orientation, columns: number, storage = localStorage)`; keys `photobin:columns:portrait|landscape`.
- [ ] Tests: round trip; unknown/NaN/≤0 → null; storage throws → null / no crash.
- [ ] `AlbumContent`: `const portrait = useMediaQuery("(orientation: portrait)")`; initial `columns` from store; on orientation change reload from store; on pinch commit store. After the first measurement clamp with `clampColumns(columns, { width, gap })` (measure the first `[data-images]` grid in a `useLayoutEffect`).
- [ ] Commit `feat: remember the pinched column count per orientation`.

### Task D2: long press + range selection with auto-scroll (items 3, 4)

**Files:** Create `frontend/src/pages/Album/utils/rangeSelect.ts` + test, `frontend/src/pages/Album/hooks/useLongPressSelect.ts`; Modify `AlbumContent.tsx`, `AlbumItem.tsx` (styles only), `Album.tsx` (pass `tileIds`).

**Produces:**
```ts
export function rangeBetween(order: readonly string[], a: string, b: string): string[]; // inclusive, either direction; [] if either missing
export function autoScrollSpeed(y: number, viewportHeight: number, { zone = 0.1, maxPxPerFrame = 24 } = {}): number; // <0 up, >0 down, 0 outside zones, magnitude grows linearly to the edge
export function useLongPressSelect(opts: { containerRef; tileIds: readonly string[]; enabled: boolean; onSelect(ids: string[]): void; onDeselect(ids: string[]): void }): { onClickCapture, onContextMenu } // handlers for the container
```
- [ ] Tests: rangeBetween forward/backward/same/missing; autoScrollSpeed at top edge = -max, at 5% = -half, middle = 0, bottom edge = +max.
- [ ] Hook: `pointerdown` (pointerType touch, primary) on `[data-tile]` → timer 450 ms; `pointermove` > 8 px before it fires cancels; a second touch pointer cancels; on fire: `navigator.vibrate?.(10)`, `onSelect([anchor])`, `setPointerCapture`; then each move: target = `elementFromPoint(x, y)?.closest("[data-tile]")`, `range = rangeBetween(tileIds, anchor, target)`; deselect `previousRange \ range`, select `range`; rAF auto-scroll loop with `autoScrollSpeed(clientY, innerHeight)` (re-evaluate the target after each scroll step, since the finger is still); `pointerup/cancel` ends, sets `suppressClick = true` for the next click (the capture handler stops it). `onContextMenu` prevents default while a press is active.
- [ ] `AlbumItem` tile style: `WebkitTouchCallout: "none"`, `userSelect: "none"`.
- [ ] `AlbumContent`: attach to `AlbumSections` (works with `useGridPinch`: pinch's second pointer cancels the press).
- [ ] Commit `feat: long press selects, hold and drag selects a range`.

---

## Integration (main session)

- [ ] Merge A, B, C, D into `feat/pwa-selection-viewer`; resolve `Home.tsx`, `useAlbumContext.tsx`, `App.tsx`, `Album.tsx` overlaps.
- [ ] `npm run lint && npm run type-check && npm test && npm run build` in `frontend/`; `npm run lint && npm test && npm run build` in `backend/`.
- [ ] Playwright pass over: Home list, `/new`, `/bin/<random>` → not found, delete album, viewer video swipe, long-press.
- [ ] `CLAUDE.md` paragraphs; PR to `main`.
