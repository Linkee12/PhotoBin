import { useCallback, useMemo, useState } from "react";
import type { Sidecar, ThumbnailGroup } from "../utils/groupFiles";

/** The slice of a tile the selection model cares about. */
export type Tile = { id: string; sidecars: Sidecar[] };

/**
 * Lookup tables over the album's tiles. `tiles` answers "is this a photo, and
 * which files ride along with it"; `sidecarIds` is the "+RAW" toggle's domain.
 */
export type TileIndex = {
  tiles: ReadonlyMap<string, Tile>;
  sidecarIds: ReadonlySet<string>;
};

export function indexTiles(groups: readonly { thumbnails: Tile[] }[]): TileIndex {
  const tiles = new Map<string, Tile>();
  const sidecarIds = new Set<string>();
  for (const { thumbnails } of groups) {
    for (const tile of thumbnails) {
      tiles.set(tile.id, tile);
      for (const sidecar of tile.sidecars) sidecarIds.add(sidecar.id);
    }
  }
  return { tiles, sidecarIds };
}

function sidecarIdsOf(index: TileIndex, id: string): string[] {
  return (index.tiles.get(id)?.sidecars ?? []).map((s) => s.id);
}

/** `ids` plus the sidecars of every tile among them, each id once. */
export function withSidecars(index: TileIndex, ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap((id) => [id, ...sidecarIdsOf(index, id)]))];
}

function clause(n: number, one: string, many: string): string[] {
  if (n === 0) return [];
  return [n === 1 ? one : `${n} ${many}`];
}

/** "Delete this photo and 2 attached files? This cannot be undone." — attached files are RAWs. */
export function deleteQuestion(index: TileIndex, ids: readonly string[]): string {
  const photos = ids.filter((id) => index.tiles.has(id)).length;
  const clauses = [
    ...clause(photos, "this photo", "photos"),
    ...clause(ids.length - photos, "1 attached file", "attached files"),
  ];
  return `Delete ${clauses.join(" and ")}? This cannot be undone.`;
}

// Set arithmetic. Every helper returns the input set untouched when nothing
// would change, so `setState` bails out and memoised tiles stay put.

type IdSet = ReadonlySet<string>;
const NONE: IdSet = new Set();

function union(set: IdSet, ids: readonly string[]): IdSet {
  if (ids.every((id) => set.has(id))) return set;
  return new Set([...set, ...ids]);
}

function difference(set: IdSet, ids: readonly string[]): IdSet {
  if (!ids.some((id) => set.has(id))) return set;
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

/**
 * The one rule behind both "+RAW" and a tile's badge: when every id is already
 * selected drop them all, otherwise take them all. An empty list is a no-op.
 */
export function toggleAllOrNothing(set: IdSet, ids: readonly string[]): IdSet {
  return ids.every((id) => set.has(id)) ? difference(set, ids) : union(set, ids);
}

/**
 * Selection is per file id, over one flat set: a tile (photo) and each of its
 * sidecars (a RAW next to its JPG) are picked separately. Selecting a tile
 * never takes its sidecars along; the sidecars have their own toggles (the
 * tile's badge, the viewer's pill, "+RAW" next to SELECT ALL).
 */
export function useSelection(groups: readonly ThumbnailGroup[]) {
  const index = useMemo(() => indexTiles(groups), [groups]);
  const [chosen, setChosen] = useState<IdSet>(NONE);

  // Ids that no longer exist (deleted here or by another participant) fall
  // out as soon as the groups reflect it.
  const selected = useMemo(() => {
    const gone = [...chosen].filter(
      (id) => !index.tiles.has(id) && !index.sidecarIds.has(id),
    );
    return difference(chosen, gone);
  }, [chosen, index]);
  const selectedImages = useMemo(() => [...selected], [selected]);

  const tileIds = useMemo(() => [...index.tiles.keys()], [index]);
  const selectedAll = tileIds.length > 0 && tileIds.every((id) => selected.has(id));
  // `selected` only holds existing ids, so "not a tile" means "a sidecar".
  const selectedSidecarCount = selectedImages.filter((id) => !index.tiles.has(id)).length;

  // Per-tile handlers are stable so memoised tiles only re-render on real changes.
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const areSidecarsSelected = useCallback(
    (id: string) => {
      const ids = sidecarIdsOf(index, id);
      return ids.length > 0 && ids.every((sidecarId) => selected.has(sidecarId));
    },
    [index, selected],
  );
  const select = useCallback((ids: string[]) => setChosen((s) => union(s, ids)), []);
  const deselect = useCallback(
    (ids: string[]) => setChosen((s) => difference(s, ids)),
    [],
  );
  const toggle = useCallback(
    (id: string) => setChosen((s) => toggleAllOrNothing(s, [id])),
    [],
  );
  const toggleSidecars = useCallback(
    (id: string) => setChosen((s) => toggleAllOrNothing(s, sidecarIdsOf(index, id))),
    [index],
  );

  return {
    index,
    selectedImages,
    selectedAll,
    selectedSome: selected.size > 0,
    sidecarCount: index.sidecarIds.size,
    selectedSidecarCount,
    isSelected,
    areSidecarsSelected,
    select,
    deselect,
    toggle,
    toggleSidecars,
    /** Every photo (tile); already selected sidecars stay selected. */
    selectAll: () => setChosen((s) => union(s, tileIds)),
    toggleAllSidecars: () =>
      setChosen((s) => toggleAllOrNothing(s, [...index.sidecarIds])),
    clear: () => setChosen(NONE),
    withSidecars: (ids: readonly string[]) => withSidecars(index, ids),
    deleteQuestion: (ids: readonly string[]) => deleteQuestion(index, ids),
  };
}
