import { describe, expect, it } from "vitest";
import {
  deleteQuestion,
  indexTiles,
  toggleAllOrNothing,
  withSidecars,
} from "./useSelection";

const groups = [
  {
    thumbnails: [
      { id: "a", sidecars: [{ id: "a.raw", name: "a.CR3" }] },
      { id: "b", sidecars: [] },
    ],
  },
  {
    thumbnails: [
      {
        id: "c",
        sidecars: [
          { id: "c1", name: "c.CR3" },
          { id: "c2", name: "c.XMP" },
        ],
      },
    ],
  },
];
const index = indexTiles(groups);

describe("indexTiles", () => {
  it("lists tiles and every sidecar id", () => {
    expect([...index.tiles.keys()]).toEqual(["a", "b", "c"]);
    expect([...index.sidecarIds]).toEqual(["a.raw", "c1", "c2"]);
  });
});

describe("withSidecars", () => {
  it("adds each tile's sidecars once and passes other ids through", () => {
    expect(withSidecars(index, ["a", "a.raw", "b", "c"])).toEqual([
      "a",
      "a.raw",
      "b",
      "c",
      "c1",
      "c2",
    ]);
  });
});

describe("toggleAllOrNothing", () => {
  it("fills the gaps unless everything is already selected", () => {
    const some = new Set(["c1"]);
    expect([...toggleAllOrNothing(some, ["c1", "c2"])]).toEqual(["c1", "c2"]);
    expect([...toggleAllOrNothing(new Set(["c1", "c2", "a"]), ["c1", "c2"])]).toEqual([
      "a",
    ]);
  });
  it("returns the same set when nothing changes", () => {
    const set = new Set(["a"]);
    expect(toggleAllOrNothing(set, [])).toBe(set);
  });
});

describe("deleteQuestion", () => {
  it("counts photos and attached files separately", () => {
    expect(deleteQuestion(index, ["a"])).toBe(
      "Delete this photo? This cannot be undone.",
    );
    expect(deleteQuestion(index, ["a", "b", "c1"])).toBe(
      "Delete 2 photos and 1 attached file? This cannot be undone.",
    );
    expect(deleteQuestion(index, ["c1", "c2"])).toBe(
      "Delete 2 attached files? This cannot be undone.",
    );
  });
});
