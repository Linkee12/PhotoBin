# PWA, visited albums, delete/not-found, viewer and grid gestures — design

Twelve user-facing changes, delivered as one PR. Each feature lives in its own
component/hook/service so it can be read, tested and removed on its own.

## 1. PWA and visited albums (items 8, 10)

- `vite-plugin-pwa`, `registerType: "autoUpdate"`. Workbox precaches the built
  assets only; `navigateFallbackDenylist: [/^\/api\//]`, no runtime caching of
  `/api` (encrypted parts must never be cached by the service worker).
- Manifest: name PhotoBin, `start_url: "/"`, `scope: "/"`, `display: "standalone"`,
  `handle_links: "preferred"`, `launch_handler: { client_mode: "navigate-existing" }`,
  theme/background `#0E0E10`, PNG icons 192/512 (+ maskable) generated once from
  `src/favicon.svg` and committed under `frontend/public/`. With the manifest and
  service worker in place Chrome/Android opens `/bin/<id>#<key>` links inside the
  installed app with the hash intact, instead of the start URL.
- `frontend/src/services/visitedAlbums.ts`: localStorage key `photobin:visited`
  holding `{ [albumId]: { url, title, expiresAt, itemCount, visitedAt } }` (the
  `url` is the full album URL including the hash). Pure helpers (`upsert`,
  `remove`, `list` sorted by `visitedAt` desc, expired entries dropped on read)
  over an injected `Storage`, vitest-covered. `navigator.storage.persist()` is
  requested once at startup so the browser does not evict the origin's storage
  ("device storage" of an installed app; localStorage is the store either way).
- `AlbumContextProvider` upserts the record after every successful metadata
  load (title = decoded album name, itemCount = `files.length`) and removes it
  on not-found.

## 2. Home: visited albums list (item 9)

- `pages/Home/components/VisitedAlbums.tsx` under the NEW ALBUM button; hidden
  when empty. One card per record: title (or "Untitled album"), "expires in 12
  days" (existing `formatTimeLeft`), "34 items", and an `×` button. Clicking the
  card navigates to the stored URL; the URL itself is never rendered.
- `×` opens a confirm dialog: "Remove this album from the list? This does not
  delete the album." Confirm removes the record only.
- Layout: CSS grid `repeat(auto-fill, minmax(16em, 1fr))` — one column on
  phones, two on tablets, three on desktop.
- Shared `frontend/src/components/Dialog.tsx` (native `<dialog>`, dark styling,
  Escape/backdrop close) used by this confirm and by the delete-album dialog.

## 3. `/new` and album not found (item 12)

- Backend `createAlbum` RPC (`{ albumId }`): creates the album directory and
  writes the default metadata. `getAlbumMetadata` answers `apiResponse("not-found",
  404)` when the album directory does not exist.
- `pages/New/New.tsx` at `/new` (`/new?plain` for an unencrypted album): on
  mount generates the key, calls `createAlbum`, then `navigate(…, { replace: true })`
  to `/bin/<id>#<key>`. Home's NEW ALBUM button navigates to `/new` or
  `/new?plain`. Shows a spinner meanwhile; on failure a toast and a retry link.
- `AlbumContextProvider`: on `not-found` removes the visited record and
  `navigate("/not-found", { replace: true })`.
- `pages/NotFound/NotFound.tsx`: an inline hand-drawn sad bird SVG, "This album
  doesn't exist (or it expired)", a "Go back home" button. Also the `*` route.

## 4. Delete album (item 11)

- Backend `deleteAlbum` RPC (`{ albumId }`): removes the album directory
  (idempotent). Anyone with the link may call it, like every other route.
- `pages/Album/components/Footer.tsx`: generic footer, `position: absolute;
  bottom: 0`, fixed height `FOOTER_HEIGHT`; the album page reserves that height
  as bottom padding so the footer sits at the bottom even with no content. Only
  the album route renders it. Content: a secondary "Delete this album" link.
- `pages/Album/components/DeleteAlbumDialog.tsx`: explains that the album and
  every photo in it are deleted for everyone the link was shared with; an input;
  a red button disabled until the input equals the album title exactly (or the
  phrase `I want to delete this album` when the title is empty). On success:
  visited record removed, navigate home, toast. `utils/deleteConfirmation.ts`
  (`requiredPhrase(title)`, `matches(input, title)`) is vitest-covered.

## 5. Viewer (items 1, 2, 6, 7)

- The video branch of `ViewOriginalModal` moves inside `ZoomWrapper`, using
  `useZoomPan({ zoomable: false })`: swipes work, pinches are ignored, and the
  wrapper's `touch-action: none` + pointer capture stop the browser from zooming
  the page. Items 1 and 6 share this root cause.
- Pinch to close is armed only when the pinch begins at 1×. While such a pinch
  shrinks the picture the hook calls `onPinchProgress(t)` with `t` in `[0, 1]`
  (`0` at 1×, `1` at `PINCH_CLOSE_SCALE`); the modal writes the backdrop and
  button bar opacity from it directly (no React state). Releasing below the
  threshold closes; releasing above it animates back and restores opacity.
- Swipe preview: at 1× a horizontal drag moves a `SwipeStrip` (`translateX`)
  that holds the current picture and the neighbours' grid thumbnails at
  ±100 vw. Releasing past `SWIPE_PX` animates the strip to the neighbour, then
  the file switches and the strip resets; otherwise it snaps back. Keyboard and
  edge buttons keep switching instantly. Pure `utils/swipeStrip.ts`
  (`stripOffset(dx, canGoPrev, canGoNext)` with edge resistance) is tested.

## 6. Grid (items 3, 4, 5)

- `hooks/useLongPressSelect.ts`, attached to the sections container (event
  delegation on `[data-tile]`, touch pointers only): a 450 ms hold with less
  than 8 px of movement selects the tile (entering selection mode; `navigator.vibrate(10)`
  when available). While the finger stays down the gesture is in range mode:
  the tile under the finger (`document.elementFromPoint` → closest `[data-tile]`)
  becomes the target and the selection is `anchor … target` in tile order,
  recomputed on every move (tiles that left the range are deselected again,
  tiles selected before the gesture stay). When the finger is within the top or
  bottom 10 % of the viewport a rAF loop scrolls the window in that direction,
  faster the deeper the finger is in the zone. A second pointer cancels the
  gesture (the pinch wins). The click that follows the release and the context
  menu are suppressed; tiles get `-webkit-touch-callout: none`. Pure
  `utils/rangeSelect.ts` (`rangeBetween(order, a, b)`, `autoScrollSpeed(y, height)`)
  is tested.
- Columns are remembered per orientation: `utils/columnsStore.ts` (keys
  `photobin:columns:portrait` / `photobin:columns:landscape`, tested).
  `AlbumContent` reads the stored count for the current orientation
  (`useMediaQuery("(orientation: portrait)")`) as the initial `columns`, clamps
  it with `clampColumns` once the grid is measured, and writes on every pinch
  commit. Switching orientation swaps to that orientation's value.

## Testing

- vitest: `visitedAlbums`, `columnsStore`, `rangeSelect`, `swipeStrip`,
  `deleteConfirmation`; backend `createAlbum` / `deleteAlbum` / not-found.
- Browser (Playwright): home list, `/new`, not-found, delete album, viewer
  swipe and pinch (touch emulation, best effort), long-press range selection.
- `npm run lint`, `npm run type-check`, `npm run build` in both packages.

## Process

Four worktree agents in parallel (PWA + Home list; `/new` + not found + delete;
viewer; grid), each isolating its feature into its own files. Merged into one
branch, verified, one PR to `main`.
