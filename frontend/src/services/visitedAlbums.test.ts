import { beforeEach, describe, expect, it } from "vitest";
import {
  VISITED_STORAGE_KEY,
  forgetVisitedAlbum,
  listVisitedAlbums,
  rememberVisitedAlbum,
} from "./visitedAlbums";

const NOW = 1_000_000;
const album = (albumId: string, extra: Record<string, unknown> = {}) => ({
  albumId,
  url: `https://photobin.test/bin/${albumId}#key`,
  title: "Holiday",
  expiresAt: NOW + 1000,
  itemCount: 3,
  ...extra,
});

let data: Map<string, string>;
let storage: Storage;
beforeEach(() => {
  data = new Map();
  storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  } as unknown as Storage;
});

describe("visitedAlbums", () => {
  it("lists a remembered album with its visit time", () => {
    rememberVisitedAlbum(album("a"), NOW, storage);
    expect(listVisitedAlbums(NOW, storage)).toEqual([{ ...album("a"), visitedAt: NOW }]);
  });

  it("keeps one entry per album and takes the latest title, count and visit", () => {
    rememberVisitedAlbum(album("a"), NOW, storage);
    rememberVisitedAlbum(
      album("a", { title: "Renamed", itemCount: 5 }),
      NOW + 1,
      storage,
    );
    const list = listVisitedAlbums(NOW + 1, storage);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Renamed", itemCount: 5, visitedAt: NOW + 1 });
  });

  it("lists the most recently visited album first", () => {
    rememberVisitedAlbum(album("old"), NOW - 10, storage);
    rememberVisitedAlbum(album("new"), NOW, storage);
    rememberVisitedAlbum(album("mid"), NOW - 5, storage);
    expect(listVisitedAlbums(NOW, storage).map((a) => a.albumId)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("forgets an album", () => {
    rememberVisitedAlbum(album("a"), NOW, storage);
    rememberVisitedAlbum(album("b"), NOW, storage);
    forgetVisitedAlbum("a", storage);
    expect(listVisitedAlbums(NOW, storage).map((a) => a.albumId)).toEqual(["b"]);
  });

  it("drops expired albums and keeps those without an expiry", () => {
    rememberVisitedAlbum(album("expired", { expiresAt: NOW - 1 }), NOW - 10, storage);
    rememberVisitedAlbum(album("forever", { expiresAt: null }), NOW - 10, storage);
    rememberVisitedAlbum(album("live"), NOW - 10, storage);
    expect(
      listVisitedAlbums(NOW, storage)
        .map((a) => a.albumId)
        .sort(),
    ).toEqual(["forever", "live"]);
  });

  it("treats malformed storage as empty", () => {
    data.set(VISITED_STORAGE_KEY, "{not json");
    expect(listVisitedAlbums(NOW, storage)).toEqual([]);
    data.set(VISITED_STORAGE_KEY, JSON.stringify({ a: "nope", b: null, c: 1 }));
    expect(listVisitedAlbums(NOW, storage)).toEqual([]);
    rememberVisitedAlbum(album("a"), NOW, storage);
    expect(listVisitedAlbums(NOW, storage)).toHaveLength(1);
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => rememberVisitedAlbum(album("a"), NOW, broken)).not.toThrow();
    expect(() => forgetVisitedAlbum("a", broken)).not.toThrow();
    expect(listVisitedAlbums(NOW, broken)).toEqual([]);
  });
});
